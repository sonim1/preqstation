import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { withOwnerDb } from '@/lib/db/rls';
import { tasks } from '@/lib/db/schema';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';

const archiveDoneSchema = z.object({
  projectId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const body = (await req.json()) as Record<string, unknown>;
    const { projectId } = archiveDoneSchema.parse(body);

    return await withOwnerDb(owner.id, async (client) => {
      const conditions = [eq(tasks.ownerId, owner.id), eq(tasks.status, 'done')];
      if (projectId) conditions.push(eq(tasks.projectId, projectId));

      const updated = await client
        .update(tasks)
        .set({ status: 'archived', archivedAt: new Date() })
        .where(and(...conditions))
        .returning({ id: tasks.id });

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: 'task.batch_archived',
          targetType: 'task',
          targetId: 'batch',
          meta: { count: updated.length, projectId: projectId ?? null },
        },
        client,
      );

      return NextResponse.json({ count: updated.length });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    console.error('[todos.archive-done] failed:', error);
    return NextResponse.json({ error: 'Failed to archive done tasks' }, { status: 500 });
  }
}
