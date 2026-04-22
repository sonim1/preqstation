import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  adminClient: {
    query: {
      apiTokens: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(),
  },
  ownerClient: {
    insert: vi.fn(),
  },
  insertValues: vi.fn(),
  insertReturning: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  withAdminDb: vi.fn(),
  withOwnerDb: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    AUTH_SECRET: 'test-auth-secret-that-is-long-enough-32chars',
  },
}));

vi.mock('@/lib/db/rls', () => ({
  withAdminDb: mocked.withAdminDb,
  withOwnerDb: mocked.withOwnerDb,
}));

import { authenticateApiToken, createInternalApiToken, issueApiToken } from '@/lib/api-tokens';

describe('lib/api-tokens internal auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.adminClient.query.apiTokens.findFirst.mockResolvedValue(null);
    mocked.insertReturning.mockResolvedValue([
      {
        id: 'token-1',
        ownerId: 'owner-1',
        name: 'CLI',
        tokenPrefix: 'preq_example',
        lastUsedAt: null,
        expiresAt: null,
        revokedAt: null,
        createdAt: new Date('2026-03-31T00:00:00.000Z'),
      },
    ]);
    mocked.insertValues.mockReturnValue({ returning: mocked.insertReturning });
    mocked.ownerClient.insert.mockReturnValue({ values: mocked.insertValues });
    mocked.updateWhere.mockResolvedValue(undefined);
    mocked.updateSet.mockReturnValue({ where: mocked.updateWhere });
    mocked.adminClient.update.mockReturnValue({ set: mocked.updateSet });
    mocked.withAdminDb.mockImplementation(
      async (callback: (client: typeof mocked.adminClient) => unknown) =>
        callback(mocked.adminClient),
    );
    mocked.withOwnerDb.mockImplementation(
      async (_ownerId: string, callback: (client: typeof mocked.ownerClient) => unknown) =>
        callback(mocked.ownerClient),
    );
  });

  it('authenticates internal mcp tokens without hitting the api_tokens table', async () => {
    const token = await createInternalApiToken({
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tokenName: 'MCP OAuth',
    });

    const auth = await authenticateApiToken(
      new Request('https://example.com/api/tasks', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      }),
    );

    expect(auth).toEqual({
      tokenId: 'internal-mcp',
      tokenName: 'MCP OAuth',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
    });
    expect(mocked.adminClient.query.apiTokens.findFirst).not.toHaveBeenCalled();
    expect(mocked.withAdminDb).not.toHaveBeenCalled();
  });

  it('rejects malformed internal tokens', async () => {
    const auth = await authenticateApiToken(
      new Request('https://example.com/api/tasks', {
        headers: {
          authorization: 'Bearer pmint_bad_token',
        },
      }),
    );

    expect(auth).toBeNull();
  });

  it('looks up persisted api tokens through the explicit admin path', async () => {
    const rawToken = 'preq_example_raw_token';
    mocked.adminClient.query.apiTokens.findFirst.mockResolvedValueOnce({
      id: 'token-1',
      name: 'CLI',
      owner: {
        id: 'owner-1',
        email: 'owner@example.com',
      },
    });

    const auth = await authenticateApiToken(
      new Request('https://example.com/api/tasks', {
        headers: {
          authorization: `Bearer ${rawToken}`,
        },
      }),
    );

    expect(auth).toEqual({
      tokenId: 'token-1',
      tokenName: 'CLI',
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
    });
    expect(mocked.withAdminDb).toHaveBeenCalledOnce();
    expect(mocked.adminClient.query.apiTokens.findFirst).toHaveBeenCalledOnce();
  });

  it('issues persisted api tokens through the owner-scoped helper', async () => {
    const result = await issueApiToken({
      ownerId: 'owner-1',
      name: 'CLI',
    });

    expect(result.record).toEqual(
      expect.objectContaining({
        id: 'token-1',
        ownerId: 'owner-1',
        name: 'CLI',
      }),
    );
    expect(result.token).toMatch(/^preq_/);
    expect(mocked.withOwnerDb).toHaveBeenCalledWith('owner-1', expect.any(Function));
    expect(mocked.ownerClient.insert).toHaveBeenCalledTimes(1);
  });
});
