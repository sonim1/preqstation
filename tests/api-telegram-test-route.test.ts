import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    getUserSettings: vi.fn(),
    decryptTelegramToken: vi.fn(),
    fetch: vi.fn(),
  };
});

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/request-security', () => ({
  assertSameOrigin: mocked.assertSameOrigin,
}));

vi.mock('@/lib/user-settings', () => ({
  SETTING_KEYS: {
    TELEGRAM_BOT_TOKEN: 'telegram_bot_token',
    TELEGRAM_CHAT_ID: 'telegram_chat_id',
    TELEGRAM_ENABLED: 'telegram_enabled',
  },
  getUserSettings: mocked.getUserSettings,
}));

vi.mock('@/lib/telegram-crypto', () => ({
  decryptTelegramToken: mocked.decryptTelegramToken,
}));

import { POST } from '@/app/api/telegram/test/route';

function postRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/telegram/test`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

describe('app/api/telegram/test/route', () => {
  beforeEach(() => {
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.getUserSettings.mockResolvedValue({
      telegram_bot_token: '',
      telegram_chat_id: '1234',
      telegram_enabled: 'true',
    });
    mocked.decryptTelegramToken.mockResolvedValue('saved-token');
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

    const response = await POST(postRequest({ botToken: '123:abc', chatId: '1234' }));

    expect(response.status).toBe(403);
    expect(mocked.requireOwnerUser).not.toHaveBeenCalled();
  });

  it('returns auth response when owner auth fails', async () => {
    mocked.requireOwnerUser.mockRejectedValueOnce(new Response('Unauthorized', { status: 401 }));

    const response = await POST(postRequest({ botToken: '123:abc', chatId: '1234' }));

    expect(response.status).toBe(401);
    expect(mocked.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid payload', async () => {
    const response = await POST(postRequest({ botToken: '', chatId: '' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: 'Invalid payload',
        issues: expect.any(Array),
      }),
    );
  });

  it('sends test message with default text when message is omitted', async () => {
    const response = await POST(postRequest({ botToken: '123:abc', chatId: '1234' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocked.fetch).toHaveBeenCalledTimes(1);

    const [url, options] = mocked.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/bot123:abc/sendMessage');
    expect(options.method).toBe('POST');
    expect(JSON.parse(String(options.body))).toEqual({
      chat_id: '1234',
      text: '!OpenClaw test message',
    });
  });

  it('uses the saved telegram token when botToken is omitted', async () => {
    mocked.getUserSettings.mockResolvedValueOnce({
      telegram_bot_token: 'encrypted-token',
      telegram_chat_id: '1234',
      telegram_enabled: 'true',
    });
    mocked.decryptTelegramToken.mockResolvedValueOnce('saved-token');

    const response = await POST(postRequest({ chatId: '1234' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocked.getUserSettings).toHaveBeenCalledWith('owner-1');
    expect(mocked.decryptTelegramToken).toHaveBeenCalledWith('encrypted-token');

    const [url, options] = mocked.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/botsaved-token/sendMessage');
    expect(JSON.parse(String(options.body))).toEqual({
      chat_id: '1234',
      text: '!OpenClaw test message',
    });
  });

  it('prefers the typed token over the saved token', async () => {
    const response = await POST(postRequest({ botToken: 'typed-token', chatId: '1234' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocked.getUserSettings).not.toHaveBeenCalled();
    expect(mocked.decryptTelegramToken).not.toHaveBeenCalled();

    const [url] = mocked.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/bottyped-token/sendMessage');
  });

  it('returns a clear error when neither a typed nor saved token exists', async () => {
    mocked.getUserSettings.mockResolvedValueOnce({
      telegram_bot_token: '',
      telegram_chat_id: '1234',
      telegram_enabled: 'true',
    });

    const response = await POST(postRequest({ chatId: '1234' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Telegram bot token is not configured. Enter a Bot Token or save one first.',
    });
    expect(mocked.decryptTelegramToken).not.toHaveBeenCalled();
    expect(mocked.fetch).not.toHaveBeenCalled();
  });

  it('returns a clear error when the saved token cannot be decrypted', async () => {
    mocked.getUserSettings.mockResolvedValueOnce({
      telegram_bot_token: 'encrypted-token',
      telegram_chat_id: '1234',
      telegram_enabled: 'true',
    });
    mocked.decryptTelegramToken.mockRejectedValueOnce(new Error('boom'));

    const response = await POST(postRequest({ chatId: '1234' }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Telegram bot token is invalid. Save Telegram settings again.',
    });
    expect(mocked.fetch).not.toHaveBeenCalled();
  });

  it('normalizes a custom /status message before sending it to Telegram', async () => {
    const response = await POST(
      postRequest({
        botToken: '123:abc',
        chatId: '1234',
        message: '/status',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    const [, options] = mocked.fetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual({
      chat_id: '1234',
      text: '!/status',
    });
  });

  it('maps telegram failure to 400 response', async () => {
    mocked.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, description: 'bad token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await POST(
      postRequest({
        botToken: '123:abc',
        chatId: '1234',
        message: 'hello',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: 'bad token',
    });
  });
});
