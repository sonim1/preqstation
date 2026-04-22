import { beforeEach, describe, expect, it, vi } from 'vitest';

const CHROME_MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

const mocked = vi.hoisted(() => ({
  ownerClient: {
    query: {
      browserSessions: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
  },
  insertValues: vi.fn(),
  insertReturning: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  updateReturning: vi.fn(),
  withOwnerDb: vi.fn(),
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: mocked.withOwnerDb,
}));

import {
  createBrowserSession,
  getBrowserSessionForOwner,
  listOwnerBrowserSessions,
  revokeBrowserSession,
  touchBrowserSession,
} from '@/lib/browser-sessions';

function buildBrowserSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'browser-session-1',
    ownerId: 'owner-1',
    ipAddress: '203.0.113.10',
    userAgent: CHROME_MAC_UA,
    browserName: 'Chrome',
    osName: 'macOS',
    lastUsedAt: new Date('2026-03-25T12:00:00.000Z'),
    expiresAt: new Date('2026-04-01T12:00:00.000Z'),
    revokedAt: null,
    createdAt: new Date('2026-03-25T12:00:00.000Z'),
    updatedAt: new Date('2026-03-25T12:00:00.000Z'),
    ...overrides,
  };
}

describe('lib/browser-sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.ownerClient.query.browserSessions.findFirst.mockReset();
    mocked.ownerClient.query.browserSessions.findMany.mockReset();
    mocked.insertReturning.mockReset();
    mocked.updateReturning.mockReset();
    mocked.insertValues.mockReturnValue({ returning: mocked.insertReturning });
    mocked.ownerClient.insert.mockReturnValue({ values: mocked.insertValues });
    mocked.updateWhere.mockReturnValue({ returning: mocked.updateReturning });
    mocked.updateSet.mockReturnValue({ where: mocked.updateWhere });
    mocked.ownerClient.update.mockReturnValue({ set: mocked.updateSet });
    mocked.withOwnerDb.mockImplementation(
      async (_ownerId: string, callback: (client: typeof mocked.ownerClient) => unknown) =>
        callback(mocked.ownerClient),
    );
    mocked.ownerClient.query.browserSessions.findFirst.mockResolvedValue(null);
    mocked.ownerClient.query.browserSessions.findMany.mockResolvedValue([]);
    mocked.insertReturning.mockResolvedValue([buildBrowserSession()]);
    mocked.updateReturning.mockResolvedValue([buildBrowserSession()]);
  });

  it('creates an owner-scoped browser session with parsed browser and OS metadata', async () => {
    const now = new Date('2026-03-25T12:00:00.000Z');
    const expectedExpiry = new Date('2026-04-01T12:00:00.000Z');

    await createBrowserSession({
      ownerId: 'owner-1',
      ipAddress: '203.0.113.10',
      userAgent: CHROME_MAC_UA,
      now,
    });

    expect(mocked.withOwnerDb).toHaveBeenCalledWith('owner-1', expect.any(Function));
    expect(mocked.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        ipAddress: '203.0.113.10',
        userAgent: CHROME_MAC_UA,
        browserName: 'Chrome',
        osName: 'macOS',
        lastUsedAt: now,
        expiresAt: expectedExpiry,
      }),
    );
  });

  it('reuses an active matching browser session instead of inserting a duplicate row', async () => {
    const now = new Date('2026-03-26T08:45:00.000Z');
    const existingSession = buildBrowserSession({
      id: 'browser-session-existing',
      lastUsedAt: new Date('2026-03-25T12:00:00.000Z'),
      expiresAt: new Date('2026-04-01T12:00:00.000Z'),
    });
    mocked.ownerClient.query.browserSessions.findFirst.mockResolvedValueOnce(existingSession);
    mocked.updateReturning.mockResolvedValueOnce([
      buildBrowserSession({
        id: 'browser-session-existing',
        lastUsedAt: now,
        expiresAt: new Date('2026-04-02T08:45:00.000Z'),
      }),
    ]);

    const session = await createBrowserSession({
      ownerId: 'owner-1',
      ipAddress: '203.0.113.10',
      userAgent: CHROME_MAC_UA,
      now,
    });

    expect(mocked.ownerClient.query.browserSessions.findFirst).toHaveBeenCalledOnce();
    expect(mocked.ownerClient.insert).not.toHaveBeenCalled();
    expect(mocked.updateSet).toHaveBeenCalledWith({
      expiresAt: new Date('2026-04-02T08:45:00.000Z'),
      lastUsedAt: now,
      revokedAt: null,
    });
    expect(session).toEqual(
      expect.objectContaining({
        id: 'browser-session-existing',
        lastUsedAt: now,
      }),
    );
  });

  it('loads and lists owner-scoped browser sessions', async () => {
    const session = buildBrowserSession();
    mocked.ownerClient.query.browserSessions.findFirst.mockResolvedValueOnce(session);
    mocked.ownerClient.query.browserSessions.findMany.mockResolvedValueOnce([session]);

    await expect(
      getBrowserSessionForOwner({ ownerId: 'owner-1', sessionId: 'browser-session-1' }),
    ).resolves.toEqual(session);
    await expect(listOwnerBrowserSessions('owner-1')).resolves.toEqual([session]);
  });

  it('touches and revokes owner-scoped browser sessions', async () => {
    const touchedAt = new Date('2026-03-26T09:15:00.000Z');
    const revokedAt = new Date('2026-03-26T10:30:00.000Z');

    await touchBrowserSession({
      ownerId: 'owner-1',
      sessionId: 'browser-session-1',
      lastUsedAt: touchedAt,
    });
    expect(mocked.updateSet).toHaveBeenCalledWith({ lastUsedAt: touchedAt });

    await revokeBrowserSession({
      ownerId: 'owner-1',
      sessionId: 'browser-session-1',
      revokedAt,
    });
    expect(mocked.updateSet).toHaveBeenLastCalledWith({ revokedAt });
  });
});
