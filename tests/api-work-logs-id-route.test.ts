import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn().mockResolvedValue([{ id: 'log-1' }]);
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  const valuesFn = vi.fn().mockResolvedValue(undefined);

  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    writeAuditLog: vi.fn(),
    db: {
      query: {
        workLogs: { findFirst: vi.fn() },
        projects: { findFirst: vi.fn() },
      },
      update: vi.fn().mockReturnValue({ set: setFn }),
      delete: vi.fn().mockReturnValue({ where: whereFn }),
      insert: vi.fn().mockReturnValue({ values: valuesFn }),
      transaction: vi.fn(),
    },
    returningFn,
    whereFn,
    setFn,
    valuesFn,
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
    mocked.db.transaction(async () => callback(mocked.db)),
}));

import { DELETE, GET, PATCH } from '@/app/api/work-logs/[id]/route';

function patchRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/work-logs/log-1`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new Request(`${TEST_BASE_URL}/api/work-logs/log-1`, {
    method: 'DELETE',
    headers: { origin: TEST_BASE_URL },
  });
}

function getRequest() {
  return new Request(`${TEST_BASE_URL}/api/work-logs/log-1`);
}

describe('app/api/work-logs/[id]/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.db.query.projects.findFirst.mockResolvedValue({ id: 'project-1' });
    mocked.db.query.workLogs.findFirst.mockResolvedValue({ id: 'log-1', projectId: null });
    mocked.returningFn.mockResolvedValue([{ id: 'log-1' }]);
    mocked.db.update.mockReturnValue({ set: mocked.setFn });
    mocked.setFn.mockReturnValue({ where: mocked.whereFn });
    mocked.whereFn.mockReturnValue({ returning: mocked.returningFn });
    mocked.db.delete.mockReturnValue({ where: mocked.whereFn });
    mocked.db.insert.mockReturnValue({ values: mocked.valuesFn });
    mocked.valuesFn.mockResolvedValue(undefined);
    mocked.db.transaction.mockImplementation(async (fn: Function) => {
      const txValuesFn = vi.fn().mockResolvedValue(undefined);
      const tx = {
        delete: vi.fn().mockReturnValue({ where: vi.fn() }),
        insert: vi.fn().mockReturnValue({ values: txValuesFn }),
      };
      return fn(tx);
    });
  });

  it('GET returns a single work log detail for lazy loading', async () => {
    mocked.db.query.workLogs.findFirst.mockResolvedValueOnce({
      id: 'log-1',
      title: 'PROJ-8 · Note Updated',
      detail: 'note detail',
    });

    const response = await GET(getRequest(), {
      params: Promise.resolve({ id: 'log-1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      workLog: {
        id: 'log-1',
        title: 'PROJ-8 · Note Updated',
        detail: 'note detail',
      },
    });
  });

  it('PATCH updates work log and writes audit log', async () => {
    const response = await PATCH(
      patchRequest({
        title: 'Updated',
        detail: '',
        projectId: '',
        workedAt: '',
      }),
      {
        params: Promise.resolve({ id: 'log-1' }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Updated',
        detail: null,
        projectId: null,
        workedAt: expect.any(Date),
      }),
    );

    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'work_log.updated',
        targetType: 'work_log',
        targetId: 'log-1',
      }),
      expect.anything(),
    );
  });

  it('PATCH returns 400 when projectId is invalid', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValueOnce(null);

    const response = await PATCH(
      patchRequest({
        projectId: '88e36c35-bed9-426c-af82-37c466525dd2',
      }),
      {
        params: Promise.resolve({ id: 'log-1' }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid projectId' });
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('PATCH returns 404 when work log does not exist', async () => {
    mocked.returningFn.mockResolvedValueOnce([]);

    const response = await PATCH(
      patchRequest({
        title: 'Missing',
      }),
      {
        params: Promise.resolve({ id: 'missing-id' }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('PATCH returns 400 for invalid payload', async () => {
    const response = await PATCH(
      patchRequest({
        workedAt: 'not-date',
      }),
      {
        params: Promise.resolve({ id: 'log-1' }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: 'Invalid payload',
        issues: expect.any(Array),
      }),
    );
  });

  it('PATCH respects same-origin guard response', async () => {
    mocked.assertSameOrigin.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid origin' }), { status: 403 }),
    );

    const response = await PATCH(
      patchRequest({
        title: 'Blocked',
      }),
      {
        params: Promise.resolve({ id: 'log-1' }),
      },
    );

    expect(response.status).toBe(403);
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('DELETE removes work log and writes audit log', async () => {
    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: 'log-1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocked.db.transaction).toHaveBeenCalled();
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'work_log.deleted',
        targetType: 'work_log',
        targetId: 'log-1',
      }),
      expect.anything(),
    );
  });

  it('DELETE returns 404 when work log does not exist', async () => {
    mocked.db.query.workLogs.findFirst.mockResolvedValueOnce(null);

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
      params: Promise.resolve({ id: 'log-1' }),
    });

    expect(response.status).toBe(403);
  });
});
