import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    writeAuditLog: vi.fn(),
    createDispatchRequest: vi.fn(),
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

vi.mock('@/lib/dispatch-request-store', () => ({
  createDispatchRequest: mocked.createDispatchRequest,
}));

import { POST } from '@/app/api/dispatch/claude-code/insight/route';

function postRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/dispatch/claude-code/insight`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

describe('app/api/dispatch/claude-code/insight/route', () => {
  beforeEach(() => {
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.createDispatchRequest.mockResolvedValue({ id: 'request-1' });
    mocked.writeAuditLog.mockResolvedValue(undefined);
  });

  it('queues a project-level insight dispatch request', async () => {
    const response = await POST(
      postRequest({
        projectKey: 'PROJ',
        engine: 'claude-code',
        branchName: 'preqstation/proj',
        insightPromptB64: 'cHJvbXB0LWJhc2U2NA==',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, requestId: 'request-1' });
    expect(mocked.createDispatchRequest).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      scope: 'project',
      objective: 'insight',
      projectKey: 'PROJ',
      engine: 'claude-code',
      dispatchTarget: 'claude-code-channel',
      branchName: 'preqstation/proj',
      promptMetadata: {
        insightPromptB64: 'cHJvbXB0LWJhc2U2NA==',
      },
    });
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'dispatch.claude_code_insight_queued',
        targetType: 'project',
        targetId: 'PROJ',
        meta: expect.objectContaining({
          objective: 'insight',
          engine: 'claude-code',
          requestId: 'request-1',
        }),
      }),
    );
  });

  it('returns 400 for invalid payload', async () => {
    const response = await POST(postRequest({ projectKey: '', insightPromptB64: '' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: 'Invalid payload',
        issues: expect.any(Array),
      }),
    );
  });
});
