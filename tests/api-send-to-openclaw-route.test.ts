import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  return {
    auth: vi.fn(),
    isOwnerEmail: vi.fn(),
    fetch: vi.fn(),
  };
});

vi.mock('@/lib/auth', () => ({
  auth: mocked.auth,
  isOwnerEmail: mocked.isOwnerEmail,
}));

import { POST } from '@/app/api/send-to-openclaw/route';

function jsonRequest(body?: unknown) {
  return new Request(`${TEST_BASE_URL}/api/send-to-openclaw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('app/api/send-to-openclaw/route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    process.env.TG_BOT_TOKEN = 'test-token';
    process.env.TG_CHANNEL_ID = '@test-channel';
    mocked.auth.mockResolvedValue({ user: { email: 'owner@test.com' } });
    mocked.isOwnerEmail.mockReturnValue(true);
    global.fetch = mocked.fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = fetch;
  });

  it('returns 401 for unauthenticated request', async () => {
    mocked.auth.mockResolvedValueOnce(null);

    const response = await POST(jsonRequest({ message: 'hello' }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when user is not owner', async () => {
    mocked.auth.mockResolvedValueOnce({ user: { email: 'other@test.com' } });
    mocked.isOwnerEmail.mockReturnValueOnce(false);

    const response = await POST(jsonRequest({ message: 'hello' }));
    expect(response.status).toBe(401);
  });

  it('returns 400 when message field is missing', async () => {
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Missing or empty message field',
    });
  });

  it('returns 400 when message is empty string', async () => {
    const response = await POST(jsonRequest({ message: '   ' }));
    expect(response.status).toBe(400);
  });

  it('returns 500 when TG_BOT_TOKEN is missing', async () => {
    delete process.env.TG_BOT_TOKEN;

    const response = await POST(jsonRequest({ message: 'hello' }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Telegram not configured' });
  });

  it('returns 500 when TG_CHANNEL_ID is missing', async () => {
    delete process.env.TG_CHANNEL_ID;

    const response = await POST(jsonRequest({ message: 'hello' }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Telegram not configured' });
  });

  it('returns 500 when Telegram API returns error', async () => {
    mocked.fetch.mockResolvedValueOnce({
      json: async () => ({ ok: false, description: 'Bad Request: chat not found' }),
    });

    const response = await POST(jsonRequest({ message: 'hello' }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Bad Request: chat not found',
    });
  });

  it('returns 200 with message_id on success', async () => {
    mocked.fetch.mockResolvedValueOnce({
      json: async () => ({ ok: true, result: { message_id: 42 } }),
    });

    const response = await POST(jsonRequest({ message: 'hello' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, message_id: 42 });

    expect(mocked.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: '@test-channel', text: '!hello' }),
      },
    );
  });

  it('appends branch_name to telegram message when provided', async () => {
    mocked.fetch.mockResolvedValueOnce({
      json: async () => ({ ok: true, result: { message_id: 43 } }),
    });

    const response = await POST(
      jsonRequest({
        message: '/skill preqstation-dispatch implement PROJ-1 using codex',
        branch_name: 'task/proj-1/implement-auth',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, message_id: 43 });
    expect(mocked.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: '@test-channel',
          text: '!/skill preqstation-dispatch implement PROJ-1 using codex branch_name="task/proj-1/implement-auth"',
        }),
      },
    );
  });
});
