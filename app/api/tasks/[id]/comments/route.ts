import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateApiToken } from '@/lib/api-tokens';
import { TODO_NOTE_MAX_LENGTH } from '@/lib/content-limits';
import { withOwnerDb } from '@/lib/db/rls';
import { taskComments, tasks } from '@/lib/db/schema';
import { ENGINE_KEYS, normalizeEngineKey } from '@/lib/engine-icons';
import { getOwnerUserOrNull } from '@/lib/owner';
import { serializeTaskComment } from '@/lib/task-comments';
import { taskWhereByIdentifier } from '@/lib/task-keys';

type CommentAuth = { ownerId: string; ownerEmail: string | null };

async function authenticateTaskCommentRequest(req: Request): Promise<CommentAuth | null> {
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

const createTaskCommentSchema = z.object({
  body: z.string().trim().min(1).max(TODO_NOTE_MAX_LENGTH),
  dispatch: z.boolean().optional(),
  engine: z.enum(ENGINE_KEYS).optional().or(z.literal('')),
  dispatchTarget: z.string().trim().optional().or(z.literal('')),
  dispatch_target: z.string().trim().optional().or(z.literal('')),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateTaskCommentRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    return await withOwnerDb(auth.ownerId, async (client) => {
      const task = await client.query.tasks.findFirst({
        where: and(
          taskWhereByIdentifier(auth.ownerId, id),
          or(
            isNull(tasks.projectId),
            sql`EXISTS (SELECT 1 FROM projects WHERE projects.id = ${tasks.projectId} AND projects.deleted_at IS NULL)`,
          ),
        ),
        columns: { id: true, taskKey: true, taskPrefix: true, projectId: true },
      });
      if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const comments = await client.query.taskComments.findMany({
        where: eq(taskComments.taskId, task.id),
        orderBy: [asc(taskComments.createdAt)],
      });

      return NextResponse.json({
        task: { id: task.id, task_key: task.taskKey, project_id: task.projectId },
        count: comments.length,
        comments: comments.map(serializeTaskComment),
      });
    });
  } catch (error) {
    console.error('Failed to list task comments', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateTaskCommentRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const parsed = createTaskCommentSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    return await withOwnerDb(auth.ownerId, async (client) => {
      const task = await client.query.tasks.findFirst({
        where: and(
          taskWhereByIdentifier(auth.ownerId, id),
          or(
            isNull(tasks.projectId),
            sql`EXISTS (SELECT 1 FROM projects WHERE projects.id = ${tasks.projectId} AND projects.deleted_at IS NULL)`,
          ),
        ),
        columns: { id: true, projectId: true, taskKey: true, taskPrefix: true },
      });
      if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const engine = normalizeEngineKey(parsed.data.engine) ?? null;
      const dispatchTarget = parsed.data.dispatch_target || parsed.data.dispatchTarget || null;
      const runState = parsed.data.dispatch === false ? null : 'queued';
      const [comment] = await client
        .insert(taskComments)
        .values({
          ownerId: auth.ownerId,
          projectId: task.projectId,
          taskId: task.id,
          authorType: 'user',
          authorName: auth.ownerEmail,
          body: parsed.data.body,
          runState,
          runStateUpdatedAt: runState ? new Date() : null,
          engine,
          dispatchTarget,
        })
        .returning();

      return NextResponse.json(
        {
          comment: serializeTaskComment(comment),
          dispatch: runState
            ? {
                objective: 'comment',
                project_key: task.taskPrefix,
                task_key: task.taskKey,
                comment_id: comment.id,
                engine,
              }
            : null,
        },
        { status: 201 },
      );
    });
  } catch (error) {
    console.error('Failed to create task comment', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
