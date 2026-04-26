import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    writeAuditLog: vi.fn(),
    getUserSettings: vi.fn(),
    decryptTelegramToken: vi.fn(),
    sendTelegramMessage: vi.fn(),
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

vi.mock('@/lib/user-settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/user-settings')>('@/lib/user-settings');
  return {
    ...actual,
    getUserSettings: mocked.getUserSettings,
  };
});

vi.mock('@/lib/telegram-crypto', () => ({
  decryptTelegramToken: mocked.decryptTelegramToken,
}));

vi.mock('@/lib/telegram', () => ({
  sendTelegramMessage: mocked.sendTelegramMessage,
}));

import { POST } from '@/app/api/telegram/send/insight/route';

function postRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/telegram/send/insight`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

describe('app/api/telegram/send/insight/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.getUserSettings.mockResolvedValue({
      telegram_enabled: 'true',
      telegram_bot_token: 'encrypted-token',
      telegram_chat_id: '1234567',
      openclaw_telegram_enabled: 'true',
      openclaw_telegram_chat_id: '1234567',
      hermes_telegram_enabled: 'true',
      hermes_telegram_chat_id: '7654321',
    });
    mocked.decryptTelegramToken.mockResolvedValue('123:bot-token');
    mocked.sendTelegramMessage.mockResolvedValue({ ok: true });
    mocked.writeAuditLog.mockResolvedValue(undefined);
  });

  it('sends openclaw project insight messages through the default Telegram channel', async () => {
    const response = await POST(
      postRequest({
        projectKey: 'PROJ',
        message: '!/skill preqstation-dispatch insight PROJ using codex',
      }),
    );

    expect(response.status).toBe(200);
    expect(mocked.sendTelegramMessage).toHaveBeenCalledWith(
      '123:bot-token',
      '1234567',
      '!/skill preqstation-dispatch insight PROJ using codex',
      { normalizeCommand: true },
    );
  });

  it('sends Hermes project insight messages through the Hermes Telegram channel', async () => {
    const response = await POST(
      postRequest({
        projectKey: 'PROJ',
        message: '/preq_dispatch@PreqHermesBot',
        dispatchTarget: 'hermes-telegram',
      }),
    );

    expect(response.status).toBe(200);
    expect(mocked.sendTelegramMessage).toHaveBeenCalledWith(
      '123:bot-token',
      '7654321',
      '/preq_dispatch@PreqHermesBot',
      { normalizeCommand: false },
    );
  });
});
