import { withAdminDb, withOwnerDb } from '@/lib/db/rls';
import { securityEvents } from '@/lib/db/schema';

type SecurityEventInput = {
  ownerId?: string | null;
  actorEmail?: string | null;
  eventType: string;
  outcome: 'allowed' | 'blocked' | 'error';
  ipAddress?: string | null;
  userAgent?: string | null;
  path?: string | null;
  detail?: unknown;
};

export async function writeSecurityEvent(event: SecurityEventInput) {
  try {
    const payload = {
      ownerId: event.ownerId ?? null,
      actorEmail: event.actorEmail ?? null,
      eventType: event.eventType,
      outcome: event.outcome,
      ipAddress: event.ipAddress ?? null,
      userAgent: event.userAgent ?? null,
      path: event.path ?? null,
      detail: event.detail,
    };

    if (event.ownerId) {
      await withOwnerDb(event.ownerId, async (client) => {
        await client.insert(securityEvents).values(payload);
      });
      return;
    }

    await withAdminDb(async (client) => {
      await client.insert(securityEvents).values(payload);
    });
  } catch {
    // Do not block the main flow if security event persistence fails.
  }
}
