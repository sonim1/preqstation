import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn();
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });

  return {
    authenticateApiToken: vi.fn(),
    assertSameOrigin: vi.fn(),
    decryptTelegramToken: vi.fn(),
    getUserSettings: vi.fn(),
    resolveTelegramDispatchConfig: vi.fn(),
    sendTelegramMessage: vi.fn(),
    writeAuditLog: vi.fn(),
    db: {
      query: {
        tasks: { findFirst: vi.fn() },
        taskComments: { findMany: vi.fn() },
      },
      insert: vi.fn().mockReturnValue({ values: valuesFn }),
      update: vi.fn(),
      transaction: vi.fn(),
    },
    returningFn,
    valuesFn,
  };
});

vi.mock('@/lib/api-tokens', () => ({ authenticateApiToken: mocked.authenticateApiToken }));
vi.mock('@/lib/audit', () => ({ writeAuditLog: mocked.writeAuditLog }));
vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: typeof mocked.db) => unknown) =>
    callback(mocked.db),
}));
vi.mock('@/lib/owner', () => ({ requireOwnerUser: vi.fn() }));
vi.mock('@/lib/request-security', () => ({ assertSameOrigin: mocked.assertSameOrigin }));
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: mocked.sendTelegramMessage }));
vi.mock('@/lib/telegram-crypto', () => ({ decryptTelegramToken: mocked.decryptTelegramToken }));
vi.mock('@/lib/telegram-dispatch-settings', () => ({
  resolveTelegramDispatchConfig: mocked.resolveTelegramDispatchConfig,
}));
vi.mock('@/lib/user-settings', () => ({ getUserSettings: mocked.getUserSettings }));

import { POST } from '@/app/api/tasks/[id]/comments/route';

function postRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/tasks/PQST-74/comments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('app/api/tasks/[id]/comments/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.authenticateApiToken.mockResolvedValue({
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tokenId: 'token-1',
      tokenName: 'PREQSTATION Token',
    });
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      projectId: 'project-1',
      taskKey: 'PQST-74',
      taskPrefix: 'PQST',
      status: 'todo',
      branch: 'task/pqst-74/comment-is-not-wroking',
      engine: 'codex',
      dispatchTarget: 'hermes-telegram',
    });
    mocked.returningFn.mockResolvedValue([
      {
        id: 'comment-1',
        ownerId: 'owner-1',
        projectId: 'project-1',
        taskId: 'task-1',
        parentCommentId: null,
        authorType: 'user',
        authorName: 'owner@example.com',
        body: '댓글 확인해주세요',
        runState: 'queued',
        runStateUpdatedAt: new Date('2026-05-06T15:00:00.000Z'),
        engine: 'codex',
        dispatchTarget: 'hermes-telegram',
        errorMessage: null,
        metadata: null,
        createdAt: new Date('2026-05-06T15:00:00.000Z'),
        updatedAt: new Date('2026-05-06T15:00:00.000Z'),
      },
    ]);
    mocked.getUserSettings.mockResolvedValue({});
    mocked.resolveTelegramDispatchConfig.mockReturnValue({
      enabled: true,
      encryptedToken: 'encrypted-token',
      chatId: '12345',
    });
    mocked.decryptTelegramToken.mockResolvedValue('bot-token');
    mocked.sendTelegramMessage.mockResolvedValue({ ok: true });
    mocked.writeAuditLog.mockResolvedValue(undefined);
  });

  it('queues a dispatched comment and sends Hermes Telegram by default', async () => {
    const response = await POST(postRequest({ body: '댓글 확인해주세요' }), {
      params: Promise.resolve({ id: 'PQST-74' }),
    });

    expect(response.status).toBe(201);
    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        runState: 'queued',
        engine: 'codex',
        dispatchTarget: 'hermes-telegram',
      }),
    );
    expect(mocked.resolveTelegramDispatchConfig).toHaveBeenCalledWith({}, 'hermes');
    expect(mocked.sendTelegramMessage).toHaveBeenCalledWith(
      'bot-token',
      '12345',
      expect.stringContaining('/preqstation_dispatch@PreqHermesBot'),
      { normalizeCommand: false },
    );
    expect(await response.json()).toEqual(
      expect.objectContaining({
        comment: expect.objectContaining({ run_state: 'queued' }),
        dispatch: expect.objectContaining({
          objective: 'comment',
          task_key: 'PQST-74',
          comment_id: 'comment-1',
          dispatch_target: 'hermes-telegram',
        }),
      }),
    );
  });

  it('keeps explicit non-dispatch comments local only', async () => {
    mocked.returningFn.mockResolvedValueOnce([
      {
        id: 'comment-local',
        ownerId: 'owner-1',
        projectId: 'project-1',
        taskId: 'task-1',
        parentCommentId: null,
        authorType: 'user',
        authorName: 'owner@example.com',
        body: '메모만 남깁니다',
        runState: null,
        runStateUpdatedAt: null,
        engine: 'codex',
        dispatchTarget: 'hermes-telegram',
        errorMessage: null,
        metadata: null,
        createdAt: new Date('2026-05-06T15:05:00.000Z'),
        updatedAt: new Date('2026-05-06T15:05:00.000Z'),
      },
    ]);

    const response = await POST(postRequest({ body: '메모만 남깁니다', dispatch: false }), {
      params: Promise.resolve({ id: 'PQST-74' }),
    });

    expect(response.status).toBe(201);
    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({ runState: null, dispatchTarget: 'hermes-telegram' }),
    );
    expect(mocked.sendTelegramMessage).not.toHaveBeenCalled();
    expect(await response.json()).toEqual(
      expect.objectContaining({
        comment: expect.objectContaining({ run_state: null }),
        dispatch: null,
      }),
    );
  });
});
