import { and, eq, gt, isNull, lte } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EXPIRING_SOON_WINDOW_MS } from '@/lib/connection-expiration';
import {
  buildConnectionExpirationNotifications,
  getConnectionExpirationNotificationKey,
  listConnectionExpirationNotifications,
} from '@/lib/connection-expiration-notifications';
import { browserSessions, mcpConnections } from '@/lib/db/schema';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-03-25T12:00:00.000Z');

describe('lib/connection-expiration-notifications', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('includes active expiring-soon MCP connections and browser sessions most recent first', () => {
    const notifications = buildConnectionExpirationNotifications({
      ownerId: OWNER_ID,
      now: NOW,
      mcpConnections: [
        {
          id: 'mcp-expiring',
          displayName: 'Codex',
          redirectUri: 'http://127.0.0.1:3456/callback',
          expiresAt: new Date('2026-03-27T11:00:00.000Z'),
          revokedAt: null,
          createdAt: new Date('2026-03-20T12:00:00.000Z'),
        },
        {
          id: 'mcp-healthy',
          displayName: 'Healthy bridge',
          redirectUri: 'http://127.0.0.1:4567/callback',
          expiresAt: new Date('2026-04-05T12:00:00.000Z'),
          revokedAt: null,
          createdAt: new Date('2026-03-20T12:00:00.000Z'),
        },
        {
          id: 'mcp-expired',
          displayName: 'Expired bridge',
          redirectUri: 'http://127.0.0.1:5678/callback',
          expiresAt: new Date('2026-03-25T11:00:00.000Z'),
          revokedAt: null,
          createdAt: new Date('2026-03-20T12:00:00.000Z'),
        },
        {
          id: 'mcp-revoked',
          displayName: 'Revoked bridge',
          redirectUri: 'http://127.0.0.1:6789/callback',
          expiresAt: new Date('2026-03-27T11:00:00.000Z'),
          revokedAt: new Date('2026-03-25T11:30:00.000Z'),
          createdAt: new Date('2026-03-20T12:00:00.000Z'),
        },
      ],
      browserSessions: [
        {
          id: 'browser-expiring',
          ipAddress: '203.0.113.10',
          browserName: 'Chrome',
          osName: 'macOS',
          expiresAt: new Date('2026-03-26T15:00:00.000Z'),
          revokedAt: null,
          createdAt: new Date('2026-03-23T12:00:00.000Z'),
        },
        {
          id: 'browser-healthy',
          ipAddress: '198.51.100.10',
          browserName: 'Safari',
          osName: 'iOS',
          expiresAt: new Date('2026-04-01T12:00:00.000Z'),
          revokedAt: null,
          createdAt: new Date('2026-03-23T12:00:00.000Z'),
        },
        {
          id: 'browser-expired',
          ipAddress: '198.51.100.20',
          browserName: 'Firefox',
          osName: 'Linux',
          expiresAt: new Date('2026-03-25T11:00:00.000Z'),
          revokedAt: null,
          createdAt: new Date('2026-03-23T12:00:00.000Z'),
        },
        {
          id: 'browser-revoked',
          ipAddress: '198.51.100.30',
          browserName: 'Edge',
          osName: 'Windows',
          expiresAt: new Date('2026-03-26T15:00:00.000Z'),
          revokedAt: new Date('2026-03-25T11:30:00.000Z'),
          createdAt: new Date('2026-03-23T12:00:00.000Z'),
        },
      ],
      reads: [],
    });

    expect(notifications).toEqual([
      expect.objectContaining({
        id: 'connection-expiring-soon:mcp:mcp-expiring:2026-03-27T11:00:00.000Z',
        type: 'connection-expiration',
        source: 'mcp',
        title: 'Connection expires soon',
        targetName: 'Codex',
        targetDetail: '127.0.0.1:3456/callback',
        readAt: null,
      }),
      expect.objectContaining({
        id: 'connection-expiring-soon:browser:browser-expiring:2026-03-26T15:00:00.000Z',
        type: 'connection-expiration',
        source: 'browser',
        title: 'Browser session expires soon',
        targetName: 'Chrome',
        targetDetail: 'macOS · 203.0.113.10',
        readAt: null,
      }),
    ]);
  });

  it('uses deterministic keys and applies read state by notification key', () => {
    const key = getConnectionExpirationNotificationKey({
      source: 'mcp',
      recordId: 'mcp-expiring',
      expiresAt: new Date('2026-03-27T11:00:00.000Z'),
    });
    const notifications = buildConnectionExpirationNotifications({
      ownerId: OWNER_ID,
      now: NOW,
      mcpConnections: [
        {
          id: 'mcp-expiring',
          displayName: 'Codex',
          redirectUri: 'http://127.0.0.1:3456/callback',
          expiresAt: new Date('2026-03-27T11:00:00.000Z'),
          revokedAt: null,
          createdAt: new Date('2026-03-20T12:00:00.000Z'),
        },
      ],
      browserSessions: [],
      reads: [
        {
          notificationKey: key,
          readAt: new Date('2026-03-25T13:00:00.000Z'),
          createdAt: new Date('2026-03-25T13:00:00.000Z'),
        },
      ],
    });

    expect(key).toBe('connection-expiring-soon:mcp:mcp-expiring:2026-03-27T11:00:00.000Z');
    expect(notifications).toEqual([
      expect.objectContaining({
        id: key,
        readAt: new Date('2026-03-25T13:00:00.000Z'),
      }),
    ]);
  });

  it('prefilters source queries to active records in the expiration window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const mcpFindMany = vi.fn().mockResolvedValue([]);
    const browserFindMany = vi.fn().mockResolvedValue([]);
    const client = {
      query: {
        mcpConnections: {
          findMany: mcpFindMany,
        },
        browserSessions: {
          findMany: browserFindMany,
        },
        connectionNotificationReads: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    };
    const windowEnd = new Date(NOW.getTime() + EXPIRING_SOON_WINDOW_MS);

    await listConnectionExpirationNotifications({ ownerId: OWNER_ID }, client as never);

    expect(mcpFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: and(
          eq(mcpConnections.ownerId, OWNER_ID),
          isNull(mcpConnections.revokedAt),
          gt(mcpConnections.expiresAt, NOW),
          lte(mcpConnections.expiresAt, windowEnd),
        ),
      }),
    );
    expect(browserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: and(
          eq(browserSessions.ownerId, OWNER_ID),
          isNull(browserSessions.revokedAt),
          gt(browserSessions.expiresAt, NOW),
          lte(browserSessions.expiresAt, windowEnd),
        ),
      }),
    );
  });

  it('falls back to unread notifications when connection read storage is missing', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const missingReadsError = Object.assign(new Error('Failed query'), {
      cause: Object.assign(new Error('relation "connection_notification_reads" does not exist'), {
        code: '42P01',
      }),
    });
    const mcpFindMany = vi.fn().mockResolvedValue([
      {
        id: 'mcp-expiring',
        displayName: 'Codex',
        redirectUri: 'http://127.0.0.1:3456/callback',
        expiresAt: new Date('2026-03-27T11:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
      },
    ]);
    const client = {
      query: {
        mcpConnections: {
          findMany: mcpFindMany,
        },
        browserSessions: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        connectionNotificationReads: {
          findMany: vi.fn().mockRejectedValue(missingReadsError),
        },
      },
    };

    const result = await listConnectionExpirationNotifications(
      { ownerId: OWNER_ID },
      client as never,
    );

    expect(result.notifications).toEqual([
      expect.objectContaining({
        id: 'connection-expiring-soon:mcp:mcp-expiring:2026-03-27T11:00:00.000Z',
        readAt: null,
      }),
    ]);
  });
});
