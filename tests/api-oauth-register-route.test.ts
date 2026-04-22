import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => ({
  registerOAuthClient: vi.fn(),
}));

vi.mock('@/lib/mcp/connections', () => ({
  registerOAuthClient: mocked.registerOAuthClient,
}));

import { POST } from '@/app/api/oauth/register/route';

describe('app/api/oauth/register/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.registerOAuthClient.mockResolvedValue({
      clientId: 'client-123',
      clientName: 'Codex',
      redirectUris: ['https://client.example/callback'],
    });
  });

  it('registers and persists a public oauth client for authorization code + pkce', async () => {
    const response = await POST(
      new Request(`${TEST_BASE_URL}/api/oauth/register`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          client_name: 'Codex',
          redirect_uris: ['https://client.example/callback'],
        }),
      }),
    );

    expect(mocked.registerOAuthClient).toHaveBeenCalledWith({
      clientName: 'Codex',
      redirectUris: ['https://client.example/callback'],
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      client_id: 'client-123',
      client_name: 'Codex',
      redirect_uris: ['https://client.example/callback'],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
  });

  it('rejects registrations without redirect uris', async () => {
    const response = await POST(
      new Request(`${TEST_BASE_URL}/api/oauth/register`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          client_name: 'Codex',
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_client_metadata' });
    expect(mocked.registerOAuthClient).not.toHaveBeenCalled();
  });

  it('accepts broader client metadata and normalizes it to the supported public flow', async () => {
    mocked.registerOAuthClient.mockResolvedValueOnce({
      clientId: 'client-456',
      clientName: 'Codex',
      redirectUris: ['http://127.0.0.1:54321/callback'],
    });

    const response = await POST(
      new Request(`${TEST_BASE_URL}/api/oauth/register`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          client_name: 'Codex',
          redirect_uris: ['http://127.0.0.1:54321/callback'],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'client_secret_post',
          scope: 'openid profile offline_access',
        }),
      }),
    );

    expect(mocked.registerOAuthClient).toHaveBeenCalledWith({
      clientName: 'Codex',
      redirectUris: ['http://127.0.0.1:54321/callback'],
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      client_id: 'client-456',
      client_name: 'Codex',
      redirect_uris: ['http://127.0.0.1:54321/callback'],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
  });
});
