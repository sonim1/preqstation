import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateApiToken } from '@/lib/api-tokens';
import { TODO_NOTE_MAX_LENGTH } from '@/lib/content-limits';
import { withOwnerDb } from '@/lib/db/rls';
import { taskComments, workLogs } from '@/lib/db/schema';
import { ENGINE_KEYS, normalizeEngineKey } from '@/lib/engine-icons';
import { renderTaskCommentWorkLogDetail, serializeTaskComment } from '@/lib/task-comments';

const replyCommentSchema = z.object({
  body: z.string().trim().min(1).max(TODO_NOTE_MAX_LENGTH),
  noteUpdated: z.boolean().optional(),
  note_updated: z.boolean().optional(),
  engine: z.enum(ENGINE_KEYS).optional().or(z.literal('')),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiToken(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const parsed = replyCommentSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    return await withOwnerDb(auth.ownerId, async (client) => {
      const parent = await client.query.taskComments.findFirst({
        where: and(eq(taskComments.ownerId, auth.ownerId), eq(taskComments.id, id)),
      });
      if (!parent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const engine = normalizeEngineKey(parsed.data.engine) ?? parent.engine;
      const noteUpdated = parsed.data.note_updated ?? parsed.data.noteUpdated ?? false;
      const [reply] = await client
        .insert(taskComments)
        .values({
          ownerId: auth.ownerId,
          projectId: parent.projectId,
          taskId: parent.taskId,
          parentCommentId: parent.id,
          authorType: 'agent',
          authorName: engine || 'agent',
          body: parsed.data.body,
          runState: 'done',
          runStateUpdatedAt: new Date(),
          engine,
          metadata: parsed.data.metadata ?? null,
        })
        .returning();

      await client.insert(workLogs).values({
        ownerId: auth.ownerId,
        projectId: parent.projectId,
        taskId: parent.taskId,
        title: 'Agent replied to comment',
        detail: renderTaskCommentWorkLogDetail({
          userCommentBody: parent.body,
          agentReplyBody: parsed.data.body,
          noteUpdated,
          commentId: parent.id,
          engine,
        }),
        engine,
      });

      return NextResponse.json({ reply: serializeTaskComment(reply) }, { status: 201 });
    });
  } catch (error) {
    console.error('Failed to reply to task comment', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
