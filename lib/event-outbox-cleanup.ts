import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';

export const EVENT_OUTBOX_LAST_CLEANED_AT_KEY = 'events_outbox_last_cleaned_at';
export const EVENT_OUTBOX_RETENTION_DAYS = 1;
export const EVENT_OUTBOX_RETENTION_MS = EVENT_OUTBOX_RETENTION_DAYS * 24 * 60 * 60 * 1000;

type CleanupClient = Pick<typeof db, 'execute' | 'insert' | 'query'>;

function parseTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getEventOutboxCleanupCutoff(now = new Date()) {
  return new Date(now.getTime() - EVENT_OUTBOX_RETENTION_MS);
}

export function buildEventOutboxCleanupQuery(ownerId: string, cutoff: Date) {
  const cutoffIso = cutoff.toISOString();
  return sql`
    delete from events_outbox
    where owner_id = ${ownerId}
      and created_at < ${cutoffIso}::timestamptz
  `;
}

export async function cleanupEventOutboxIfDue(
  { ownerId, now = new Date() }: { ownerId: string; now?: Date },
  client: CleanupClient = db,
) {
  const lastCleanedSetting = await client.query.userSettings.findFirst({
    where: and(
      eq(userSettings.ownerId, ownerId),
      eq(userSettings.key, EVENT_OUTBOX_LAST_CLEANED_AT_KEY),
    ),
    columns: { value: true },
  });

  const lastCleanedAt = parseTimestamp(lastCleanedSetting?.value);
  if (lastCleanedAt && now.getTime() - lastCleanedAt.getTime() < EVENT_OUTBOX_RETENTION_MS) {
    return { didRun: false, deleted: 0 };
  }

  const cutoff = getEventOutboxCleanupCutoff(now);
  const result = await client.execute(buildEventOutboxCleanupQuery(ownerId, cutoff));

  await client
    .insert(userSettings)
    .values({
      ownerId,
      key: EVENT_OUTBOX_LAST_CLEANED_AT_KEY,
      value: now.toISOString(),
    })
    .onConflictDoUpdate({
      target: [userSettings.ownerId, userSettings.key],
      set: { value: now.toISOString() },
    });

  return { didRun: true, deleted: result.count ?? 0 };
}
