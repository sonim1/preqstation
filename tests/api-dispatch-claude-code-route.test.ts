import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    writeAuditLog: vi.fn(),
    writeOutboxEventStandalone: vi.fn(),
    queueTaskExecutionByTaskKey: vi.fn(),
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

vi.mock('@/lib/outbox', () => ({
  ENTITY_TASK: 'task',
  TASK_UPDATED: 'TASK_UPDATED',
  writeOutboxEventStandalone: mocked.writeOutboxEventStandalone,
}));

vi.mock('@/lib/dispatch-request-store', () => ({
  createDispatchRequest: mocked.createDispatchRequest,
}));

vi.mock('@/lib/task-run-state', () => ({
  queueTaskExecutionByTaskKey: mocked.queueTaskExecutionByTaskKey,
}));

import { POST } from '@/app/api/dispatch/claude-code/route';

function postRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/dispatch/claude-code`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

describe('app/api/dispatch/claude-code/route', () => {
  beforeEach(() => {
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.queueTaskExecutionByTaskKey.mockResolvedValue({
      taskKey: 'PROJ-1',
      projectId: 'project-1',
    });
    mocked.createDispatchRequest.mockResolvedValue({ id: 'dispatch-request-1' });
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.writeOutboxEventStandalone.mockResolvedValue(undefined);
  });

  it('queues task execution for the Claude dispatch target', async () => {
    const response = await POST(
      postRequest({
        taskKey: 'PROJ-1',
        engine: 'codex',
        branchName: 'task/proj-1/fix-auth',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocked.queueTaskExecutionByTaskKey).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      taskKey: 'PROJ-1',
      dispatchTarget: 'claude-code-channel',
      engine: 'codex',
      branch: 'task/proj-1/fix-auth',
    });
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'dispatch.claude_code_queued',
        targetType: 'task',
        targetId: 'PROJ-1',
        meta: expect.objectContaining({
          engine: 'codex',
          branchName: 'task/proj-1/fix-auth',
          objective: 'default',
        }),
      }),
    );
    expect(mocked.createDispatchRequest).not.toHaveBeenCalled();
    expect(mocked.writeOutboxEventStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        projectId: 'project-1',
        eventType: 'TASK_UPDATED',
        entityType: 'task',
        entityId: 'PROJ-1',
        payload: {
          changedFields: ['runState', 'runStateUpdatedAt', 'dispatchTarget'],
        },
      }),
    );
  });

  it('returns 404 without downstream side effects when the task key does not resolve', async () => {
    mocked.queueTaskExecutionByTaskKey.mockResolvedValueOnce(null);

    const response = await POST(
      postRequest({
        taskKey: 'PROJ-404',
        engine: 'codex',
        objective: 'ask',
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
    expect(mocked.createDispatchRequest).not.toHaveBeenCalled();
    expect(mocked.writeOutboxEventStandalone).not.toHaveBeenCalled();
    expect(mocked.writeAuditLog).not.toHaveBeenCalled();
  });

  it('creates an explicit ask request for Claude dispatch parity', async () => {
    const response = await POST(
      postRequest({
        taskKey: 'PROJ-328',
        engine: 'claude-code',
        objective: 'ask',
        askHint: 'Acceptance criteria 중심으로 정리해줘',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocked.queueTaskExecutionByTaskKey).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      taskKey: 'PROJ-328',
      dispatchTarget: 'claude-code-channel',
      engine: 'claude-code',
      branch: null,
    });
    expect(mocked.createDispatchRequest).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      scope: 'task',
      objective: 'ask',
      projectKey: 'PROJ',
      taskKey: 'PROJ-328',
      engine: 'claude-code',
      dispatchTarget: 'claude-code-channel',
      branchName: null,
      promptMetadata: {
        askHint: 'Acceptance criteria 중심으로 정리해줘',
      },
    });
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          objective: 'ask',
        }),
      }),
    );
  });

  it('creates an explicit request for selected implement and review modes', async () => {
    const response = await POST(
      postRequest({
        taskKey: 'PROJ-328',
        engine: 'gemini-cli',
        objective: 'review',
        branchName: 'task/proj-328/review-mode',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocked.createDispatchRequest).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      scope: 'task',
      objective: 'review',
      projectKey: 'PROJ',
      taskKey: 'PROJ-328',
      engine: 'gemini-cli',
      dispatchTarget: 'claude-code-channel',
      branchName: 'task/proj-328/review-mode',
      promptMetadata: null,
    });
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          objective: 'review',
        }),
      }),
    );
  });

  it('creates an explicit request for selected plan and QA modes', async () => {
    await POST(
      postRequest({
        taskKey: 'PROJ-328',
        engine: 'codex',
        objective: 'qa',
      }),
    );

    expect(mocked.createDispatchRequest).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      scope: 'task',
      objective: 'qa',
      projectKey: 'PROJ',
      taskKey: 'PROJ-328',
      engine: 'codex',
      dispatchTarget: 'claude-code-channel',
      branchName: null,
      promptMetadata: null,
    });

    mocked.createDispatchRequest.mockClear();

    await POST(
      postRequest({
        taskKey: 'PROJ-328',
        engine: 'codex',
        objective: 'plan',
      }),
    );

    expect(mocked.createDispatchRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        objective: 'plan',
      }),
    );
  });

  it('returns 400 for invalid payload', async () => {
    const response = await POST(postRequest({ taskKey: '' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: 'Invalid payload',
        issues: expect.any(Array),
      }),
    );
  });
});
