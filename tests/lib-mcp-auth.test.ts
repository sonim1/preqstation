import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const insertValues = vi.fn();
  const ownerClient = {
    insert: vi.fn(() => ({ values: insertValues })),
  };
  const deleteWhere = vi.fn();
  const deleteBuilder = vi.fn(() => ({ where: deleteWhere }));
  const adminClient = {
    query: {
      oauthCodes: {
        findFirst: vi.fn(),
      },
    },
    delete: deleteBuilder,
  };

  return {
    assignOAuthClientOwner: vi.fn(),
    createOrRefreshMcpConnection: vi.fn(),
    getOAuthClientById: vi.fn(),
    insertValues,
    deleteWhere,
    ownerClient,
    adminClient,
    withOwnerDb: vi.fn(),
    withAdminDb: vi.fn(),
  };
});

vi.mock('@/lib/env', () => ({
  env: {
    AUTH_SECRET: 'test-auth-secret-that-is-long-enough-32chars',
  },
}));

vi.mock('@/lib/db/rls', () => ({
  withAdminDb: mocked.withAdminDb,
  withOwnerDb: mocked.withOwnerDb,
}));

vi.mock('@/lib/mcp/connections', () => ({
  assignOAuthClientOwner: mocked.assignOAuthClientOwner,
  createOrRefreshMcpConnection: mocked.createOrRefreshMcpConnection,
  getOAuthClientById: mocked.getOAuthClientById,
}));

import {
  exchangeMcpAuthorizationCode,
  issueMcpAuthorizationCode,
  verifyMcpAccessToken,
} from '@/lib/mcp/auth';

function toBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function createCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}

describe('lib/mcp/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.insertValues.mockResolvedValue(undefined);
    mocked.deleteWhere.mockResolvedValue(undefined);
    mocked.adminClient.query.oauthCodes.findFirst.mockResolvedValue(null);
    mocked.getOAuthClientById.mockResolvedValue({
      clientId: 'client-1',
      ownerId: null,
      clientName: 'Codex',
      redirectUris: ['http://127.0.0.1:3456/callback'],
    });
    mocked.assignOAuthClientOwner.mockResolvedValue({
      clientId: 'client-1',
      ownerId: 'owner-1',
      clientName: 'Codex',
      redirectUris: ['http://127.0.0.1:3456/callback'],
    });
    mocked.createOrRefreshMcpConnection.mockResolvedValue({
      id: 'connection-1',
      expiresAt: new Date(Date.now() + 60 * 60 * 24 * 30 * 1000),
    });
    mocked.withOwnerDb.mockImplementation(
      async (_ownerId: string, callback: (client: typeof mocked.ownerClient) => unknown) =>
        callback(mocked.ownerClient),
    );
    mocked.withAdminDb.mockImplementation(
      async (callback: (client: typeof mocked.adminClient) => unknown) =>
        callback(mocked.adminClient),
    );
  });

  it('issues authorization codes through the owner-scoped helper', async () => {
    const code = await issueMcpAuthorizationCode({
      userId: 'owner-1',
      clientId: 'client-1',
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
      redirectUri: 'http://127.0.0.1:3456/callback',
    });
    if (!code) {
      throw new Error('Expected authorization code');
    }

    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(10);
    expect(mocked.assignOAuthClientOwner).toHaveBeenCalledWith({
      clientId: 'client-1',
      ownerId: 'owner-1',
    });
    expect(mocked.withOwnerDb).toHaveBeenCalledWith('owner-1', expect.any(Function));
    expect(mocked.ownerClient.insert).toHaveBeenCalledOnce();
    expect(mocked.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'owner-1',
        clientId: 'client-1',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'http://127.0.0.1:3456/callback',
      }),
    );
  });

  it('exchanges authorization codes through the explicit admin path', async () => {
    const codeVerifier = 'super-secret-verifier';
    mocked.adminClient.query.oauthCodes.findFirst.mockResolvedValueOnce({
      code: 'code-1',
      clientId: 'client-1',
      codeChallenge: await createCodeChallenge(codeVerifier),
      codeChallengeMethod: 'S256',
      redirectUri: 'http://localhost:3456/callback',
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        isOwner: true,
      },
      client: {
        clientId: 'client-1',
        clientName: 'Codex',
      },
    });

    const result = await exchangeMcpAuthorizationCode({
      code: 'code-1',
      codeVerifier,
      redirectUri: 'http://127.0.0.1:3456/callback',
    });

    expect(result).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        expiresIn: 60 * 60 * 24 * 30,
      }),
    );
    await expect(verifyMcpAccessToken(result?.accessToken)).resolves.toEqual(
      expect.objectContaining({
        sub: 'owner-1',
        connectionId: 'connection-1',
      }),
    );
    expect(mocked.createOrRefreshMcpConnection).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      clientId: 'client-1',
      clientName: 'Codex',
      redirectUri: 'http://localhost:3456/callback',
      expiresAt: expect.any(Date),
    });
    expect(mocked.withAdminDb).toHaveBeenCalledOnce();
    expect(mocked.adminClient.query.oauthCodes.findFirst).toHaveBeenCalledOnce();
    expect(mocked.deleteWhere).toHaveBeenCalledOnce();
  });
});
