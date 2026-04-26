import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn().mockResolvedValue([{ taskKey: 'PROJ-1', projectId: 'project-1' }]);
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  const updateFn = vi.fn().mockReturnValue({ set: setFn });

  return {
    db: {
      update: updateFn,
    },
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

describe('lib/task-run-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.db.update = mocked.updateFn;
    mocked.returningFn.mockResolvedValue([{ taskKey: 'PROJ-1', projectId: 'project-1' }]);
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
});
