import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn().mockResolvedValue([{ id: 'log-1', projectId: null }]);
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
  const txInsert = vi.fn().mockReturnValue({ values: valuesFn });

  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    writeAuditLog: vi.fn(),
    db: {
      query: {
        workLogs: { findMany: vi.fn() },
        projects: { findFirst: vi.fn() },
      },
      transaction: vi.fn(),
    },
    txInsert,
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

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    mocked.db.transaction(async (tx: Record<string, unknown>) =>
      callback({ ...mocked.db, ...tx, query: mocked.db.query }),
    ),
}));

import { GET, POST } from '@/app/api/work-logs/route';

function postRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/work-logs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

function getRequest(search = '') {
  return new Request(`${TEST_BASE_URL}/api/work-logs${search}`);
}

describe('app/api/work-logs/route', () => {
  beforeEach(() => {
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.db.query.workLogs.findMany.mockResolvedValue([]);
    mocked.db.query.projects.findFirst.mockResolvedValue({ id: 'project-1' });
    mocked.txReturningFn.mockResolvedValue([{ id: 'log-1', projectId: null }]);
    mocked.db.transaction.mockImplementation(async (fn: Function) => {
      const tx = { insert: mocked.txInsert };
      return fn(tx);
    });
  });

  it('GET returns work logs for owner', async () => {
    mocked.db.query.workLogs.findMany.mockResolvedValueOnce([{ id: 'log-1' }]);

    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ workLogs: [{ id: 'log-1' }] });
    expect(mocked.db.query.workLogs.findMany).toHaveBeenCalled();
  });

  it('GET paginates project work logs when projectId is provided', async () => {
    const projectId = '88e36c35-bed9-426c-af82-37c466525dd2';
    const pagedLogs = Array.from({ length: 11 }, (_, index) => ({
      id: `log-${index + 1}`,
      title: `Work log ${index + 1}`,
    }));
    mocked.db.query.workLogs.findMany.mockResolvedValueOnce(pagedLogs);

    const response = await GET(getRequest(`?projectId=${projectId}&offset=10&limit=10`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      workLogs: pagedLogs.slice(0, 10),
      nextOffset: 20,
    });
    expect(mocked.db.query.workLogs.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 11,
        offset: 10,
      }),
    );
  });

  it('POST creates work log and writes audit log', async () => {
    const response = await POST(
      postRequest({
        title: 'Did API tests',
        detail: '',
        projectId: '',
        workedAt: '',
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ workLog: { id: 'log-1', projectId: null } });

    expect(mocked.txValuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        title: 'Did API tests',
        detail: null,
        projectId: null,
        workedAt: expect.any(Date),
      }),
    );

    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'work_log.created',
        targetType: 'work_log',
        targetId: 'log-1',
      }),
      expect.anything(),
    );
  });

  it('POST returns 400 when projectId is invalid', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValueOnce(null);

    const response = await POST(
      postRequest({
        title: 'Invalid project',
        projectId: '88e36c35-bed9-426c-af82-37c466525dd2',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid projectId' });
  });

  it('POST returns 400 for invalid payload', async () => {
    const response = await POST(
      postRequest({
        title: '',
        workedAt: 'not-date',
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
      postRequest({
        title: 'Blocked',
      }),
    );

    expect(response.status).toBe(403);
  });
});
