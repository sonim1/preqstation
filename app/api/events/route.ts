import { and, asc, eq, gt } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withOwnerDb } from '@/lib/db/rls';
import { eventsOutbox } from '@/lib/db/schema';
import { cleanupEventOutboxIfDue } from '@/lib/event-outbox-cleanup';
import { getOwnerUserOrNull } from '@/lib/owner';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parseAfter(value: string | null) {
  if (!value) return 0n;
  try {
    const parsed = BigInt(value);
    return parsed >= 0n ? parsed : 0n;
  } catch {
    return 0n;
  }
}

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(request: Request) {
  try {
    const owner = await getOwnerUserOrNull();
    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const after = parseAfter(searchParams.get('after'));
    const limit = parseLimit(searchParams.get('limit'));
    const projectId = searchParams.get('projectId')?.trim() || null;

    const rows = await withOwnerDb(owner.id, async (client) => {
      await cleanupEventOutboxIfDue({ ownerId: owner.id }, client);

      const filters = [gt(eventsOutbox.id, after)];
      if (projectId) {
        filters.push(eq(eventsOutbox.projectId, projectId));
      }

      return client
        .select({
          id: eventsOutbox.id,
          eventType: eventsOutbox.eventType,
          entityType: eventsOutbox.entityType,
          entityId: eventsOutbox.entityId,
          payload: eventsOutbox.payload,
          createdAt: eventsOutbox.createdAt,
        })
        .from(eventsOutbox)
        .where(and(...filters))
        .orderBy(asc(eventsOutbox.id))
        .limit(limit);
    });

    return NextResponse.json({
      events: rows.map((row) => ({
        id: String(row.id),
        eventType: row.eventType,
        entityType: row.entityType,
        entityId: row.entityId,
        payload: row.payload,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: rows.length > 0 ? String(rows[rows.length - 1]?.id) : null,
    });
  } catch (error) {
    console.error('[api/events] GET error:', error);
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
  }
}
