import { beforeEach, describe, expect, it, vi } from 'vitest';

import { workLogs } from '@/lib/db/schema';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const txInsertValuesFn = vi.fn().mockResolvedValue(undefined);
  const txWhereFn = vi.fn().mockResolvedValue(undefined);
  const txSetFn = vi.fn().mockReturnValue({ where: txWhereFn });
  const txUpdate = vi.fn().mockReturnValue({ set: txSetFn });
  const txInsert = vi.fn().mockReturnValue({ values: txInsertValuesFn });

  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    safeCreateTaskCompletionNotification: vi.fn(),
    writeOutboxEventStandalone: vi.fn(),
    db: {
      query: {
        tasks: { findFirst: vi.fn(), findMany: vi.fn() },
      },
      transaction: vi.fn(),
    },
    txInsert,
    txInsertValuesFn,
    txUpdate,
    txSetFn,
    txWhereFn,
  };
});

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/request-security', () => ({
  assertSameOrigin: mocked.assertSameOrigin,
}));

vi.mock('@/lib/task-keys', () => ({
  taskWhereByIdentifier: vi.fn((_ownerId: string, identifier: string) => ({
    type: 'taskWhereByIdentifier',
    identifier,
  })),
}));

vi.mock('@/lib/task-run-state', () => ({
  buildTaskRunStateUpdate: vi.fn(() => ({ runState: null, runStateUpdatedAt: null })),
}));

vi.mock('@/lib/task-notifications', () => ({
  safeCreateTaskCompletionNotification: mocked.safeCreateTaskCompletionNotification,
}));

vi.mock('@/lib/outbox', () => ({
  ENTITY_TASK: 'task',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  writeOutboxEventStandalone: mocked.writeOutboxEventStandalone,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    mocked.db.transaction(async (tx: Record<string, unknown>) =>
      callback({ ...mocked.db, ...tx, query: mocked.db.query }),
    ),
}));

import { POST } from '@/app/api/todos/move/route';

function request(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/todos/move`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

describe('app/api/todos/move/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.safeCreateTaskCompletionNotification.mockResolvedValue(null);
    mocked.writeOutboxEventStandalone.mockResolvedValue(undefined);
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-7',
      taskKey: 'PROJ-7',
      branch: 'task/proj-7/moved-task',
      title: 'Moved task',
      note: null,
      status: 'todo',
      sortOrder: 'a1',
      taskPriority: 'none',
      dueAt: null,
      engine: 'codex',
      runState: 'running',
      runStateUpdatedAt: new Date('2026-04-01T00:00:00.000Z'),
      archivedAt: null,
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      projectId: 'project-1',
      labelId: null,
      project: { id: 'project-1', name: 'Project One', projectKey: 'PROJ' },
      labelAssignments: [],
    });
    mocked.db.query.tasks.findMany.mockResolvedValue([
      {
        id: 'task-5',
        taskKey: 'PROJ-5',
        sortOrder: 'a0',
        dueAt: new Date('2026-04-01T00:00:00.000Z'),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        id: 'task-9',
        taskKey: 'PROJ-9',
        sortOrder: 'a2',
        dueAt: new Date('2026-04-03T00:00:00.000Z'),
        createdAt: new Date('2026-04-03T00:00:00.000Z'),
      },
    ]);
    mocked.db.transaction.mockImplementation(async (fn: Function) =>
      fn({
        insert: mocked.txInsert,
        update: mocked.txUpdate,
      }),
    );
  });

  it('POST /api/todos/move computes placement from server neighbors', async () => {
    const response = await POST(
      request({
        taskKey: 'PROJ-7',
        targetStatus: 'ready',
        afterTaskKey: 'PROJ-5',
        beforeTaskKey: 'PROJ-9',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        boardTask: expect.objectContaining({
          taskKey: 'PROJ-7',
          status: 'ready',
          sortOrder: expect.any(String),
        }),
      }),
    );
  });

  it('POST /api/todos/move records status transition side effects for cross-lane moves', async () => {
    const response = await POST(
      request({
        taskKey: 'PROJ-7',
        targetStatus: 'done',
        afterTaskKey: null,
        beforeTaskKey: null,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocked.txInsert).toHaveBeenCalledWith(workLogs);
    expect(mocked.safeCreateTaskCompletionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        taskId: 'task-7',
        taskKey: 'PROJ-7',
        taskTitle: 'Moved task',
        fromStatus: 'todo',
        toStatus: 'done',
        previousRunState: 'running',
        nextRunState: null,
      }),
    );
    expect(mocked.writeOutboxEventStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'TASK_STATUS_CHANGED',
        entityId: 'PROJ-7',
        payload: { from: 'todo', to: 'done' },
      }),
      expect.anything(),
    );
  });
});
