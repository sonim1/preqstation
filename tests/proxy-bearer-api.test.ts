import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  verifySessionToken: vi.fn(),
  isOwnerEmail: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  setSecurityHeaders: vi.fn((response: Response) => response),
}));

vi.mock('@/lib/auth', () => ({
  SESSION_COOKIE_NAME: 'pm_session',
  verifySessionToken: mocked.verifySessionToken,
  isOwnerEmail: mocked.isOwnerEmail,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocked.checkRateLimit,
  getClientIp: mocked.getClientIp,
}));

vi.mock('@/lib/security-headers', () => ({
  setSecurityHeaders: mocked.setSecurityHeaders,
}));

import proxy from '@/proxy';

function makeRequest(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    cookieValue?: string | null;
  } = {},
) {
  return {
    method: options.method ?? 'GET',
    headers: new Headers(options.headers),
    nextUrl: new URL(`https://example.com${path}`),
    url: `https://example.com${path}`,
    cookies: {
      get: vi.fn((name: string) =>
        name === 'pm_session' && options.cookieValue
          ? { name: 'pm_session', value: options.cookieValue }
          : undefined,
      ),
    },
  } as never;
}

describe('proxy bearer API allowlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.checkRateLimit.mockReturnValue({ allowed: true, resetAt: Date.now() + 60_000 });
    mocked.getClientIp.mockReturnValue('127.0.0.1');
    mocked.verifySessionToken.mockResolvedValue(null);
    mocked.isOwnerEmail.mockReturnValue(false);
  });

  it('allows bearer-auth QA run updates without owner session cookies', async () => {
    const response = await proxy(
      makeRequest('/api/qa-runs/run-123', {
        method: 'PATCH',
        headers: { authorization: 'Bearer preq_test_token' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('allows bearer-auth project settings reads without owner session cookies', async () => {
    const response = await proxy(
      makeRequest('/api/projects/PROJ/settings', {
        headers: { authorization: 'Bearer preq_test_token' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('allows bearer-auth mcp requests without owner session cookies', async () => {
    const response = await proxy(
      makeRequest('/mcp', {
        method: 'POST',
        headers: { authorization: 'Bearer oauth_token_123' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('still rejects QA API requests without bearer auth', async () => {
    const response = await proxy(makeRequest('/api/qa-runs/run-123', { method: 'PATCH' }));

    expect(response.status).toBe(401);
    expect(response.headers.get('location')).toBeNull();
  });

  it('allows oauth discovery and exchange routes without owner session cookies', async () => {
    const discoveryResponse = await proxy(makeRequest('/.well-known/oauth-authorization-server'));
    const authorizeResponse = await proxy(makeRequest('/api/oauth/authorize'));
    const registerResponse = await proxy(makeRequest('/api/oauth/register', { method: 'POST' }));
    const tokenResponse = await proxy(makeRequest('/api/oauth/token', { method: 'POST' }));

    expect(discoveryResponse.status).toBe(200);
    expect(authorizeResponse.status).toBe(200);
    expect(registerResponse.status).toBe(200);
    expect(tokenResponse.status).toBe(200);
    expect(discoveryResponse.headers.get('location')).toBeNull();
    expect(authorizeResponse.headers.get('location')).toBeNull();
    expect(registerResponse.headers.get('location')).toBeNull();
    expect(tokenResponse.headers.get('location')).toBeNull();
  });
});

describe('proxy login server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.checkRateLimit.mockReturnValue({ allowed: true, resetAt: Date.now() + 60_000 });
    mocked.getClientIp.mockReturnValue('127.0.0.1');
    mocked.verifySessionToken.mockResolvedValue({
      email: 'owner@example.com',
    });
    mocked.isOwnerEmail.mockReturnValue(true);
  });

  it('lets login server action posts through when a session cookie already exists', async () => {
    const response = await proxy(
      makeRequest('/login', {
        method: 'POST',
        headers: {
          accept: 'text/x-component',
          'next-action': 'action-id',
        },
        cookieValue: 'signed-session',
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});
