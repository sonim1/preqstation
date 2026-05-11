import { beforeEach, describe, expect, it, vi } from 'vitest';

import { syncTaskRunStateFromComments } from '@/lib/task-comments';

type SyncParams = Parameters<typeof syncTaskRunStateFromComments>[0];

const mocked = vi.hoisted(() => {
  const whereFn = vi.fn();
  const setFn = vi.fn().mockReturnValue({ where: whereFn });

  return {
    db: {
      query: {
        tasks: { findFirst: vi.fn() },
        taskComments: { findMany: vi.fn() },
      },
      update: vi.fn().mockReturnValue({ set: setFn }),
    },
    setFn,
    whereFn,
  };
});

describe('syncTaskRunStateFromComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.db.query.tasks.findFirst.mockResolvedValue({ runState: null });
    mocked.db.query.taskComments.findMany.mockResolvedValue([]);
    mocked.db.update.mockReturnValue({ set: mocked.setFn });
    mocked.setFn.mockReturnValue({ where: mocked.whereFn });
  });

  function sync(overrides: Omit<SyncParams, 'client' | 'ownerId' | 'taskId'> = {}) {
    return syncTaskRunStateFromComments({
      client: mocked.db as unknown as SyncParams['client'],
      ownerId: 'owner-1',
      taskId: 'task-1',
      ...overrides,
    });
  }

  it('uses running when any active comment is working', async () => {
    mocked.db.query.taskComments.findMany.mockResolvedValue([
      { runState: 'queued' },
      { runState: 'working' },
    ]);

    await sync({ now: new Date('2026-05-11T12:00:00.000Z') });

    expect(mocked.setFn).toHaveBeenCalledWith({
      runState: 'running',
      runStateUpdatedAt: new Date('2026-05-11T12:00:00.000Z'),
    });
  });

  it('uses queued when queued comments remain and none are working', async () => {
    mocked.db.query.taskComments.findMany.mockResolvedValue([{ runState: 'queued' }]);

    await sync({ now: new Date('2026-05-11T12:01:00.000Z') });

    expect(mocked.setFn).toHaveBeenCalledWith({
      runState: 'queued',
      runStateUpdatedAt: new Date('2026-05-11T12:01:00.000Z'),
    });
  });

  it('clears task run state when no active comments remain', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({ runState: 'running' });

    await sync({ now: new Date('2026-05-11T12:02:00.000Z') });

    expect(mocked.setFn).toHaveBeenCalledWith({
      runState: null,
      runStateUpdatedAt: null,
    });
  });

  it('does not rewrite the task when the aggregate run state is unchanged', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({ runState: 'queued' });
    mocked.db.query.taskComments.findMany.mockResolvedValue([{ runState: 'queued' }]);

    await sync({ now: new Date('2026-05-11T12:03:00.000Z') });

    expect(mocked.db.update).not.toHaveBeenCalled();
  });
});
