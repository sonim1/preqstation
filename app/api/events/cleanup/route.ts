import { lt, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { eventsOutbox } from '@/lib/db/schema';
import { getEventOutboxCleanupCutoff } from '@/lib/event-outbox-cleanup';

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 1000;

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cutoff = getEventOutboxCleanupCutoff();
    const cutoffIso = cutoff.toISOString();

    const result = await db.execute(
      sql`DELETE FROM events_outbox WHERE id IN (SELECT id FROM events_outbox WHERE created_at < ${cutoffIso}::timestamptz LIMIT ${sql.raw(String(BATCH_SIZE))})`,
    );
    const deleted = result.count ?? 0;

    const [{ count: remaining }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventsOutbox)
      .where(lt(eventsOutbox.createdAt, cutoff));

    return NextResponse.json({ deleted, remaining });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/events/cleanup] POST error:', message, error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
