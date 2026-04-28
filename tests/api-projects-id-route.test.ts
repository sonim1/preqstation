import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn().mockResolvedValue([{ id: 'project-1' }]);
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
  const setFn = vi.fn().mockReturnValue({ where: whereFn });

  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    writeAuditLog: vi.fn(),
    writeOutboxEvent: vi.fn(),
    setProjectSetting: vi.fn(),
    db: {
      query: {
        projects: { findFirst: vi.fn() },
      },
      update: vi.fn().mockReturnValue({ set: setFn }),
    },
    returningFn,
    whereFn,
    setFn,
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

vi.mock('@/lib/outbox', () => ({
  ENTITY_PROJECT: 'project',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  writeOutboxEvent: mocked.writeOutboxEvent,
}));

vi.mock('@/lib/project-settings', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/project-settings')>('@/lib/project-settings');
  return {
    ...actual,
    setProjectSetting: mocked.setProjectSetting,
  };
});

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback(mocked.db),
}));

import { PATCH } from '@/app/api/projects/[id]/route';

function patchRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/projects/project-1`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

describe('app/api/projects/[id]/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.writeOutboxEvent.mockResolvedValue(undefined);
    mocked.setProjectSetting.mockResolvedValue(undefined);
    mocked.db.query.projects.findFirst.mockResolvedValue({ id: 'project-1', projectKey: 'PROJ' });
    mocked.returningFn.mockResolvedValue([{ id: 'project-1' }]);
    mocked.db.update.mockReturnValue({ set: mocked.setFn });
    mocked.setFn.mockReturnValue({ where: mocked.whereFn });
    mocked.whereFn.mockReturnValue({ returning: mocked.returningFn });
  });

  it('PATCH updates project and writes audit log', async () => {
    const response = await PATCH(
      patchRequest({
        name: 'Project Renamed',
        description: '',
        repoUrl: '',
        vercelUrl: '',
        priority: 3,
        status: 'paused',
      }),
      {
        params: Promise.resolve({ id: 'project-1' }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Project Renamed',
        description: null,
        repoUrl: null,
        vercelUrl: null,
        priority: 3,
        status: 'paused',
      }),
    );

    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'project.updated',
        targetType: 'project',
        targetId: 'project-1',
        meta: expect.objectContaining({ projectKey: 'PROJ' }),
      }),
      expect.anything(),
    );
    expect(mocked.writeOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        projectId: 'project-1',
        eventType: 'PROJECT_UPDATED',
        entityType: 'project',
        entityId: 'PROJ',
      }),
    );
  });

  it('PATCH returns 404 when project does not exist', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValueOnce(null);

    const response = await PATCH(patchRequest({ name: 'Nope' }), {
      params: Promise.resolve({ id: 'missing-id' }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('PATCH returns 400 for invalid payload', async () => {
    const response = await PATCH(
      patchRequest({
        status: 'archived',
      }),
      {
        params: Promise.resolve({ id: 'project-1' }),
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

  it('PATCH accepts preset background ids', async () => {
    const response = await PATCH(
      patchRequest({
        bgImage: 'mountains',
      }),
      {
        params: Promise.resolve({ id: 'project-1' }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        bgImage: 'mountains',
      }),
    );
  });

  it('PATCH rejects invalid background image values', async () => {
    const response = await PATCH(
      patchRequest({
        bgImage: 'javascript:alert(1)',
      }),
      {
        params: Promise.resolve({ id: 'project-1' }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: 'Invalid payload',
        issues: expect.any(Array),
      }),
    );
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('PATCH returns 400 when projectKey edit is requested', async () => {
    const response = await PATCH(
      patchRequest({
        projectKey: 'TEST',
      }),
      {
        params: Promise.resolve({ id: 'project-1' }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Project key is immutable and cannot be edited.',
    });
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('PATCH respects same-origin guard response', async () => {
    mocked.assertSameOrigin.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid origin' }), { status: 403 }),
    );

    const response = await PATCH(patchRequest({ name: 'Blocked' }), {
      params: Promise.resolve({ id: 'project-1' }),
    });

    expect(response.status).toBe(403);
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('PATCH supports project settings payload', async () => {
    const response = await PATCH(
      patchRequest({
        settings: {
          deploy_strategy: 'feature_branch',
          deploy_default_branch: 'main',
          deploy_auto_pr: 'false',
          deploy_commit_on_review: 'true',
        },
      }),
      {
        params: Promise.resolve({ id: 'project-1' }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocked.setProjectSetting).toHaveBeenCalledTimes(4);
    expect(mocked.setProjectSetting).toHaveBeenCalledWith(
      'project-1',
      'deploy_strategy',
      'feature_branch',
      expect.anything(),
    );
    expect(mocked.setProjectSetting).toHaveBeenCalledWith(
      'project-1',
      'deploy_default_branch',
      'main',
      expect.anything(),
    );
    expect(mocked.setProjectSetting).toHaveBeenCalledWith(
      'project-1',
      'deploy_auto_pr',
      'false',
      expect.anything(),
    );
    expect(mocked.setProjectSetting).toHaveBeenCalledWith(
      'project-1',
      'deploy_commit_on_review',
      'true',
      expect.anything(),
    );
  });

  it('PATCH coerces legacy none deploy strategy values before saving settings', async () => {
    const response = await PATCH(
      patchRequest({
        settings: {
          deploy_strategy: 'none',
        },
      }),
      {
        params: Promise.resolve({ id: 'project-1' }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocked.setProjectSetting).toHaveBeenCalledTimes(1);
    expect(mocked.setProjectSetting).toHaveBeenCalledWith(
      'project-1',
      'deploy_strategy',
      'direct_commit',
      expect.anything(),
    );
  });
});
