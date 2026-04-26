import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { createDispatchRequest } from '@/lib/dispatch-request-store';
import { ENGINE_KEYS } from '@/lib/engine-icons';
import { TASK_DISPATCH_OBJECTIVES } from '@/lib/openclaw-command';
import { ENTITY_TASK, TASK_UPDATED, writeOutboxEventStandalone } from '@/lib/outbox';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';
import { queueTaskExecutionByTaskKey } from '@/lib/task-run-state';

export const dynamic = 'force-dynamic';

const sendSchema = z.object({
  taskKey: z.string().trim().min(1),
  engine: z.enum(ENGINE_KEYS).optional().or(z.literal('')),
  branchName: z.string().trim().optional().or(z.literal('')),
  objective: z.enum(TASK_DISPATCH_OBJECTIVES).optional().or(z.literal('')),
  askHint: z.string().trim().optional().or(z.literal('')),
});

export async function POST(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const payload = sendSchema.parse(await req.json());

    const queuedTask = await queueTaskExecutionByTaskKey({
      ownerId: owner.id,
      taskKey: payload.taskKey,
      dispatchTarget: 'claude-code-channel',
      engine: payload.engine || null,
      branch: payload.branchName || null,
    });

    if (!queuedTask) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (payload.objective && payload.objective !== 'default') {
      await createDispatchRequest({
        ownerId: owner.id,
        scope: 'task',
        objective: payload.objective,
        projectKey: payload.taskKey.split('-')[0] || payload.taskKey,
        taskKey: payload.taskKey,
        engine: payload.engine || null,
        dispatchTarget: 'claude-code-channel',
        branchName: payload.branchName || null,
        promptMetadata:
          payload.objective === 'ask'
            ? {
                askHint: payload.askHint || null,
              }
            : null,
      });
    }

    await writeOutboxEventStandalone({
      ownerId: owner.id,
      projectId: queuedTask.projectId,
      eventType: TASK_UPDATED,
      entityType: ENTITY_TASK,
      entityId: payload.taskKey,
      payload: {
        changedFields: ['runState', 'runStateUpdatedAt', 'dispatchTarget'],
      },
    });

    await writeAuditLog({
      ownerId: owner.id,
      action: 'dispatch.claude_code_queued',
      targetType: 'task',
      targetId: payload.taskKey,
      meta: {
        dispatchTarget: 'claude-code-channel',
        engine: payload.engine || null,
        branchName: payload.branchName || null,
        objective: payload.objective || 'default',
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    console.error('[api/dispatch/claude-code] POST failed:', error);
    return NextResponse.json({ error: 'Failed to queue Claude Code dispatch' }, { status: 500 });
  }
}
