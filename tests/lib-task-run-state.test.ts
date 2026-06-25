import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DbClientOrTx } from '@/lib/db/types';

const mocked = vi.hoisted(() => {
  const findFirstFn = vi.fn().mockResolvedValue({ taskKey: 'PROJ-1', projectId: 'project-1' });
  const returningFn = vi.fn().mockResolvedValue([{ taskKey: 'PROJ-1', projectId: 'project-1' }]);
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  const updateFn = vi.fn().mockReturnValue({ set: setFn });
  const valuesFn = vi.fn().mockResolvedValue(undefined);
  const insertFn = vi.fn().mockReturnValue({ values: valuesFn });

  return {
    db: {
      insert: insertFn,
      update: updateFn,
      query: {
        tasks: {
          findFirst: findFirstFn,
        },
        taskComments: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        taskWorkNodes: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    },
    findFirstFn,
    insertFn,
    valuesFn,
    updateFn,
    setFn,
    whereFn,
    returningFn,
  };
});

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

import { queueTaskExecutionByTaskKey } from '@/lib/task-run-state';
import { findTaskDispatchContextByTaskKey } from '@/lib/task-run-state';
import { syncTaskRunStateFromExecutionState } from '@/lib/task-run-state';

function asDbClient(client: unknown) {
  return client as DbClientOrTx;
}

describe('lib/task-run-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.db.update = mocked.updateFn;
    mocked.db.insert = mocked.insertFn;
    mocked.db.query.tasks.findFirst = mocked.findFirstFn;
    mocked.db.query.taskComments.findMany.mockResolvedValue([]);
    mocked.db.query.taskWorkNodes.findMany.mockResolvedValue([]);
    mocked.findFirstFn.mockResolvedValue({ taskKey: 'PROJ-1', projectId: 'project-1' });
    mocked.returningFn.mockResolvedValue([{ taskKey: 'PROJ-1', projectId: 'project-1' }]);
  });

  it('finds dispatch context for an existing task key', async () => {
    const result = await findTaskDispatchContextByTaskKey({
      ownerId: 'owner-1',
      taskKey: 'PROJ-1',
    });

    expect(result).toEqual({
      taskKey: 'PROJ-1',
      projectId: 'project-1',
    });
  });

  it('queues execution without changing workflow status', async () => {
    const result = await queueTaskExecutionByTaskKey({
      ownerId: 'owner-1',
      taskKey: 'PROJ-1',
      dispatchTarget: 'telegram',
      engine: 'codex',
      branch: 'task/proj-1/fix-auth',
      now: new Date('2026-03-22T23:30:00.000Z'),
    });

    const payload = mocked.setFn.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(payload).toMatchObject({
      archivedAt: null,
      runState: 'queued',
      runStateUpdatedAt: new Date('2026-03-22T23:30:00.000Z'),
      dispatchTarget: 'telegram',
      engine: 'codex',
      branch: 'task/proj-1/fix-auth',
    });
    expect(payload).not.toHaveProperty('status');
    expect(result).toEqual({
      taskKey: 'PROJ-1',
      projectId: 'project-1',
    });
  });

  it('returns null when queueing does not resolve a task', async () => {
    mocked.returningFn.mockResolvedValueOnce([]);

    const result = await queueTaskExecutionByTaskKey({
      ownerId: 'owner-1',
      taskKey: 'PROJ-404',
      dispatchTarget: 'claude-code-channel',
    });

    expect(result).toBeNull();
  });

  it('keeps root run state running while any work node is running', async () => {
    mocked.findFirstFn.mockResolvedValueOnce({
      runState: 'queued',
      taskKey: 'PROJ-1',
      projectId: 'project-1',
    });
    mocked.db.query.taskComments.findMany.mockResolvedValueOnce([{ runState: 'queued' }]);
    mocked.db.query.taskWorkNodes.findMany.mockResolvedValueOnce([{ status: 'running' }]);

    const result = await syncTaskRunStateFromExecutionState({
      client: asDbClient(mocked.db),
      ownerId: 'owner-1',
      taskId: 'task-1',
      now: new Date('2026-05-06T15:00:00.000Z'),
    });

    expect(result).toBe('running');
    expect(mocked.setFn).toHaveBeenCalledWith({
      runState: 'running',
      runStateUpdatedAt: new Date('2026-05-06T15:00:00.000Z'),
    });
    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        projectId: 'project-1',
        eventType: 'TASK_UPDATED',
        entityType: 'task',
        entityId: 'PROJ-1',
      }),
    );
  });

  it('queues root run state when work nodes are ready and no execution is running', async () => {
    mocked.findFirstFn.mockResolvedValueOnce({
      runState: null,
      taskKey: 'PROJ-1',
      projectId: 'project-1',
    });
    mocked.db.query.taskWorkNodes.findMany.mockResolvedValueOnce([{ status: 'ready' }]);

    const result = await syncTaskRunStateFromExecutionState({
      client: asDbClient(mocked.db),
      ownerId: 'owner-1',
      taskId: 'task-1',
    });

    expect(result).toBe('queued');
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        runState: 'queued',
        runStateUpdatedAt: expect.any(Date),
      }),
    );
  });

  it('does not emit a task update when the derived root run state is unchanged', async () => {
    mocked.findFirstFn.mockResolvedValueOnce({
      runState: 'running',
      taskKey: 'PROJ-1',
      projectId: 'project-1',
    });
    mocked.db.query.taskWorkNodes.findMany.mockResolvedValueOnce([{ status: 'running' }]);

    const result = await syncTaskRunStateFromExecutionState({
      client: asDbClient(mocked.db),
      ownerId: 'owner-1',
      taskId: 'task-1',
    });

    expect(result).toBe('running');
    expect(mocked.updateFn).not.toHaveBeenCalled();
    expect(mocked.insertFn).not.toHaveBeenCalled();
  });
});
