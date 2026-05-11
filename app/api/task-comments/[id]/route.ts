import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateApiToken } from '@/lib/api-tokens';
import { withOwnerDb } from '@/lib/db/rls';
import { taskComments, workLogs } from '@/lib/db/schema';
import { ENGINE_KEYS, normalizeEngineKey } from '@/lib/engine-icons';
import { getOwnerUserOrNull } from '@/lib/owner';
import {
  normalizeTaskCommentRunState,
  renderTaskCommentWorkLogDetail,
  serializeTaskComment,
  syncTaskRunStateFromComments,
} from '@/lib/task-comments';

type CommentAuth = { ownerId: string; ownerEmail: string | null };

async function authenticateCommentRequest(req: Request): Promise<CommentAuth | null> {
  const apiAuth = await authenticateApiToken(req);
  if (apiAuth) {
    return { ownerId: apiAuth.ownerId, ownerEmail: apiAuth.ownerEmail };
  }
  const owner = await getOwnerUserOrNull();
  if (!owner) {
    return null;
  }
  return { ownerId: owner.id, ownerEmail: owner.email };
}

const updateCommentSchema = z.object({
  runState: z.string().optional(),
  run_state: z.string().optional(),
  errorMessage: z.string().trim().max(4000).optional().or(z.literal('')),
  error_message: z.string().trim().max(4000).optional().or(z.literal('')),
  engine: z.enum(ENGINE_KEYS).optional().or(z.literal('')),
});

function readRunState(input: z.infer<typeof updateCommentSchema>) {
  return normalizeTaskCommentRunState(input.run_state ?? input.runState);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateCommentRequest(_req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    return await withOwnerDb(auth.ownerId, async (client) => {
      const comment = await client.query.taskComments.findFirst({
        where: and(eq(taskComments.ownerId, auth.ownerId), eq(taskComments.id, id)),
        with: { task: true },
      });
      if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      return NextResponse.json({ comment: serializeTaskComment(comment), task: comment.task });
    });
  } catch (error) {
    console.error('Failed to get task comment', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateCommentRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const parsed = updateCommentSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const runState = readRunState(parsed.data);
    if ((parsed.data.runState || parsed.data.run_state) && !runState) {
      return NextResponse.json({ error: 'Invalid run state' }, { status: 400 });
    }

    return await withOwnerDb(auth.ownerId, async (client) => {
      const existing = await client.query.taskComments.findFirst({
        where: and(eq(taskComments.ownerId, auth.ownerId), eq(taskComments.id, id)),
      });
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const errorMessage = parsed.data.error_message ?? parsed.data.errorMessage ?? null;
      const engine = normalizeEngineKey(parsed.data.engine) ?? existing.engine;
      const [comment] = await client
        .update(taskComments)
        .set({
          runState: runState ?? existing.runState,
          runStateUpdatedAt:
            runState && runState !== existing.runState ? new Date() : existing.runStateUpdatedAt,
          errorMessage: errorMessage || null,
          engine,
        })
        .where(and(eq(taskComments.ownerId, auth.ownerId), eq(taskComments.id, id)))
        .returning();

      if (runState && runState !== existing.runState) {
        await syncTaskRunStateFromComments({
          client,
          ownerId: auth.ownerId,
          taskId: existing.taskId,
        });
      }

      if (runState === 'failed') {
        await client.insert(workLogs).values({
          ownerId: auth.ownerId,
          projectId: existing.projectId,
          taskId: existing.taskId,
          title: 'Comment handling failed',
          detail: renderTaskCommentWorkLogDetail({
            userCommentBody: existing.body,
            errorMessage: errorMessage || 'Comment handling failed.',
            noteUpdated: false,
            commentId: existing.id,
            engine,
          }),
          engine,
        });
      }

      return NextResponse.json({ comment: serializeTaskComment(comment) });
    });
  } catch (error) {
    console.error('Failed to update task comment', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
