import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { normalizeAgentModel } from '@/lib/agent-model-catalog';
import { authenticateApiToken } from '@/lib/api-tokens';
import { writeAuditLog } from '@/lib/audit';
import { TODO_NOTE_MAX_LENGTH } from '@/lib/content-limits';
import { withOwnerDb } from '@/lib/db/rls';
import { taskComments, tasks } from '@/lib/db/schema';
import { ENGINE_KEYS, normalizeEngineKey } from '@/lib/engine-icons';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';
import { serializeTaskComment } from '@/lib/task-comments';
import { normalizeTaskDispatchTarget } from '@/lib/task-dispatch';
import { taskWhereByIdentifier } from '@/lib/task-keys';
import { syncTaskRunStateFromExecutionState } from '@/lib/task-run-state';
import { buildTaskCommentDispatchMessage } from '@/lib/task-telegram-client';
import { sendTelegramMessage } from '@/lib/telegram';
import { decryptTelegramToken } from '@/lib/telegram-crypto';
import { resolveTelegramDispatchConfig } from '@/lib/telegram-dispatch-settings';
import { getUserSettings, SETTING_KEYS } from '@/lib/user-settings';

type CommentAuth = { ownerId: string; ownerEmail: string | null; source: 'api-token' | 'session' };

async function authenticateTaskCommentRequest(req: Request): Promise<CommentAuth | null> {
  const apiAuth = await authenticateApiToken(req);
  if (apiAuth) {
    return { ownerId: apiAuth.ownerId, ownerEmail: apiAuth.ownerEmail, source: 'api-token' };
  }
  try {
    const owner = await requireOwnerUser();
    return { ownerId: owner.id, ownerEmail: owner.email, source: 'session' };
  } catch (error) {
    if (error instanceof Response && error.status === 401) return null;
    throw error;
  }
}

const createTaskCommentSchema = z.object({
  body: z.string().trim().min(1).max(TODO_NOTE_MAX_LENGTH),
  dispatch: z.boolean().optional(),
  engine: z.enum(ENGINE_KEYS).optional().or(z.literal('')),
  model: z.string().trim().optional().or(z.literal('')),
  dispatchTarget: z.string().trim().optional().or(z.literal('')),
  dispatch_target: z.string().trim().optional().or(z.literal('')),
});

async function markTaskCommentDispatchFailed(
  ownerId: string,
  commentId: string,
  errorMessage: string,
) {
  const comment = await withOwnerDb(ownerId, async (client) => {
    const [updated] = await client
      .update(taskComments)
      .set({
        runState: 'failed',
        runStateUpdatedAt: new Date(),
        errorMessage,
      })
      .where(eq(taskComments.id, commentId))
      .returning();
    if (updated) {
      await syncTaskRunStateFromExecutionState({ client, ownerId, taskId: updated.taskId });
    }
    return updated;
  });
  return comment;
}

