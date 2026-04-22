import { and, desc, eq, gte, isNull } from 'drizzle-orm';

import { withOwnerDb } from '@/lib/db/rls';
import { browserSessions } from '@/lib/db/schema';

export const BROWSER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const browserSessionColumns = {
  id: true,
  ownerId: true,
  ipAddress: true,
  userAgent: true,
  browserName: true,
  osName: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const browserSessionReturning = {
  id: browserSessions.id,
  ownerId: browserSessions.ownerId,
  ipAddress: browserSessions.ipAddress,
  userAgent: browserSessions.userAgent,
  browserName: browserSessions.browserName,
  osName: browserSessions.osName,
  lastUsedAt: browserSessions.lastUsedAt,
  expiresAt: browserSessions.expiresAt,
  revokedAt: browserSessions.revokedAt,
  createdAt: browserSessions.createdAt,
  updatedAt: browserSessions.updatedAt,
} as const;

function parseBrowserName(userAgent?: string | null) {
  if (!userAgent) return null;
  if (/edg\//i.test(userAgent)) return 'Edge';
  if (/opr\//i.test(userAgent)) return 'Opera';
  if (/firefox\//i.test(userAgent)) return 'Firefox';
  if (/(chrome|crios)\//i.test(userAgent)) return 'Chrome';
  if (/safari\//i.test(userAgent) && !/(chrome|crios|android)\//i.test(userAgent)) {
    return 'Safari';
  }
  if (/trident\/|msie /i.test(userAgent)) return 'Internet Explorer';
  return 'Unknown';
}

function parseOsName(userAgent?: string | null) {
  if (!userAgent) return null;
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
  if (/android/i.test(userAgent)) return 'Android';
  if (/cros/i.test(userAgent)) return 'ChromeOS';
  if (/macintosh|mac os x/i.test(userAgent)) return 'macOS';
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/linux/i.test(userAgent)) return 'Linux';
  return 'Unknown';
}

export async function createBrowserSession(input: {
  ownerId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + BROWSER_SESSION_MAX_AGE_SECONDS * 1000);
  const ipAddress = input.ipAddress ?? null;
  const userAgent = input.userAgent ?? null;
  const browserName = parseBrowserName(input.userAgent);
  const osName = parseOsName(input.userAgent);

  return withOwnerDb(input.ownerId, async (client) => {
    const existing = await client.query.browserSessions.findFirst({
      where: and(
        eq(browserSessions.ownerId, input.ownerId),
        ipAddress === null
          ? isNull(browserSessions.ipAddress)
          : eq(browserSessions.ipAddress, ipAddress),
        userAgent === null
          ? isNull(browserSessions.userAgent)
          : eq(browserSessions.userAgent, userAgent),
        browserName === null
          ? isNull(browserSessions.browserName)
          : eq(browserSessions.browserName, browserName),
        osName === null ? isNull(browserSessions.osName) : eq(browserSessions.osName, osName),
        isNull(browserSessions.revokedAt),
        gte(browserSessions.expiresAt, now),
      ),
      columns: {
        id: true,
      },
      orderBy: [desc(browserSessions.lastUsedAt), desc(browserSessions.createdAt)],
    });

    if (existing) {
      const [updated] = await client
        .update(browserSessions)
        .set({
          lastUsedAt: now,
          expiresAt,
          revokedAt: null,
        })
        .where(and(eq(browserSessions.ownerId, input.ownerId), eq(browserSessions.id, existing.id)))
        .returning(browserSessionReturning);

      return updated ?? null;
    }

    const [created] = await client
      .insert(browserSessions)
      .values({
        ownerId: input.ownerId,
        ipAddress,
        userAgent,
        browserName,
        osName,
        lastUsedAt: now,
        expiresAt,
      })
      .returning(browserSessionReturning);

    return created ?? null;
  });
}

export async function getBrowserSessionForOwner(input: { ownerId: string; sessionId: string }) {
  return withOwnerDb(input.ownerId, (client) =>
    client.query.browserSessions.findFirst({
      where: and(
        eq(browserSessions.ownerId, input.ownerId),
        eq(browserSessions.id, input.sessionId),
      ),
      columns: browserSessionColumns,
    }),
  );
}

export async function listOwnerBrowserSessions(ownerId: string) {
  return withOwnerDb(ownerId, (client) =>
    client.query.browserSessions.findMany({
      where: eq(browserSessions.ownerId, ownerId),
      columns: browserSessionColumns,
      orderBy: [desc(browserSessions.lastUsedAt), desc(browserSessions.createdAt)],
    }),
  );
}

export async function touchBrowserSession(input: {
  ownerId: string;
  sessionId: string;
  lastUsedAt?: Date;
}) {
  const lastUsedAt = input.lastUsedAt ?? new Date();

  return withOwnerDb(input.ownerId, async (client) => {
    const [updated] = await client
      .update(browserSessions)
      .set({ lastUsedAt })
      .where(
        and(eq(browserSessions.ownerId, input.ownerId), eq(browserSessions.id, input.sessionId)),
      )
      .returning({
        id: browserSessions.id,
        lastUsedAt: browserSessions.lastUsedAt,
      });

    return updated ?? null;
  });
}

export async function revokeBrowserSession(input: {
  ownerId: string;
  sessionId: string;
  revokedAt?: Date;
}) {
  const revokedAt = input.revokedAt ?? new Date();

  return withOwnerDb(input.ownerId, async (client) => {
    const [updated] = await client
      .update(browserSessions)
      .set({ revokedAt })
      .where(
        and(eq(browserSessions.ownerId, input.ownerId), eq(browserSessions.id, input.sessionId)),
      )
      .returning({
        id: browserSessions.id,
        revokedAt: browserSessions.revokedAt,
      });

    return updated ?? null;
  });
}
