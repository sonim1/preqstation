import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn().mockResolvedValue([
    {
      id: 'label-1',
      ownerId: 'owner-1',
      projectId: 'project-1',
      name: 'Bug',
      color: 'red',
    },
  ]);
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });

  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    writeAuditLog: vi.fn(),
    writeOutboxEventStandalone: vi.fn(),
    db: {
      query: {
        projects: { findFirst: vi.fn() },
        taskLabels: { findMany: vi.fn() },
      },
      insert: vi.fn().mockReturnValue({ values: valuesFn }),
    },
    returningFn,
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

vi.mock('@/lib/outbox', () => ({
  ENTITY_TASK_LABEL: 'task_label',
  TASK_LABEL_UPDATED: 'TASK_LABEL_UPDATED',
  writeOutboxEventStandalone: mocked.writeOutboxEventStandalone,
}));

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback(mocked.db),
}));

import { GET, POST } from '@/app/api/projects/[id]/labels/route';

function postRequest(body?: unknown) {
  return new Request(`${TEST_BASE_URL}/api/projects/project-1/labels`, {
    method: 'POST',
    headers: body
      ? {
          'content-type': 'application/json',
          origin: TEST_BASE_URL,
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('app/api/projects/[id]/labels/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.writeOutboxEventStandalone.mockResolvedValue(undefined);
    mocked.db.query.projects.findFirst.mockResolvedValue({
      id: 'project-1',
      ownerId: 'owner-1',
      projectKey: 'PROJ',
    });
    mocked.db.query.taskLabels.findMany.mockResolvedValue([
      { id: 'label-1', projectId: 'project-1', name: 'Bug', color: 'red' },
    ]);
    mocked.db.insert.mockReturnValue({ values: mocked.valuesFn });
    mocked.valuesFn.mockReturnValue({ returning: mocked.returningFn });
    mocked.returningFn.mockResolvedValue([
      {
        id: 'label-1',
        ownerId: 'owner-1',
        projectId: 'project-1',
        name: 'Bug',
        color: 'red',
      },
    ]);
  });

  it('GET returns labels only for the requested project', async () => {
    const response = await GET(new Request(`${TEST_BASE_URL}/api/projects/project-1/labels`), {
      params: Promise.resolve({ id: 'project-1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      labels: [{ id: 'label-1', projectId: 'project-1', name: 'Bug', color: 'red' }],
    });
  });

  it('POST creates a label for the requested project and writes audit log', async () => {
    const response = await POST(
      postRequest({
        name: 'Improvement',
        color: 'green',
      }),
      {
        params: Promise.resolve({ id: 'project-1' }),
      },
    );

    expect(response.status).toBe(201);
    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        projectId: 'project-1',
        name: 'Improvement',
        color: 'green',
      }),
    );
  });

  it('POST returns 404 when the requested project is not owned by the caller', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValueOnce(null);

    const response = await POST(postRequest({ name: 'Bug' }), {
      params: Promise.resolve({ id: 'missing-project' }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Project not found' });
  });
});
