import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn();
  const whereFn = vi.fn(() => ({ returning: returningFn }));
  const setFn = vi.fn(() => ({ where: whereFn }));
  const update = vi.fn(() => ({ set: setFn }));

  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    writeAuditLog: vi.fn(),
    update,
    setFn,
    whereFn,
    returningFn,
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

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback({ update: mocked.update }),
}));

import { POST } from '@/app/api/todos/archive-done/route';

function postRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/todos/archive-done`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

describe('app/api/todos/archive-done/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.returningFn.mockResolvedValue([{ id: 'done-1' }, { id: 'done-2' }]);
  });

  it('archives done tasks for the selected project and returns the archived count', async () => {
    const response = await POST(postRequest({ projectId: PROJECT_ID }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 2 });
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'archived',
        archivedAt: expect.any(Date),
      }),
    );
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'task.batch_archived',
        meta: expect.objectContaining({ count: 2, projectId: PROJECT_ID }),
      }),
      expect.anything(),
    );
  });

  it('archives all done tasks when no project id is provided', async () => {
    const response = await POST(postRequest({}));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 2 });
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ count: 2, projectId: null }),
      }),
      expect.anything(),
    );
  });
});
