import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const drizzleMocked = vi.hoisted(() => ({
  gte: vi.fn((field: unknown, value: unknown) => ({ type: 'gte', field, value })),
  lt: vi.fn((field: unknown, value: unknown) => ({ type: 'lt', field, value })),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    gte: drizzleMocked.gte,
    lt: drizzleMocked.lt,
  };
});

import { taskLabelAssignments } from '@/lib/db/schema';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn().mockResolvedValue([]);
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
  const txInsert = vi.fn().mockReturnValue({ values: valuesFn });
  const txDeleteWhereFn = vi.fn();
  const txDelete = vi.fn().mockReturnValue({ where: txDeleteWhereFn });

  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    writeAuditLog: vi.fn(),
    resolveAppendSortOrder: vi.fn(),
    getUserSetting: vi.fn(),
    db: {
      query: {
        tasks: { findMany: vi.fn(), findFirst: vi.fn() },
        projects: { findFirst: vi.fn() },
        taskLabels: { findFirst: vi.fn(), findMany: vi.fn() },
      },
      transaction: vi.fn(),
    },
    txInsert,
    txDelete,
    txDeleteWhereFn,
    txValuesFn: valuesFn,
    txReturningFn: returningFn,
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

vi.mock('@/lib/task-sort-order', () => ({
  resolveAppendSortOrder: mocked.resolveAppendSortOrder,
  TASK_BOARD_ORDER: ['task-board-order'],
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

vi.mock('@/lib/user-settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/user-settings')>('@/lib/user-settings');
  return {
    ...actual,
    getUserSetting: mocked.getUserSetting,
  };
});

import { GET, POST } from '@/app/api/todos/route';

function jsonRequest(method: 'GET' | 'POST', url: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: body
      ? {
          'content-type': 'application/json',
          origin: TEST_BASE_URL,
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('app/api/todos/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T12:00:00.000Z'));
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.resolveAppendSortOrder.mockResolvedValue('a1');
    mocked.getUserSetting.mockResolvedValue('Pacific/Auckland');
    mocked.db.query.tasks.findMany.mockResolvedValue([]);
    mocked.db.query.tasks.findFirst.mockResolvedValue(null);
    mocked.db.query.projects.findFirst.mockResolvedValue({
      id: 'project-1',
      name: 'Project A',
      projectKey: 'TEST',
    });
    mocked.db.query.taskLabels.findFirst.mockResolvedValue({ id: 'label-1' });
    mocked.db.query.taskLabels.findMany.mockResolvedValue([]);

    const createdTodo = {
      id: 'todo-1',
      taskKey: 'TEST-1',
      taskPrefix: 'TEST',
      taskNumber: 1,
      projectId: 'project-1',
      labelId: null,
      taskPriority: 'none',
    };
    mocked.txReturningFn.mockResolvedValue([createdTodo]);
    mocked.db.transaction.mockImplementation(async (fn: Function) => {
      const tx = {
        insert: mocked.txInsert,
        delete: mocked.txDelete,
      };
      return fn(tx);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('GET returns todos for owner', async () => {
    mocked.db.query.tasks.findMany.mockResolvedValueOnce([{ id: 'todo-1' }]);

    const response = await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/todos`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ todos: [{ id: 'todo-1' }] });
    expect(mocked.db.query.tasks.findMany).toHaveBeenCalled();
  });

  it('GET applies today scope filter', async () => {
    await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/todos?scope=today`));

    expect(mocked.db.query.tasks.findMany).toHaveBeenCalled();
  });

  it('GET uses the saved timezone when applying the today scope filter', async () => {
    await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/todos?scope=today`));

    const [, start] = drizzleMocked.gte.mock.calls[0] ?? [];
    const [, end] = drizzleMocked.lt.mock.calls[0] ?? [];

    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);
    expect((start as Date).toISOString()).toBe('2026-03-25T11:00:00.000Z');
    expect((end as Date).toISOString()).toBe('2026-03-26T11:00:00.000Z');
  });

  it('POST creates todo and writes audit log', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValueOnce(null);
    const response = await POST(
      jsonRequest('POST', `${TEST_BASE_URL}/api/todos`, {
        title: 'Task A',
        note: '',
        projectId: '88e36c35-bed9-426c-af82-37c466525dd2',
        sortOrder: 'a1',
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toEqual(
      expect.objectContaining({
        todo: expect.objectContaining({ id: 'todo-1', taskKey: 'TEST-1', projectId: 'project-1' }),
        boardTask: expect.objectContaining({ taskKey: 'TEST-1', status: 'inbox' }),
      }),
    );
    expect(mocked.txValuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        branch: 'task/test-1/task-a',
        sortOrder: 'a1',
        taskPriority: 'none',
      }),
    );
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'task.created',
        targetType: 'task',
        targetId: 'TEST-1',
      }),
      expect.anything(),
    );
  });

  it('POST creates todo with multiple labels and syncs ordered assignments', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValueOnce(null);
    mocked.db.query.taskLabels.findMany.mockResolvedValue([
      { id: '11111111-1111-4111-8111-111111111111', name: 'Bug' },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Frontend' },
    ]);

    const response = await POST(
      jsonRequest('POST', `${TEST_BASE_URL}/api/todos`, {
        title: 'Task A',
        note: '',
        projectId: '88e36c35-bed9-426c-af82-37c466525dd2',
        labelIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
        sortOrder: 'a1',
      }),
    );

    expect(response.status).toBe(201);
    expect(mocked.txInsert).toHaveBeenNthCalledWith(2, taskLabelAssignments);
    expect(mocked.txValuesFn).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining([
        expect.objectContaining({
          taskId: 'todo-1',
          labelId: '11111111-1111-4111-8111-111111111111',
          position: 0,
        }),
        expect.objectContaining({
          taskId: 'todo-1',
          labelId: '22222222-2222-4222-8222-222222222222',
          position: 1,
        }),
      ]),
    );
  });

  it('POST uses resolveAppendSortOrder when sortOrder is omitted', async () => {
    mocked.resolveAppendSortOrder.mockResolvedValueOnce('z0');

    const response = await POST(
      jsonRequest('POST', `${TEST_BASE_URL}/api/todos`, {
        title: 'Task A',
        note: '',
        projectId: '88e36c35-bed9-426c-af82-37c466525dd2',
      }),
    );

    expect(response.status).toBe(201);
    expect(mocked.resolveAppendSortOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        client: expect.anything(),
        ownerId: 'owner-1',
        status: 'inbox',
      }),
    );
    expect(mocked.txValuesFn).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: 'z0' }));
  });

  it('POST rejects legacy labelId', async () => {
    const response = await POST(
      jsonRequest('POST', `${TEST_BASE_URL}/api/todos`, {
        title: 'Task Legacy',
        projectId: '88e36c35-bed9-426c-af82-37c466525dd2',
        labelId: '11111111-1111-4111-8111-111111111111',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'labelId is no longer supported. Use labelIds.',
    });
    expect(mocked.txValuesFn).not.toHaveBeenCalled();
  });

  it('POST uses project key prefix when project is selected', async () => {
    const createdTodo2 = {
      id: 'todo-2',
      taskKey: 'TEST-1',
      taskPrefix: 'TEST',
      taskNumber: 1,
      projectId: 'project-1',
      labelId: null,
      taskPriority: 'none',
    };
    mocked.txReturningFn.mockResolvedValueOnce([createdTodo2]);

    const response = await POST(
      jsonRequest('POST', `${TEST_BASE_URL}/api/todos`, {
        title: 'Task B',
        projectId: '88e36c35-bed9-426c-af82-37c466525dd2',
      }),
    );

    expect(response.status).toBe(201);
    expect(mocked.txValuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
      }),
    );
  });

  it('POST returns 400 when task ID fields are provided', async () => {
    const response = await POST(
      jsonRequest('POST', `${TEST_BASE_URL}/api/todos`, {
        title: 'Task A',
        taskKey: 'INF-1123',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Task ID is auto-generated and cannot be set manually.',
    });
    expect(mocked.txValuesFn).not.toHaveBeenCalled();
  });

  it('POST returns 400 when projectId is invalid for owner', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValueOnce(null);

    const response = await POST(
      jsonRequest('POST', `${TEST_BASE_URL}/api/todos`, {
        title: 'Task B',
        projectId: '88e36c35-bed9-426c-af82-37c466525dd2',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid projectId' });
  });

  it('POST rejects labelId before owner lookup', async () => {
    const response = await POST(
      jsonRequest('POST', `${TEST_BASE_URL}/api/todos`, {
        title: 'Task C',
        projectId: '88e36c35-bed9-426c-af82-37c466525dd2',
        labelId: '88e36c35-bed9-426c-af82-37c466525dd2',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'labelId is no longer supported. Use labelIds.',
    });
  });

  it('POST returns 400 when any submitted labelId is outside the selected project', async () => {
    mocked.db.query.taskLabels.findMany.mockResolvedValue([
      { id: '11111111-1111-4111-8111-111111111111', name: 'Bug' },
    ]);

    const response = await POST(
      jsonRequest('POST', `${TEST_BASE_URL}/api/todos`, {
        title: 'Task C',
        projectId: '88e36c35-bed9-426c-af82-37c466525dd2',
        labelIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid labelIds' });
    expect(mocked.txValuesFn).not.toHaveBeenCalled();
  });

  it('POST returns 400 for schema validation errors', async () => {
    const response = await POST(
      jsonRequest('POST', `${TEST_BASE_URL}/api/todos`, {
        title: '',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: 'Invalid payload',
        issues: expect.any(Array),
      }),
    );
  });

  it('POST respects same-origin guard response', async () => {
    mocked.assertSameOrigin.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid origin' }), { status: 403 }),
    );

    const response = await POST(
      jsonRequest('POST', `${TEST_BASE_URL}/api/todos`, {
        title: 'Task C',
      }),
    );

    expect(response.status).toBe(403);
  });
});
