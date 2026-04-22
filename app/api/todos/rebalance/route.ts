import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withOwnerDb } from '@/lib/db/rls';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';
import { TASK_STATUSES } from '@/lib/task-meta';
import { repairLaneIfNeeded } from '@/lib/task-sort-order';

const rebalanceSchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
});

export async function POST(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const body = (await req.json()) as Record<string, unknown>;
    const payload = rebalanceSchema.parse(body);

    const statuses = payload.status ? [payload.status] : [...TASK_STATUSES];

    return await withOwnerDb(owner.id, async (client) => {
      let updatedCount = 0;

      for (const status of statuses) {
        const { rows, repaired } = await repairLaneIfNeeded({
          client,
          ownerId: owner.id,
          status,
        });
        if (repaired) {
          updatedCount += rows.length;
        }
      }

      return NextResponse.json({ ok: true, updatedCount });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    console.error('[todos.rebalance] failed:', error);
    return NextResponse.json({ error: 'Failed to rebalance' }, { status: 500 });
  }
}
