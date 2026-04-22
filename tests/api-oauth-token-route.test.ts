import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => ({
  exchangeMcpAuthorizationCode: vi.fn(),
}));

vi.mock('@/lib/mcp/auth', () => ({
  exchangeMcpAuthorizationCode: mocked.exchangeMcpAuthorizationCode,
}));

import { POST } from '@/app/api/oauth/token/route';

describe('app/api/oauth/token/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exchanges a valid code for a bearer access token', async () => {
    mocked.exchangeMcpAuthorizationCode.mockResolvedValueOnce({
      accessToken: 'oauth-token-123',
      expiresIn: 2_592_000,
    });

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'code-123',
      redirect_uri: 'https://client.example/callback',
      code_verifier: 'verifier-123',
    });

    const response = await POST(
      new Request(`${TEST_BASE_URL}/api/oauth/token`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      access_token: 'oauth-token-123',
      token_type: 'bearer',
      expires_in: 2_592_000,
    });
  });

  it('rejects an invalid code exchange', async () => {
    mocked.exchangeMcpAuthorizationCode.mockResolvedValueOnce(null);

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'bad-code',
      redirect_uri: 'https://client.example/callback',
      code_verifier: 'wrong-verifier',
    });

    const response = await POST(
      new Request(`${TEST_BASE_URL}/api/oauth/token`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_grant' });
  });
});
