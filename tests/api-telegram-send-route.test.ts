import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    writeAuditLog: vi.fn(),
    writeOutboxEventStandalone: vi.fn(),
    getUserSettings: vi.fn(),
    decryptTelegramToken: vi.fn(),
    queueTaskExecutionByTaskKey: vi.fn(),
    fetch: vi.fn(),
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

vi.mock('@/lib/user-settings', () => ({
  SETTING_KEYS: {
    TELEGRAM_BOT_TOKEN: 'telegram_bot_token',
    TELEGRAM_CHAT_ID: 'telegram_chat_id',
    TELEGRAM_ENABLED: 'telegram_enabled',
    OPENCLAW_TELEGRAM_CHAT_ID: 'openclaw_telegram_chat_id',
    OPENCLAW_TELEGRAM_ENABLED: 'openclaw_telegram_enabled',
    HERMES_TELEGRAM_CHAT_ID: 'hermes_telegram_chat_id',
    HERMES_TELEGRAM_ENABLED: 'hermes_telegram_enabled',
  },
  getUserSettings: mocked.getUserSettings,
}));

vi.mock('@/lib/telegram-crypto', () => ({
  decryptTelegramToken: mocked.decryptTelegramToken,
}));

vi.mock('@/lib/task-run-state', () => ({
  queueTaskExecutionByTaskKey: mocked.queueTaskExecutionByTaskKey,
}));

import { POST } from '@/app/api/telegram/send/route';

function postRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/telegram/send`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

describe('app/api/telegram/send/route', () => {
  beforeEach(() => {
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.getUserSettings.mockResolvedValue({
      telegram_enabled: 'true',
      telegram_bot_token: 'encrypted-token',
      telegram_chat_id: '1234567',
      openclaw_telegram_enabled: '',
      openclaw_telegram_chat_id: '',
      hermes_telegram_enabled: '',
      hermes_telegram_chat_id: '',
    });
    mocked.decryptTelegramToken.mockResolvedValue('123:bot-token');
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.writeOutboxEventStandalone.mockResolvedValue(undefined);
    mocked.queueTaskExecutionByTaskKey.mockResolvedValue({
      taskKey: 'PROJ-1',
      projectId: 'project-1',
    });
    mocked.fetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mocked.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('respects same-origin guard response', async () => {
    mocked.assertSameOrigin.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid origin' }), { status: 403 }),
    );

    const response = await POST(postRequest({ taskKey: 'PROJ-1', message: 'hello' }));

    expect(response.status).toBe(403);
    expect(mocked.requireOwnerUser).not.toHaveBeenCalled();
    expect(mocked.fetch).not.toHaveBeenCalled();
  });

  it('returns auth response when owner auth fails', async () => {
    mocked.requireOwnerUser.mockRejectedValueOnce(new Response('Unauthorized', { status: 401 }));

    const response = await POST(postRequest({ taskKey: 'PROJ-1', message: 'hello' }));

    expect(response.status).toBe(401);
    expect(mocked.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 when telegram is disabled or missing config', async () => {
    mocked.getUserSettings.mockResolvedValueOnce({
      telegram_enabled: 'false',
      telegram_bot_token: 'encrypted-token',
      telegram_chat_id: '1234567',
    });

    const response = await POST(postRequest({ taskKey: 'PROJ-1', message: 'hello' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Telegram is not fully configured or disabled',
    });
    expect(mocked.fetch).not.toHaveBeenCalled();
  });

  it('decrypts token, calls telegram api, and writes audit log on success', async () => {
    const response = await POST(
      postRequest({
        taskKey: 'PROJ-1',
        message: '/skill preqstation-dispatch implement PROJ-1 using codex',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    expect(mocked.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = mocked.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/bot123:bot-token/sendMessage');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(String(options.body))).toEqual({
      chat_id: '1234567',
      text: '!/skill preqstation-dispatch implement PROJ-1 using codex',
    });

    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'telegram.message_sent',
        targetType: 'task',
        targetId: 'PROJ-1',
      }),
    );
    expect(mocked.queueTaskExecutionByTaskKey).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      taskKey: 'PROJ-1',
      dispatchTarget: 'telegram',
    });
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

  it('sends Hermes dispatch messages without OpenClaw bang normalization', async () => {
    mocked.getUserSettings.mockResolvedValueOnce({
      telegram_enabled: 'true',
      telegram_bot_token: 'encrypted-token',
      telegram_chat_id: '1234567',
      openclaw_telegram_enabled: 'true',
      openclaw_telegram_chat_id: '1234567',
      hermes_telegram_enabled: 'true',
      hermes_telegram_chat_id: '7654321',
    });

    const response = await POST(
      postRequest({
        taskKey: 'PROJ-1',
        message:
          '/preq_dispatch@PreqHermesBot\nproject_key=PROJ\ntask_key=PROJ-1\nobjective=implement\nengine=codex',
        dispatchTarget: 'hermes-telegram',
      }),
    );

    expect(response.status).toBe(200);

    const [, options] = mocked.fetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual({
      chat_id: '7654321',
      text: '/preq_dispatch@PreqHermesBot\nproject_key=PROJ\ntask_key=PROJ-1\nobjective=implement\nengine=codex',
    });

    expect(mocked.queueTaskExecutionByTaskKey).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      taskKey: 'PROJ-1',
      dispatchTarget: 'hermes-telegram',
    });
  });

  it('returns 400 when Hermes is selected but the Hermes channel is disabled', async () => {
    mocked.getUserSettings.mockResolvedValueOnce({
      telegram_enabled: 'true',
      telegram_bot_token: 'encrypted-token',
      telegram_chat_id: '1234567',
      openclaw_telegram_enabled: 'true',
      openclaw_telegram_chat_id: '1234567',
      hermes_telegram_enabled: 'false',
      hermes_telegram_chat_id: '7654321',
    });

    const response = await POST(
      postRequest({
        taskKey: 'PROJ-1',
        message: '/preq_dispatch@PreqHermesBot',
        dispatchTarget: 'hermes-telegram',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Telegram is not fully configured or disabled',
    });
    expect(mocked.fetch).not.toHaveBeenCalled();
  });

  it('maps telegram upstream failure description', async () => {
    mocked.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, description: 'chat not found' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await POST(postRequest({ taskKey: 'PROJ-1', message: 'hello' }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'chat not found' });
    expect(mocked.writeAuditLog).not.toHaveBeenCalled();
  });

  it('returns clear config error when stored telegram token cannot be decrypted', async () => {
    mocked.decryptTelegramToken.mockRejectedValueOnce(new Error('decrypt failed'));

    const response = await POST(postRequest({ taskKey: 'PROJ-1', message: 'hello' }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Telegram bot token is invalid. Save Telegram settings again.',
    });
    expect(mocked.fetch).not.toHaveBeenCalled();
    expect(mocked.writeAuditLog).not.toHaveBeenCalled();
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