async function buildTaskCommentDispatchFailureResponse({
  ownerId,
  task,
  comment,
  engine,
  model,
  dispatchTarget,
  errorMessage,
}: {
  ownerId: string;
  task: { taskPrefix: string; taskKey: string };
  comment: typeof taskComments.$inferSelect;
  engine: string | null;
  model: string | null;
  dispatchTarget: string | null;
  errorMessage: string;
}) {
  const failedComment =
    (await markTaskCommentDispatchFailed(ownerId, comment.id, errorMessage)) || comment;
  return NextResponse.json(
    {
      comment: serializeTaskComment(failedComment),
      dispatch: {
        objective: 'comment',
        project_key: task.taskPrefix,
        task_key: task.taskKey,
        comment_id: comment.id,
        engine,
        model,
        dispatch_target: dispatchTarget,
        status: 'failed',
        error: errorMessage,
      },
    },
    { status: 201 },
  );
}

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
    if (auth.source === 'session') {
      const originError = await assertSameOrigin(req);
      if (originError) return originError;
    }
    const { id } = await params;
    const parsed = createTaskCommentSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const created = await withOwnerDb(auth.ownerId, async (client) => {
      const task = await client.query.tasks.findFirst({
        where: and(
          taskWhereByIdentifier(auth.ownerId, id),
          or(
            isNull(tasks.projectId),
            sql`EXISTS (SELECT 1 FROM projects WHERE projects.id = ${tasks.projectId} AND projects.deleted_at IS NULL)`,
          ),
        ),
        columns: {
          id: true,
          projectId: true,
          taskKey: true,
          taskPrefix: true,
          status: true,
          branch: true,
          engine: true,
          dispatchTarget: true,
        },
      });
      if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const engine = normalizeEngineKey(parsed.data.engine) ?? normalizeEngineKey(task.engine);
      const model = normalizeAgentModel(parsed.data.model);
      const dispatchTarget =
        normalizeTaskDispatchTarget(parsed.data.dispatch_target || parsed.data.dispatchTarget) ??
        normalizeTaskDispatchTarget(task.dispatchTarget) ??
        'telegram';
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

      if (runState) {
        await syncTaskRunStateFromExecutionState({
          client,
          ownerId: auth.ownerId,
          taskId: task.id,
        });
      }

      return { task, comment, engine, model, dispatchTarget, runState };
    });

    if (created instanceof NextResponse) return created;

    let dispatch: Record<string, unknown> | null = null;
    if (created.runState) {
      const settings = await getUserSettings(auth.ownerId);
      const target = created.dispatchTarget === 'hermes-telegram' ? 'hermes' : 'openclaw';
      const { enabled, encryptedToken, chatId } = resolveTelegramDispatchConfig(settings, target);
      if (!enabled || !encryptedToken || !chatId) {
        const errorMessage = 'Telegram is not fully configured or disabled';
        return buildTaskCommentDispatchFailureResponse({
          ownerId: auth.ownerId,
          task: created.task,
          comment: created.comment,
          engine: created.engine,
          model: created.model,
          dispatchTarget: created.dispatchTarget,
          errorMessage,
        });
      }

      let botToken = '';
      try {
        botToken = await decryptTelegramToken(encryptedToken);
      } catch (error) {
        console.error('[api/tasks/comments] failed to decrypt Telegram bot token:', error);
        const errorMessage = 'Telegram bot token is invalid. Save Telegram settings again.';
        return buildTaskCommentDispatchFailureResponse({
          ownerId: auth.ownerId,
          task: created.task,
          comment: created.comment,
          engine: created.engine,
          model: created.model,
          dispatchTarget: created.dispatchTarget,
          errorMessage,
        });
      }

      const message = buildTaskCommentDispatchMessage({
        taskKey: created.task.taskKey,
        status: created.task.status,
        engine: created.engine,
        model: created.model,
        branchName: created.task.branch,
        commentId: created.comment.id,
        dispatchTarget: created.dispatchTarget,
        hermesBotUsername: settings[SETTING_KEYS.HERMES_TELEGRAM_BOT_USERNAME],
      });

      const result = await sendTelegramMessage(botToken, chatId, message, {
        normalizeCommand: created.dispatchTarget !== 'hermes-telegram',
      });
      if (!result.ok) {
        const errorMessage = result.description || 'Failed to send Telegram message';
        return buildTaskCommentDispatchFailureResponse({
          ownerId: auth.ownerId,
          task: created.task,
          comment: created.comment,
          engine: created.engine,
          model: created.model,
          dispatchTarget: created.dispatchTarget,
          errorMessage,
        });
      }

      await writeAuditLog({
        ownerId: auth.ownerId,
        action: 'telegram.comment_dispatch_sent',
        targetType: 'task_comment',
        targetId: created.comment.id,
        meta: { chatId, taskKey: created.task.taskKey, dispatchTarget: created.dispatchTarget },
      });

      dispatch = {
        objective: 'comment',
        project_key: created.task.taskPrefix,
        task_key: created.task.taskKey,
        comment_id: created.comment.id,
        engine: created.engine,
        model: created.model,
        dispatch_target: created.dispatchTarget,
        message,
      };
    }

    return NextResponse.json(
      {
        comment: serializeTaskComment(created.comment),
        dispatch,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Failed to create task comment', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
