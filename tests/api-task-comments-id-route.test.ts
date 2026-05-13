import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn();
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  const valuesFn = vi.fn();

  return {
    authenticateApiToken: vi.fn(),
    db: {
      query: {
        tasks: { findFirst: vi.fn() },
        taskComments: { findFirst: vi.fn(), findMany: vi.fn() },
      },
      update: vi.fn().mockReturnValue({ set: setFn }),
      insert: vi.fn().mockReturnValue({ values: valuesFn }),
    },
    returningFn,
    setFn,
    valuesFn,
    whereFn,
  };
});

vi.mock('@/lib/api-tokens', () => ({ authenticateApiToken: mocked.authenticateApiToken }));
vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: typeof mocked.db) => unknown) =>
    callback(mocked.db),
}));
vi.mock('@/lib/owner', () => ({ getOwnerUserOrNull: vi.fn() }));

import { PATCH } from '@/app/api/task-comments/[id]/route';

function patchRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/task-comments/comment-1`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const existingComment = {
  id: 'comment-1',
  ownerId: 'owner-1',
  projectId: 'project-1',
  taskId: 'task-1',
  parentCommentId: null,
  authorType: 'user',
  authorName: 'owner@example.com',
  body: 'Please review this comment',
  runState: 'queued',
  runStateUpdatedAt: new Date('2026-05-06T15:00:00.000Z'),
  engine: 'codex',
  dispatchTarget: 'hermes-telegram',
  errorMessage: null,
  metadata: null,
  createdAt: new Date('2026-05-06T15:00:00.000Z'),
  updatedAt: new Date('2026-05-06T15:00:00.000Z'),
};

describe('app/api/task-comments/[id]/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.authenticateApiToken.mockResolvedValue({
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tokenId: 'token-1',
      tokenName: 'PREQSTATION Token',
    });
    mocked.db.query.taskComments.findFirst.mockResolvedValue(existingComment);
    mocked.db.query.tasks.findFirst.mockResolvedValue({ runState: null });
    mocked.db.query.taskComments.findMany.mockResolvedValue([{ runState: 'working' }]);
    mocked.returningFn.mockResolvedValue([{ ...existingComment, runState: 'working' }]);
    mocked.db.update.mockReturnValue({ set: mocked.setFn });
    mocked.setFn.mockReturnValue({ where: mocked.whereFn });
    mocked.whereFn.mockReturnValue({ returning: mocked.returningFn });
    mocked.db.insert.mockReturnValue({ values: mocked.valuesFn });
  });

  it('maps working comment state to running task run state', async () => {
    const response = await PATCH(patchRequest({ run_state: 'working' }), {
      params: Promise.resolve({ id: 'comment-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        runState: 'running',
        runStateUpdatedAt: expect.any(Date),
      }),
    );
  });

  it('clears task run state after done when no active comments remain', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({ runState: 'running' });
    mocked.db.query.taskComments.findMany.mockResolvedValue([]);
    mocked.returningFn.mockResolvedValue([{ ...existingComment, runState: 'done' }]);

    const response = await PATCH(patchRequest({ run_state: 'done' }), {
      params: Promise.resolve({ id: 'comment-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith({
      runState: null,
      runStateUpdatedAt: null,
    });
  });

  it('skips task run state sync when comment run state is unchanged', async () => {
    mocked.returningFn.mockResolvedValue([{ ...existingComment, errorMessage: 'still queued' }]);

    const response = await PATCH(
      patchRequest({ run_state: 'queued', errorMessage: 'still queued' }),
      {
        params: Promise.resolve({ id: 'comment-1' }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocked.db.query.tasks.findFirst).not.toHaveBeenCalled();
    expect(mocked.db.query.taskComments.findMany).not.toHaveBeenCalled();
  });
});
