import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => ({
  auth: vi.fn(),
  getOAuthClientById: vi.fn(),
  issueMcpAuthorizationCode: vi.fn(),
  setMcpLoginRequestCookie: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: mocked.auth,
}));

vi.mock('@/lib/mcp/connections', () => ({
  getOAuthClientById: mocked.getOAuthClientById,
}));

vi.mock('@/lib/mcp/auth', () => ({
  MCP_OAUTH_LOGIN_COOKIE_NAME: 'pm_mcp_oauth',
  issueMcpAuthorizationCode: mocked.issueMcpAuthorizationCode,
  setMcpLoginRequestCookie: mocked.setMcpLoginRequestCookie,
  redirectUrisMatch: (expected: string, actual: string) => expected === actual,
  buildMcpAuthorizationRedirect: (redirectUri: string, code: string, state: string) =>
    `${redirectUri}?code=${code}&state=${state}`,
}));

import { GET } from '@/app/api/oauth/authorize/route';

describe('app/api/oauth/authorize/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.auth.mockResolvedValue(null);
    mocked.getOAuthClientById.mockResolvedValue({
      clientId: 'client-123',
      redirectUris: ['https://client.example/callback'],
      clientName: 'Codex',
      ownerId: null,
    });
    mocked.issueMcpAuthorizationCode.mockResolvedValue('code-123');
  });

  it('rejects authorization requests for unknown clients', async () => {
    mocked.getOAuthClientById.mockResolvedValueOnce(null);

    const response = await GET(
      new Request(
        `${TEST_BASE_URL}/api/oauth/authorize?client_id=missing-client&redirect_uri=https://client.example/callback&state=opaque-state&code_challenge=challenge-123&code_challenge_method=S256`,
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(mocked.setMcpLoginRequestCookie).not.toHaveBeenCalled();
    expect(mocked.issueMcpAuthorizationCode).not.toHaveBeenCalled();
  });

  it('stores the oauth request in a cookie and redirects guests to /login', async () => {
    const response = await GET(
      new Request(
        `${TEST_BASE_URL}/api/oauth/authorize?client_id=client-123&redirect_uri=https://client.example/callback&state=opaque-state&code_challenge=challenge-123&code_challenge_method=S256`,
      ),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${TEST_BASE_URL}/login?oauth=1`);
    expect(mocked.getOAuthClientById).toHaveBeenCalledWith('client-123');
    expect(mocked.setMcpLoginRequestCookie).toHaveBeenCalledWith({
      clientId: 'client-123',
      redirectUri: 'https://client.example/callback',
      state: 'opaque-state',
      codeChallenge: 'challenge-123',
      codeChallengeMethod: 'S256',
    });
    expect(mocked.issueMcpAuthorizationCode).not.toHaveBeenCalled();
  });

  it('issues a code and redirects authenticated owners back to the client', async () => {
    mocked.auth.mockResolvedValueOnce({
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        isOwner: true,
      },
    });

    const response = await GET(
      new Request(
        `${TEST_BASE_URL}/api/oauth/authorize?client_id=client-123&redirect_uri=https://client.example/callback&state=opaque-state&code_challenge=challenge-123&code_challenge_method=S256`,
      ),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://client.example/callback?code=code-123&state=opaque-state',
    );
    expect(mocked.issueMcpAuthorizationCode).toHaveBeenCalledWith({
      userId: 'owner-1',
      clientId: 'client-123',
      codeChallenge: 'challenge-123',
      codeChallengeMethod: 'S256',
      redirectUri: 'https://client.example/callback',
    });
  });
});
