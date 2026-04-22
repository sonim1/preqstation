import { beforeEach, describe, expect, it, vi } from 'vitest';

import { taskLabelAssignments, workLogs } from '@/lib/db/schema';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn().mockResolvedValue([{ id: 'todo-uuid-1' }]);
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
  const txWhereFn = vi.fn().mockReturnValue({ returning: returningFn });
  const txSetFn = vi.fn().mockReturnValue({ where: txWhereFn });
  const txInsertValuesFn = vi.fn().mockReturnValue({ returning: returningFn });
  const txLabelAssignmentValuesFn = vi.fn().mockReturnValue({ returning: returningFn });
  const txWorkLogValuesFn = vi.fn().mockReturnValue({ returning: returningFn });
  const txDeleteWhereFn = vi.fn();
  const txDelete = vi.fn().mockReturnValue({ where: txDeleteWhereFn });
  const txInsert = vi.fn((table: unknown) => {
    if (table === taskLabelAssignments) {
      return { values: txLabelAssignmentValuesFn };
    }
    if (table === workLogs) {
      return { values: txWorkLogValuesFn };
    }
    return { values: txInsertValuesFn };
  });
  const txUpdate = vi.fn().mockReturnValue({ set: txSetFn });

  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    writeAuditLog: vi.fn(),
    safeCreateTaskCompletionNotification: vi.fn(),
    db: {
      query: {
        tasks: { findFirst: vi.fn(), findMany: vi.fn() },
        projects: { findFirst: vi.fn() },
        taskLabels: { findFirst: vi.fn(), findMany: vi.fn() },
      },
      insert: vi.fn().mockReturnValue({ values: valuesFn }),
      update: vi.fn().mockReturnValue({ set: setFn }),
      delete: vi.fn().mockReturnValue({ where: whereFn }),
      transaction: vi.fn(),
    },
    returningFn,
    whereFn,
    setFn,
    valuesFn,
    txWhereFn,
    txSetFn,
    txInsertValuesFn,
    txLabelAssignmentValuesFn,
    txWorkLogValuesFn,
    txDeleteWhereFn,
    txDelete,
    txInsert,
    txUpdate,
  };
});

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/request-security', () => ({
  assertSameOrigin: mocked.assertSameOrigin,
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: mocked.writeAuditLog,
}));

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    mocked.db.transaction(async (tx: Record<string, unknown>) =>
      callback({ ...mocked.db, ...tx, query: mocked.db.query }),
    ),
}));

vi.mock('@/lib/task-notifications', () => ({
  safeCreateTaskCompletionNotification: mocked.safeCreateTaskCompletionNotification,
}));

import { DELETE, GET, PATCH } from '@/app/api/todos/[id]/route';

function patchRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/todos/todo-1`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new Request(`${TEST_BASE_URL}/api/todos/todo-1`, {
    method: 'DELETE',
    headers: { origin: TEST_BASE_URL },
  });
}

const existingTask = {
  id: 'todo-uuid-1',
  taskKey: 'NONE-1',
  title: 'Task A',
  status: 'todo',
  sortOrder: 'a0',
  taskPriority: 'none',
  projectId: 'project-1',
  labelId: 'label-1',
  dueAt: null,
  focusedAt: null,
  engine: null,
  project: { name: 'Project A' },
  label: { name: 'Label A' },
};

describe('app/api/todos/[id]/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.safeCreateTaskCompletionNotification.mockResolvedValue(null);
    mocked.db.query.tasks.findFirst.mockResolvedValue(existingTask);
    mocked.db.query.tasks.findMany.mockResolvedValue([]);
    mocked.db.query.projects.findFirst.mockResolvedValue({ id: 'project-1', name: 'Project A' });
    mocked.db.query.taskLabels.findFirst.mockResolvedValue({ id: 'label-1', name: 'Label A' });
    mocked.db.query.taskLabels.findMany.mockResolvedValue([]);
    // update(...).set(...).where(...).returning() returns array of updated rows
    mocked.returningFn.mockResolvedValue([{ id: 'todo-uuid-1' }]);
    mocked.db.insert.mockReturnValue({ values: mocked.valuesFn });
    mocked.valuesFn.mockReturnValue({ returning: mocked.returningFn });
    mocked.db.update.mockReturnValue({ set: mocked.setFn });
    mocked.setFn.mockReturnValue({ where: mocked.whereFn });
    mocked.whereFn.mockReturnValue({ returning: mocked.returningFn });
    mocked.txUpdate.mockReturnValue({ set: mocked.txSetFn });
    mocked.txSetFn.mockReturnValue({ where: mocked.txWhereFn });
    mocked.txWhereFn.mockReturnValue({ returning: mocked.returningFn });
    mocked.txInsert.mockImplementation((table: unknown) => {
      if (table === taskLabelAssignments) {
        return { values: mocked.txLabelAssignmentValuesFn };
      }
      if (table === workLogs) {
        return { values: mocked.txWorkLogValuesFn };
      }
      return { values: mocked.txInsertValuesFn };
    });
    mocked.txInsertValuesFn.mockReturnValue({ returning: mocked.returningFn });
    mocked.txLabelAssignmentValuesFn.mockReturnValue({ returning: mocked.returningFn });
    mocked.txWorkLogValuesFn.mockReturnValue({ returning: mocked.returningFn });
    mocked.txDelete.mockReturnValue({ where: mocked.txDeleteWhereFn });
    mocked.db.transaction.mockImplementation(async (fn: Function) => {
      const tx = {
        delete: mocked.txDelete,
        insert: mocked.txInsert,
        update: mocked.txUpdate,
      };
      return fn(tx);
    });
  });

  it('PATCH updates status and sortOrder', async () => {
    const response = await PATCH(patchRequest({ status: 'done', sortOrder: 'b00' }), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        ok: true,
        boardTask: expect.objectContaining({ taskKey: 'NONE-1', status: 'done' }),
        focusedTask: expect.objectContaining({ taskKey: 'NONE-1', status: 'done' }),
      }),
    );
    expect(mocked.db.transaction).toHaveBeenCalled();
    expect(mocked.txSetFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'done', sortOrder: 'b00' }),
    );
    expect(mocked.txInsert).toHaveBeenCalled();
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'task.updated',
        targetType: 'task',
        targetId: 'NONE-1',
      }),
      expect.anything(),
    );
  });

  it('GET returns focused task detail for targeted drawer refresh', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValueOnce({
      ...existingTask,
      branch: 'task/proj-255/justand-sayong',
      note: '## Detail',
      runState: null,
      runStateUpdatedAt: null,
      labelAssignments: [],
      workLogs: [
        {
          id: 'log-1',
          title: 'Updated task',
          detail: 'detail',
          engine: null,
          workedAt: new Date('2026-03-24T00:00:00.000Z'),
          createdAt: new Date('2026-03-24T00:00:00.000Z'),
          task: { engine: null },
        },
      ],
    });

    const response = await GET(new Request(`${TEST_BASE_URL}/api/todos/todo-1`), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      todo: expect.objectContaining({
        taskKey: 'NONE-1',
        note: '## Detail',
        workLogs: [
          expect.objectContaining({
            id: 'log-1',
            workedAt: '2026-03-24T00:00:00.000Z',
            createdAt: '2026-03-24T00:00:00.000Z',
          }),
        ],
      }),
    });
    expect(body.todo.workLogs[0]).not.toHaveProperty('detail');
    expect(typeof body.todo.workLogs[0]?.workedAt).toBe('string');
    expect(typeof body.todo.workLogs[0]?.createdAt).toBe('string');
  });

  it('PATCH accepts hold status', async () => {
    const response = await PATCH(patchRequest({ status: 'hold', sortOrder: 'a5' }), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocked.txSetFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'hold', sortOrder: 'a5' }),
    );
  });

  it('PATCH accepts inbox status', async () => {
    const response = await PATCH(patchRequest({ status: 'inbox', sortOrder: 'a3' }), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocked.txSetFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'inbox', sortOrder: 'a3' }),
    );
  });

  it('PATCH repairs an unsafe target lane before saving a move', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      ...existingTask,
      status: 'todo',
      sortOrder: 'a0',
    });
    mocked.db.query.tasks.findMany
      .mockResolvedValueOnce([
        {
          id: 'done-1',
          sortOrder: 'a0',
          dueAt: new Date('2026-04-02T00:00:00.000Z'),
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
        },
        {
          id: 'done-2',
          sortOrder: 'a0',
          dueAt: new Date('2026-04-03T00:00:00.000Z'),
          createdAt: new Date('2026-04-02T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([]);

    const response = await PATCH(patchRequest({ status: 'done', sortOrder: 'a0' }), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocked.txSetFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'done',
        sortOrder: expect.any(String),
      }),
    );
    expect((await response.json()).boardTask.sortOrder).not.toBe('a0');
  });

  it('PATCH restore returns the server-resolved sortOrder instead of the client candidate', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      ...existingTask,
      status: 'archived',
      archivedAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    mocked.db.query.tasks.findMany
      .mockResolvedValueOnce([
        {
          id: 'todo-2',
          sortOrder: 'a0',
          dueAt: new Date('2026-04-02T00:00:00.000Z'),
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([]);

    const response = await PATCH(
      patchRequest({ status: 'todo', sortOrder: 'client-preview-key' }),
      { params: Promise.resolve({ id: 'todo-1' }) },
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.boardTask.archivedAt).toBeNull();
    expect(body.boardTask.sortOrder).not.toBe('client-preview-key');
  });

  it('PATCH clears engine when a manual status change is saved', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      ...existingTask,
      engine: 'codex',
      status: 'todo',
    });

    const response = await PATCH(patchRequest({ status: 'done', sortOrder: 'b00' }), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocked.txSetFn).toHaveBeenCalledWith(expect.objectContaining({ engine: null }));
    expect(mocked.txWorkLogValuesFn).toHaveBeenCalledWith(
      expect.objectContaining({ engine: null }),
    );
  });

  it('PATCH creates a notification when running work moves into done', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      ...existingTask,
      runState: 'running',
      runStateUpdatedAt: new Date('2026-02-18T00:00:00.000Z'),
    });

    const response = await PATCH(patchRequest({ status: 'done', sortOrder: 'b00' }), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocked.safeCreateTaskCompletionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        taskId: 'todo-uuid-1',
        taskKey: 'NONE-1',
        taskTitle: 'Task A',
        fromStatus: 'todo',
        toStatus: 'done',
        previousRunState: 'running',
        nextRunState: null,
      }),
    );
  });

  it('PATCH keeps engine untouched for sortOrder-only reorders', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      ...existingTask,
      engine: 'codex',
    });

    const response = await PATCH(patchRequest({ sortOrder: 'b00' }), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocked.txSetFn).toHaveBeenCalledWith(expect.not.objectContaining({ engine: null }));
  });

  it('PATCH returns 400 when taskKey update is requested', async () => {
    const response = await PATCH(patchRequest({ taskKey: 'INF-1123' }), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Task ID is auto-generated and cannot be edited.',
    });
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('PATCH retries once on transient connection error', async () => {
    mocked.txWhereFn
      .mockImplementationOnce(() => {
        throw new Error('connection closed');
      })
      .mockReturnValue({ returning: mocked.returningFn });

    const response = await PATCH(patchRequest({ status: 'archived', sortOrder: 'c00' }), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocked.db.transaction).toHaveBeenCalledTimes(2);
    expect(mocked.txUpdate).toHaveBeenCalledTimes(2);
  });

  it('PATCH retries a cross-column move when the status work-log insert hits a transient connection error', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      ...existingTask,
      status: 'todo',
      engine: 'codex',
    });
    mocked.txWorkLogValuesFn
      .mockImplementationOnce(() => {
        throw new Error('connection closed');
      })
      .mockReturnValue({ returning: mocked.returningFn });

    const response = await PATCH(patchRequest({ status: 'ready', sortOrder: 'b00' }), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(200);
    expect(mocked.db.transaction).toHaveBeenCalledTimes(2);
  });

  it('PATCH returns 404 when todo does not exist', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValueOnce(null);

    const response = await PATCH(patchRequest({ status: 'done' }), {
      params: Promise.resolve({ id: 'missing-id' }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('PATCH returns 400 for invalid payload', async () => {
    const response = await PATCH(patchRequest({ status: 'invalid-status' }), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: 'Invalid payload',
        issues: expect.any(Array),
      }),
    );
  });

  it('PATCH supports empty payload without DB update', async () => {
    const response = await PATCH(patchRequest({}), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('PATCH returns 409 for priority constraint violations', async () => {
    mocked.txWhereFn.mockImplementationOnce(() => {
      throw new Error('violates check constraint "tasks_priority_check"');
    });

    const response = await PATCH(patchRequest({ status: 'done' }), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('priority'),
      }),
    );
  });

  it('PATCH returns 409 for status constraint violations', async () => {
    mocked.txWhereFn.mockImplementationOnce(() => {
      throw new Error('violates check constraint "tasks_status_check"');
    });

    const response = await PATCH(patchRequest({ status: 'archived' }), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('status'),
      }),
    );
  });

  it('PATCH returns 400 when projectId is invalid for owner', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValueOnce(null);

    const response = await PATCH(
      patchRequest({
        projectId: '88e36c35-bed9-426c-af82-37c466525dd2',
      }),
      { params: Promise.resolve({ id: 'todo-1' }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid projectId' });
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('PATCH returns 400 when attempting to move the task to another project', async () => {
    const response = await PATCH(
      patchRequest({
        projectId: '88e36c35-bed9-426c-af82-37c466525dd2',
      }),
      { params: Promise.resolve({ id: 'todo-1' }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Project changes are not supported.' });
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('PATCH rejects legacy labelId', async () => {
    const response = await PATCH(
      patchRequest({
        labelId: '88e36c35-bed9-426c-af82-37c466525dd2',
      }),
      { params: Promise.resolve({ id: 'todo-1' }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'labelId is no longer supported. Use labelIds.',
    });
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('PATCH replaces labels when labelIds are submitted', async () => {
    mocked.db.query.taskLabels.findMany.mockResolvedValue([
      { id: '11111111-1111-4111-8111-111111111111', name: 'Label A', color: 'red' },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Label B', color: 'blue' },
    ]);

    const response = await PATCH(
      patchRequest({
        labelIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
      }),
      { params: Promise.resolve({ id: 'todo-1' }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        boardTask: expect.objectContaining({
          labels: [
            { id: '11111111-1111-4111-8111-111111111111', name: 'Label A', color: 'red' },
            { id: '22222222-2222-4222-8222-222222222222', name: 'Label B', color: 'blue' },
          ],
        }),
        focusedTask: expect.objectContaining({
          labels: [
            { id: '11111111-1111-4111-8111-111111111111', name: 'Label A', color: 'red' },
            { id: '22222222-2222-4222-8222-222222222222', name: 'Label B', color: 'blue' },
          ],
          labelIds: [
            '11111111-1111-4111-8111-111111111111',
            '22222222-2222-4222-8222-222222222222',
          ],
        }),
      }),
    );
    expect(mocked.db.transaction).toHaveBeenCalled();
    expect(mocked.txInsert).toHaveBeenCalledWith(taskLabelAssignments);
    expect(mocked.txLabelAssignmentValuesFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: 'todo-uuid-1',
          labelId: '11111111-1111-4111-8111-111111111111',
          position: 0,
        }),
        expect.objectContaining({
          taskId: 'todo-uuid-1',
          labelId: '22222222-2222-4222-8222-222222222222',
          position: 1,
        }),
      ]),
    );
  });

  it('PATCH clears all labels when an empty labelIds array is submitted', async () => {
    const response = await PATCH(
      patchRequest({
        labelIds: [],
      }),
      { params: Promise.resolve({ id: 'todo-1' }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        boardTask: expect.objectContaining({ labels: [] }),
        focusedTask: expect.objectContaining({ labels: [], labelIds: [] }),
      }),
    );
    expect(mocked.db.transaction).toHaveBeenCalled();
    expect(mocked.txDelete).toHaveBeenCalled();
  });

  it('PATCH returns 400 when any submitted labelId is outside the task project', async () => {
    mocked.db.query.taskLabels.findMany.mockResolvedValue([
      { id: '11111111-1111-4111-8111-111111111111', name: 'Label A' },
    ]);

    const response = await PATCH(
      patchRequest({
        labelIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
      }),
      { params: Promise.resolve({ id: 'todo-1' }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid labelIds' });
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('PATCH respects same-origin guard response', async () => {
    mocked.assertSameOrigin.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid origin' }), { status: 403 }),
    );

    const response = await PATCH(patchRequest({ status: 'done' }), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(403);
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('DELETE removes todo and writes audit log', async () => {
    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, taskKey: 'NONE-1' });
    expect(mocked.db.transaction).toHaveBeenCalled();
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'task.deleted',
        targetType: 'task',
        targetId: 'todo-1',
      }),
      expect.anything(),
    );
  });

  it('DELETE returns 404 when todo does not exist', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValueOnce(null);

    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: 'missing-id' }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('DELETE respects same-origin guard response', async () => {
    mocked.assertSameOrigin.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid origin' }), { status: 403 }),
    );

    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: 'todo-1' }),
    });

    expect(response.status).toBe(403);
  });
});
