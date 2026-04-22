import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn().mockResolvedValue([{ id: 'label-1' }]);
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
  const setFn = vi.fn().mockReturnValue({ where: whereFn });

  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    writeAuditLog: vi.fn(),
    writeOutboxEventStandalone: vi.fn(),
    db: {
      query: {
        projects: { findFirst: vi.fn() },
      },
      update: vi.fn().mockReturnValue({ set: setFn }),
      delete: vi.fn().mockReturnValue({ where: whereFn }),
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

import { DELETE, PATCH } from '@/app/api/projects/[id]/labels/[labelId]/route';

function patchRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/projects/project-1/labels/label-1`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new Request(`${TEST_BASE_URL}/api/projects/project-1/labels/label-1`, {
    method: 'DELETE',
    headers: { origin: TEST_BASE_URL },
  });
}

describe('app/api/projects/[id]/labels/[labelId]/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.writeOutboxEventStandalone.mockResolvedValue(undefined);
    mocked.db.query.projects.findFirst.mockResolvedValue({ id: 'project-1', ownerId: 'owner-1' });
    mocked.returningFn.mockResolvedValue([{ id: 'label-1' }]);
    mocked.db.update.mockReturnValue({ set: mocked.setFn });
    mocked.setFn.mockReturnValue({ where: mocked.whereFn });
    mocked.whereFn.mockReturnValue({ returning: mocked.returningFn });
    mocked.db.delete.mockReturnValue({ where: mocked.whereFn });
  });

  it('PATCH updates a label inside the requested project', async () => {
    const response = await PATCH(patchRequest({ name: 'Bug', color: 'red' }), {
      params: Promise.resolve({ id: 'project-1', labelId: 'label-1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocked.setFn).toHaveBeenCalledWith({ name: 'Bug', color: 'red' });
  });

  it('DELETE removes a label inside the requested project', async () => {
    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: 'project-1', labelId: 'label-1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('PATCH returns 404 when the requested project is not found', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValueOnce(null);

    const response = await PATCH(patchRequest({ name: 'Bug' }), {
      params: Promise.resolve({ id: 'missing-project', labelId: 'label-1' }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Project not found' });
  });
});
