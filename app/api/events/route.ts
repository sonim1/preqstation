import { and, asc, desc, eq, gt } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withOwnerDb } from '@/lib/db/rls';
import { eventsOutbox } from '@/lib/db/schema';
import { requireOwnerUser } from '@/lib/owner';

const MAX_EVENTS = 100;

function parseAfterCursor(value: string | null) {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return undefined;
  return BigInt(value);
}

function serializeEvent(event: typeof eventsOutbox.$inferSelect) {
  return {
    id: event.id.toString(),
    projectId: event.projectId,
    eventType: event.eventType,
    entityType: event.entityType,
    entityId: event.entityId,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const owner = await requireOwnerUser();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const after = parseAfterCursor(searchParams.get('after'));

    if (after === undefined) {
      return NextResponse.json({ error: 'Invalid after cursor' }, { status: 400 });
    }

    return await withOwnerDb(owner.id, async (client) => {
      const scope = and(
        eq(eventsOutbox.ownerId, owner.id),
        projectId ? eq(eventsOutbox.projectId, projectId) : undefined,
      );

      if (after === null) {
        const [latestEvent] = await client.query.eventsOutbox.findMany({
          where: scope,
          columns: { id: true },
          orderBy: [desc(eventsOutbox.id)],
          limit: 1,
        });

        return NextResponse.json({
          events: [],
          cursor: latestEvent?.id.toString() ?? null,
          staleCursor: false,
        });
      }

      const [oldestEvent] = await client.query.eventsOutbox.findMany({
        where: scope,
        columns: { id: true },
        orderBy: [asc(eventsOutbox.id)],
        limit: 1,
      });

      if (oldestEvent && after < oldestEvent.id) {
        return NextResponse.json({
          events: [],
          cursor: oldestEvent.id.toString(),
          staleCursor: true,
        });
      }

      const events = await client.query.eventsOutbox.findMany({
        where: and(scope, gt(eventsOutbox.id, after)),
        orderBy: [asc(eventsOutbox.id)],
        limit: MAX_EVENTS,
      });
      const cursor = events.at(-1)?.id.toString() ?? after.toString();

      return NextResponse.json({
        events: events.map(serializeEvent),
        cursor,
        staleCursor: false,
      });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
  }
}
