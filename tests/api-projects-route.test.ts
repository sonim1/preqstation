import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn().mockResolvedValue([
    {
      id: 'project-1',
      name: 'Project A',
      projectKey: 'PROJ',
    },
  ]);
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });

  return {
    authenticateApiToken: vi.fn(),
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    writeAuditLog: vi.fn(),
    db: {
      query: {
        projects: { findMany: vi.fn(), findFirst: vi.fn() },
      },
      insert: vi.fn().mockReturnValue({ values: valuesFn }),
    },
    returningFn,
    valuesFn,
  };
});

vi.mock('@/lib/api-tokens', () => ({
  authenticateApiToken: mocked.authenticateApiToken,
}));

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
    callback(mocked.db),
}));

import { GET, POST } from '@/app/api/projects/route';

function getRequest() {
  return new Request(`${TEST_BASE_URL}/api/projects`, {
    method: 'GET',
    headers: {
      authorization: 'Bearer preq_test_token',
    },
  });
}

function postRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

describe('app/api/projects/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.authenticateApiToken.mockResolvedValue(null);
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.db.query.projects.findMany.mockResolvedValue([]);
    mocked.db.query.projects.findFirst.mockResolvedValue(null);
    mocked.returningFn.mockResolvedValue([
      {
        id: 'project-1',
        name: 'Project A',
        projectKey: 'PROJ',
      },
    ]);
    mocked.db.insert.mockReturnValue({ values: mocked.valuesFn });
    mocked.valuesFn.mockReturnValue({ returning: mocked.returningFn });
  });

  it('GET returns projects for owner', async () => {
    mocked.db.query.projects.findMany.mockResolvedValueOnce([{ id: 'project-1' }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ projects: [{ id: 'project-1' }] });
    expect(mocked.db.query.projects.findMany).toHaveBeenCalled();
  });

  it('GET accepts API bearer auth for MCP callers', async () => {
    mocked.authenticateApiToken.mockResolvedValueOnce({
      ownerId: 'owner-api',
      ownerEmail: 'owner@example.com',
      tokenId: 'token-1',
      tokenName: 'MCP OAuth',
    });
    mocked.db.query.projects.findMany.mockResolvedValueOnce([{ id: 'project-1' }]);

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ projects: [{ id: 'project-1' }] });
    expect(mocked.requireOwnerUser).not.toHaveBeenCalled();
    expect(mocked.db.query.projects.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.anything(),
      }),
    );
  });

  it('POST creates project and writes audit log', async () => {
    const response = await POST(
      postRequest({
        name: 'Project A',
        description: '',
        repoUrl: '',
        vercelUrl: '',
        priority: 5,
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      project: { id: 'project-1', name: 'Project A', projectKey: 'PROJ' },
    });

    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        projectKey: 'PROJ',
        name: 'Project A',
        description: null,
        repoUrl: null,
        vercelUrl: null,
        priority: 5,
      }),
    );

    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'project.created',
        targetType: 'project',
        targetId: 'project-1',
        meta: expect.objectContaining({ projectKey: 'PROJ' }),
      }),
      expect.anything(),
    );
  });

  it('POST accepts manual projectKey', async () => {
    mocked.returningFn.mockResolvedValueOnce([
      {
        id: 'project-1',
        name: 'Project A',
        projectKey: 'AB12',
      },
    ]);

    const response = await POST(
      postRequest({
        name: 'Project A',
        projectKey: 'ab12',
      }),
    );

    expect(response.status).toBe(201);
    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        projectKey: 'AB12',
      }),
    );
  });

  it('POST uses default priority when omitted', async () => {
    await POST(
      postRequest({
        name: 'Project A',
      }),
    );

    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: 2,
      }),
    );
  });

  it('POST returns 409 when manual projectKey already exists', async () => {
    // isProjectKeyTaken calls db.query.projects.findFirst internally via the mocked module
    // But the source code uses isProjectKeyTaken which is in project-key.ts
    // We need to mock it differently - the source uses isProjectKeyTaken from project-key module
    // Let me check... the source does: if (await isProjectKeyTaken(owner.id, projectKey))
    // isProjectKeyTaken likely calls db.query.projects.findFirst
    // Since we mock @/lib/db, isProjectKeyTaken will use our mocked db
    mocked.db.query.projects.findFirst.mockResolvedValueOnce({ id: 'project-existing' });

    const response = await POST(
      postRequest({
        name: 'Project A',
        projectKey: 'AB12',
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Project key already exists.' });
    expect(mocked.db.insert).not.toHaveBeenCalled();
  });

  it('POST returns 400 for invalid payload', async () => {
    const response = await POST(
      postRequest({
        name: '',
        priority: 99,
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
        name: 'Project A',
      }),
    );

    expect(response.status).toBe(403);
    expect(mocked.db.insert).not.toHaveBeenCalled();
  });
});
