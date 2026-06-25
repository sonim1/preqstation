import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DbClientOrTx } from '@/lib/db/types';
import {
  attachWorkNodeEvidence,
  createWorkNode,
  redactEvidenceValue,
  transitionWorkNode,
  validateEvidencePayloadSize,
  WorkGraphServiceError,
} from '@/lib/work-graph-service';

function asDbClient(client: unknown) {
  return client as DbClientOrTx;
}

function makeClient() {
  const returning = vi.fn().mockResolvedValue([]);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn().mockReturnValue({ values });
  const execute = vi.fn().mockResolvedValue([{ relation_name: 'task_notifications' }]);

  return {
    client: {
      execute,
      insert,
      update,
      query: {
        tasks: {
          findFirst: vi.fn(),
        },
        taskComments: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        taskWorkNodes: {
          findFirst: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    },
    execute,
    insert,
    returning,
    set,
    update,
    values,
  };
}

const task = {
  id: 'task-1',
  ownerId: 'owner-1',
  projectId: 'project-1',
  taskKey: 'PREQ-1',
  title: 'Build graph',
};

describe('lib/work-graph-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an existing node when idempotency key already matches', async () => {
    const mocked = makeClient();
    const existingNode = {
      id: 'node-existing',
      ownerId: 'owner-1',
      projectId: 'project-1',
      taskId: 'task-1',
      status: 'pending',
      type: 'analyze',
      title: 'Analyze',
    };

    mocked.client.query.tasks.findFirst.mockResolvedValue(task);
    mocked.client.query.taskWorkNodes.findFirst.mockResolvedValue(existingNode);

    const result = await createWorkNode({
      client: asDbClient(mocked.client),
      ownerId: 'owner-1',
      taskId: 'task-1',
      input: {
        type: 'analyze',
        title: 'Analyze',
        idempotencyKey: 'worker-1:analyze',
      },
    });

    expect(result.node).toBe(existingNode);
    expect(result.created).toBe(false);
    expect(mocked.insert).not.toHaveBeenCalled();
  });

  it('rejects dependencies that do not belong to the same task', async () => {
    const mocked = makeClient();

    mocked.client.query.tasks.findFirst.mockResolvedValue(task);
    mocked.client.query.taskWorkNodes.findFirst.mockResolvedValue(null);
    mocked.client.query.taskWorkNodes.findMany.mockResolvedValue([
      { id: 'dep-1', ownerId: 'owner-1', projectId: 'project-1', taskId: 'other-task' },
    ]);

    await expect(
      createWorkNode({
        client: asDbClient(mocked.client),
        ownerId: 'owner-1',
        taskId: 'task-1',
        input: {
          type: 'implement',
          title: 'Implement',
          dependencyIds: ['dep-1'],
        },
      }),
    ).rejects.toMatchObject({
      code: 'invalid_dependency',
      status: 400,
    });
  });

  it('rejects transitions out of terminal node states', async () => {
    const mocked = makeClient();

    mocked.client.query.taskWorkNodes.findFirst.mockResolvedValue({
      id: 'node-1',
      ownerId: 'owner-1',
      projectId: 'project-1',
      taskId: 'task-1',
      status: 'completed',
      type: 'test',
      title: 'Test',
    });

    await expect(
      transitionWorkNode({
        client: asDbClient(mocked.client),
        ownerId: 'owner-1',
        nodeId: 'node-1',
        action: 'start',
      }),
    ).rejects.toMatchObject({
      code: 'conflict',
      status: 409,
    });
    expect(mocked.update).not.toHaveBeenCalled();
  });

  it('returns a conflict when another transition wins the status update race', async () => {
    const mocked = makeClient();

    mocked.client.query.taskWorkNodes.findFirst.mockResolvedValue({
      id: 'node-1',
      ownerId: 'owner-1',
      projectId: 'project-1',
      taskId: 'task-1',
      status: 'running',
      type: 'test',
      title: 'Test',
    });
    mocked.returning.mockResolvedValue([]);

    await expect(
      transitionWorkNode({
        client: asDbClient(mocked.client),
        ownerId: 'owner-1',
        nodeId: 'node-1',
        action: 'complete',
      }),
    ).rejects.toMatchObject({
      code: 'conflict',
      status: 409,
    });
  });

  it('creates task notifications when nodes wait for user input', async () => {
    const mocked = makeClient();
    const waitingNode = {
      id: 'node-1',
      ownerId: 'owner-1',
      projectId: 'project-1',
      taskId: 'task-1',
      status: 'waiting_for_user',
      type: 'decision',
      title: 'Choose rollout',
    };

    mocked.client.query.taskWorkNodes.findFirst.mockResolvedValue({
      ...waitingNode,
      status: 'running',
    });
    mocked.client.query.tasks.findFirst.mockResolvedValue(task);
    mocked.returning
      .mockResolvedValueOnce([waitingNode])
      .mockResolvedValueOnce([
        {
          id: 'notification-1',
          ownerId: 'owner-1',
          projectId: 'project-1',
          taskId: 'task-1',
          taskKey: 'PREQ-1',
          taskTitle: 'Build graph',
          statusFrom: 'node:running',
          statusTo: 'node:waiting_for_user',
          readAt: null,
          createdAt: new Date('2026-06-25T00:00:00.000Z'),
        },
      ]);

    await transitionWorkNode({
      client: asDbClient(mocked.client),
      ownerId: 'owner-1',
      nodeId: 'node-1',
      action: 'wait',
      waitingReason: 'Needs operator decision.',
    });

    expect(mocked.values).toHaveBeenCalledWith(
      expect.objectContaining({
        taskKey: 'PREQ-1',
        taskTitle: 'Build graph',
        statusFrom: 'node:running',
        statusTo: 'node:waiting_for_user',
      }),
    );
  });

  it('rejects evidence payloads that reference local secret files', async () => {
    const mocked = makeClient();

    mocked.client.query.taskWorkNodes.findFirst.mockResolvedValue({
      id: 'node-1',
      ownerId: 'owner-1',
      projectId: 'project-1',
      taskId: 'task-1',
      status: 'running',
      type: 'test',
      title: 'Test',
    });
    mocked.client.query.tasks.findFirst.mockResolvedValue(task);
    mocked.returning.mockResolvedValue([{ id: 'evidence-1' }]);

    await expect(
      attachWorkNodeEvidence({
        client: asDbClient(mocked.client),
        ownerId: 'owner-1',
        nodeId: 'node-1',
        input: {
          kind: 'log',
          title: 'Raw command output',
          payload: {
            command: 'cat /Users/kendrick/projects/preqstation/.env.local',
          },
        },
      }),
    ).rejects.toMatchObject({
      code: 'unsafe_evidence',
      status: 400,
    });
    expect(mocked.insert).not.toHaveBeenCalled();
  });

  it('redacts home-directory paths from evidence payloads', () => {
    expect(redactEvidenceValue('/Users/kendrick/projects/preqstation/app/page.tsx')).toBe(
      '~/projects/preqstation/app/page.tsx',
    );
    expect(
      redactEvidenceValue({
        command: 'cat /Users/kendrick/.env',
        files: ['/Users/kendrick/projects/preqstation/lib/work-graph.ts'],
      }),
    ).toEqual({
      command: 'cat ~/.env',
      files: ['~/projects/preqstation/lib/work-graph.ts'],
    });
  });

  it('rejects inline evidence payloads above the 64 KB cap', () => {
    expect(() => validateEvidencePayloadSize({ text: 'x'.repeat(64 * 1024 + 1) })).toThrow(
      WorkGraphServiceError,
    );
  });
});
