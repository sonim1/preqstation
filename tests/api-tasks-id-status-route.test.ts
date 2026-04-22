import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn().mockResolvedValue([{ id: 'log-1' }]);
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });

  return {
    authenticateApiToken: vi.fn(),
    writeAuditLog: vi.fn(),
    safeCreateTaskCompletionNotification: vi.fn(),
    db: {
      query: {
        tasks: { findFirst: vi.fn() },
      },
      update: vi.fn().mockReturnValue({ set: setFn }),
      insert: vi.fn().mockReturnValue({ values: valuesFn }),
    },
    returningFn,
    whereFn,
    setFn,
    valuesFn,
  };
});

vi.mock('@/lib/api-tokens', () => ({
  authenticateApiToken: mocked.authenticateApiToken,
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: mocked.writeAuditLog,
}));

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback(mocked.db),
}));

vi.mock('@/lib/task-notifications', () => ({
  safeCreateTaskCompletionNotification: mocked.safeCreateTaskCompletionNotification,
}));

import { PATCH } from '@/app/api/tasks/[id]/status/route';

function patchRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/tasks/NONE-1/status`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

const existingTask = {
  id: 'todo-1',
  taskKey: 'NONE-1',
  taskPrefix: 'NONE',
  taskNumber: 1,
  title: 'Task A',
  note: null,
  status: 'ready',
  taskPriority: 'none',
  branch: null,
  engine: 'codex',
  runState: null,
  runStateUpdatedAt: null,
  projectId: null,
  createdAt: new Date('2026-02-18T00:00:00.000Z'),
  updatedAt: new Date('2026-02-18T00:00:00.000Z'),
  project: null,
  label: null,
};

describe('app/api/tasks/[id]/status/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.authenticateApiToken.mockResolvedValue({
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tokenId: 'token-1',
      tokenName: 'PREQSTATION Token',
    });
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.safeCreateTaskCompletionNotification.mockResolvedValue(null);
    // First call: existing lookup; Second call: re-fetch after update
    mocked.db.query.tasks.findFirst.mockResolvedValue(existingTask);
    mocked.returningFn.mockResolvedValue([{ id: 'log-1' }]);
    mocked.db.update.mockReturnValue({ set: mocked.setFn });
    mocked.setFn.mockReturnValue({ where: mocked.whereFn });
    mocked.whereFn.mockReturnValue({ returning: mocked.returningFn });
    mocked.db.insert.mockReturnValue({ values: mocked.valuesFn });
    mocked.valuesFn.mockReturnValue({ returning: mocked.returningFn });
  });

  it('PATCH updates status to done and writes status change events', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce(existingTask)
      .mockResolvedValueOnce({ ...existingTask, status: 'done' });

    const response = await PATCH(
      patchRequest({
        status: 'done',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'done',
      }),
    );
    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Ready -> Done'),
      }),
    );
    expect(body.task.status).toBe('done');
  });

  it('PATCH creates a notification when running work moves into done', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({ ...existingTask, runState: 'running' })
      .mockResolvedValueOnce({ ...existingTask, status: 'done', runState: null });

    const response = await PATCH(
      patchRequest({
        status: 'done',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.safeCreateTaskCompletionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        taskId: 'todo-1',
        taskKey: 'NONE-1',
        taskTitle: 'Task A',
        fromStatus: 'ready',
        toStatus: 'done',
        previousRunState: 'running',
        nextRunState: null,
      }),
    );
  });

  it('PATCH accepts archived status', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({ ...existingTask, status: 'done' })
      .mockResolvedValueOnce({ ...existingTask, status: 'archived' });

    const response = await PATCH(
      patchRequest({
        status: 'archived',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'archived',
      }),
    );
    expect(body.task.status).toBe('archived');
  });

  it('PATCH rejects review alias', async () => {
    const response = await PATCH(
      patchRequest({
        status: 'review',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: 'Invalid payload',
      }),
    );
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('PATCH rejects in_progress alias', async () => {
    const response = await PATCH(
      patchRequest({
        status: 'in_progress',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: 'Invalid payload',
      }),
    );
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('PATCH rejects non-status fields', async () => {
    const response = await PATCH(
      patchRequest({
        status: 'done',
        title: 'not-allowed',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: 'Invalid payload',
      }),
    );
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('PATCH returns 404 when task does not exist', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValueOnce(null);

    const response = await PATCH(
      patchRequest({
        status: 'done',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });
});
