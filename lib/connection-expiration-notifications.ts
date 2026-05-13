import { and, eq, gt, inArray, isNull, lte } from 'drizzle-orm';

import { EXPIRING_SOON_WINDOW_MS, isConnectionExpiringSoon } from '@/lib/connection-expiration';
import { db } from '@/lib/db';
import { browserSessions, connectionNotificationReads, mcpConnections } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';

const DEFAULT_NOTIFICATION_LIMIT = 20;
const MAX_NOTIFICATION_LIMIT = 500;
const CONNECTION_NOTIFICATION_PREFIX = 'connection-expiring-soon:';

type McpConnectionExpirationSource = {
  id: string;
  displayName: string;
  redirectUri: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

type BrowserSessionExpirationSource = {
  id: string;
  ipAddress: string | null;
  browserName: string | null;
  osName: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

type ConnectionNotificationRead = {
  notificationKey: string;
  readAt: Date;
  createdAt: Date;
};

export type ConnectionExpirationNotificationSource = 'mcp' | 'browser';

export type ConnectionExpirationNotification = {
  id: string;
  type: 'connection-expiration';
  source: ConnectionExpirationNotificationSource;
  ownerId: string;
  title: string;
  targetName: string;
  targetDetail: string | null;
  expiresAt: Date;
  readAt: Date | null;
  createdAt: Date;
};

type BuildConnectionExpirationNotificationsParams = {
  ownerId: string;
  now: Date;
  mcpConnections: McpConnectionExpirationSource[];
  browserSessions: BrowserSessionExpirationSource[];
  reads: ConnectionNotificationRead[];
};

type ListConnectionExpirationNotificationsParams = {
  ownerId: string;
  history?: boolean;
  offset?: number;
  limit?: number;
  now?: Date;
};

type MarkConnectionExpirationNotificationsReadParams = {
  ownerId: string;
  notificationIds: string[];
  now?: Date;
};

function normalizeOffset(offset?: number) {
  if (!Number.isFinite(offset) || !offset || offset < 0) {
    return 0;
  }

  return Math.trunc(offset);
}

function clampLimit(limit?: number) {
  if (!Number.isFinite(limit) || !limit || limit < 1) {
    return DEFAULT_NOTIFICATION_LIMIT;
  }

  return Math.min(Math.trunc(limit), MAX_NOTIFICATION_LIMIT);
}

function formatRedirectLabel(redirectUri: string) {
  try {
    const url = new URL(redirectUri);
    return `${url.host}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return redirectUri.replace(/^[a-z]+:\/\//i, '');
  }
}

function notificationCreatedAt(recordCreatedAt: Date, expiresAt: Date) {
  return new Date(
    Math.max(recordCreatedAt.getTime(), expiresAt.getTime() - EXPIRING_SOON_WINDOW_MS),
  );
}

export function isConnectionExpirationNotificationId(id: string) {
  return id.startsWith(CONNECTION_NOTIFICATION_PREFIX);
}

function isMissingConnectionNotificationReadsRelationError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as {
    code?: string;
    message?: string;
    cause?: unknown;
  };
  const candidates = [maybeError, maybeError.cause].filter(
    (candidate): candidate is { code?: string; message?: string } =>
      !!candidate && typeof candidate === 'object',
  );

  return candidates.some(
    (candidate) =>
      (candidate.code === '42P01' || candidate.message?.includes('does not exist') === true) &&
      candidate.message?.includes('connection_notification_reads') === true,
  );
}

export function getConnectionExpirationNotificationKey(params: {
  source: ConnectionExpirationNotificationSource;
  recordId: string;
  expiresAt: Date;
}) {
  return `${CONNECTION_NOTIFICATION_PREFIX}${params.source}:${params.recordId}:${params.expiresAt.toISOString()}`;
}

export function buildConnectionExpirationNotifications(
  params: BuildConnectionExpirationNotificationsParams,
) {
  const now = params.now.getTime();
  const readsByKey = new Map(params.reads.map((read) => [read.notificationKey, read]));
  const notifications: ConnectionExpirationNotification[] = [];

  for (const connection of params.mcpConnections) {
    if (!isConnectionExpiringSoon(connection, now)) continue;

    const id = getConnectionExpirationNotificationKey({
      source: 'mcp',
      recordId: connection.id,
      expiresAt: connection.expiresAt,
    });
    const read = readsByKey.get(id);

    notifications.push({
      id,
      type: 'connection-expiration',
      source: 'mcp',
      ownerId: params.ownerId,
      title: 'Connection expires soon',
      targetName: connection.displayName,
      targetDetail: connection.redirectUri ? formatRedirectLabel(connection.redirectUri) : null,
      expiresAt: connection.expiresAt,
      readAt: read?.readAt ?? null,
      createdAt: notificationCreatedAt(connection.createdAt, connection.expiresAt),
    });
  }

  for (const session of params.browserSessions) {
    if (!isConnectionExpiringSoon(session, now)) continue;

    const id = getConnectionExpirationNotificationKey({
      source: 'browser',
      recordId: session.id,
      expiresAt: session.expiresAt,
    });
    const read = readsByKey.get(id);
    const browserName = session.browserName ?? 'Browser session';
    const osName = session.osName ?? 'OS not detected';
    const ipAddress = session.ipAddress ?? 'IP unavailable';

    notifications.push({
      id,
      type: 'connection-expiration',
      source: 'browser',
      ownerId: params.ownerId,
      title: 'Browser session expires soon',
      targetName: browserName,
      targetDetail: `${osName} · ${ipAddress}`,
      expiresAt: session.expiresAt,
      readAt: read?.readAt ?? null,
      createdAt: notificationCreatedAt(session.createdAt, session.expiresAt),
    });
  }

  return notifications.sort((left, right) => {
    const createdAtDelta = right.createdAt.getTime() - left.createdAt.getTime();
    if (createdAtDelta !== 0) return createdAtDelta;
    return right.id.localeCompare(left.id);
  });
}

async function listMcpConnectionSources(ownerId: string, now: Date, client: DbClientOrTx) {
  const windowEnd = new Date(now.getTime() + EXPIRING_SOON_WINDOW_MS);

  return client.query.mcpConnections.findMany({
    where: and(
      eq(mcpConnections.ownerId, ownerId),
      isNull(mcpConnections.revokedAt),
      gt(mcpConnections.expiresAt, now),
      lte(mcpConnections.expiresAt, windowEnd),
    ),
    columns: {
      id: true,
      displayName: true,
      redirectUri: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

async function listBrowserSessionSources(ownerId: string, now: Date, client: DbClientOrTx) {
  const windowEnd = new Date(now.getTime() + EXPIRING_SOON_WINDOW_MS);

  return client.query.browserSessions.findMany({
    where: and(
      eq(browserSessions.ownerId, ownerId),
      isNull(browserSessions.revokedAt),
      gt(browserSessions.expiresAt, now),
      lte(browserSessions.expiresAt, windowEnd),
    ),
    columns: {
      id: true,
      ipAddress: true,
      browserName: true,
      osName: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

async function listConnectionNotificationReads(
  ownerId: string,
  notificationKeys: string[],
  client: DbClientOrTx,
) {
  if (notificationKeys.length === 0) {
    return [] as ConnectionNotificationRead[];
  }

  try {
    return await client.query.connectionNotificationReads.findMany({
      where: and(
        eq(connectionNotificationReads.ownerId, ownerId),
        inArray(connectionNotificationReads.notificationKey, notificationKeys),
      ),
      columns: {
        notificationKey: true,
        readAt: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (isMissingConnectionNotificationReadsRelationError(error)) {
      return [];
    }
    throw error;
  }
}

async function listCurrentConnectionExpirationNotifications(
  params: { ownerId: string; now?: Date },
  client: DbClientOrTx,
) {
  const now = params.now ?? new Date();
  const mcpConnections = await listMcpConnectionSources(params.ownerId, now, client);
  const browserSessions = await listBrowserSessionSources(params.ownerId, now, client);
  const withoutReads = buildConnectionExpirationNotifications({
    ownerId: params.ownerId,
    now,
    mcpConnections,
    browserSessions,
    reads: [],
  });
  const reads = await listConnectionNotificationReads(
    params.ownerId,
    withoutReads.map((notification) => notification.id),
    client,
  );

  return buildConnectionExpirationNotifications({
    ownerId: params.ownerId,
    now,
    mcpConnections,
    browserSessions,
    reads,
  });
}

export async function listConnectionExpirationNotifications(
  params: ListConnectionExpirationNotificationsParams,
  client: DbClientOrTx = db,
) {
  const offset = normalizeOffset(params.offset);
  const limit = clampLimit(params.limit);
  const notifications = (await listCurrentConnectionExpirationNotifications(params, client)).filter(
    (notification) =>
      params.history ? notification.readAt !== null : notification.readAt === null,
  );
  const page = notifications.slice(offset, offset + limit);

  return {
    notifications: page,
    total: notifications.length,
    offset,
    limit,
    hasMore: offset + page.length < notifications.length,
  };
}

async function upsertConnectionNotificationReads(params: {
  ownerId: string;
  notificationKeys: string[];
  now: Date;
  client: DbClientOrTx;
}) {
  if (params.notificationKeys.length === 0) {
    return [];
  }

  try {
    const rows = await params.client
      .insert(connectionNotificationReads)
      .values(
        params.notificationKeys.map((notificationKey) => ({
          ownerId: params.ownerId,
          notificationKey,
          readAt: params.now,
          createdAt: params.now,
        })),
      )
      .onConflictDoUpdate({
        target: [connectionNotificationReads.ownerId, connectionNotificationReads.notificationKey],
        set: {
          readAt: params.now,
        },
      })
      .returning({
        notificationKey: connectionNotificationReads.notificationKey,
      });

    return rows.map((row) => row.notificationKey);
  } catch (error) {
    if (isMissingConnectionNotificationReadsRelationError(error)) {
      return [];
    }
    throw error;
  }
}

export async function markConnectionExpirationNotificationsRead(
  params: MarkConnectionExpirationNotificationsReadParams,
  client: DbClientOrTx = db,
) {
  const requestedIds = [
    ...new Set(
      params.notificationIds.map((id) => id.trim()).filter(isConnectionExpirationNotificationId),
    ),
  ];

  if (requestedIds.length === 0) {
    return [];
  }

  const requestedIdSet = new Set(requestedIds);
  const unreadNotifications = (await listCurrentConnectionExpirationNotifications(params, client))
    .filter((notification) => notification.readAt === null && requestedIdSet.has(notification.id))
    .map((notification) => notification.id);

  return upsertConnectionNotificationReads({
    ownerId: params.ownerId,
    notificationKeys: unreadNotifications,
    now: params.now ?? new Date(),
    client,
  });
}

export async function markAllConnectionExpirationNotificationsRead(
  params: Pick<MarkConnectionExpirationNotificationsReadParams, 'ownerId' | 'now'>,
  client: DbClientOrTx = db,
) {
  const unreadNotifications = (await listCurrentConnectionExpirationNotifications(params, client))
    .filter((notification) => notification.readAt === null)
    .map((notification) => notification.id);

  return upsertConnectionNotificationReads({
    ownerId: params.ownerId,
    notificationKeys: unreadNotifications,
    now: params.now ?? new Date(),
    client,
  });
}
