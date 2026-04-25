import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { ENTITY_TASK, TASK_UPDATED, writeOutboxEventStandalone } from '@/lib/outbox';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';
import { queueTaskExecutionByTaskKey } from '@/lib/task-run-state';
import { sendTelegramMessage } from '@/lib/telegram';
import { decryptTelegramToken } from '@/lib/telegram-crypto';
import { resolveTelegramDispatchConfig } from '@/lib/telegram-dispatch-settings';
import { getUserSettings } from '@/lib/user-settings';

export const dynamic = 'force-dynamic';

const sendSchema = z.object({
  taskKey: z.string().trim().min(1),
  message: z.string().trim().min(1),
  dispatchTarget: z.enum(['telegram', 'hermes-telegram']).optional().default('telegram'),
});

export async function POST(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const payload = sendSchema.parse(await req.json());
    const settings = await getUserSettings(owner.id);

    const target = payload.dispatchTarget === 'hermes-telegram' ? 'hermes' : 'openclaw';
    const { enabled, encryptedToken, chatId } = resolveTelegramDispatchConfig(settings, target);
    if (!enabled || !encryptedToken || !chatId) {
      return NextResponse.json(
        { error: 'Telegram is not fully configured or disabled' },
        { status: 400 },
      );
    }

    let botToken = '';
    try {
      botToken = await decryptTelegramToken(encryptedToken);
    } catch (error) {
      console.error('[api/telegram/send] failed to decrypt Telegram bot token:', error);
      return NextResponse.json(
        { error: 'Telegram bot token is invalid. Save Telegram settings again.' },
        { status: 500 },
      );
    }

    const result = await sendTelegramMessage(botToken, chatId, payload.message, {
      normalizeCommand: payload.dispatchTarget !== 'hermes-telegram',
    });
    if (!result.ok) {
      console.error('[api/telegram/send] Telegram send failed:', {
        taskKey: payload.taskKey,
        description: result.description ?? 'Unknown Telegram error',
      });
      return NextResponse.json(
        { error: result.description || 'Failed to send Telegram message' },
        { status: 502 },
      );
    }

    const queuedTask = await queueTaskExecutionByTaskKey({
      ownerId: owner.id,
      taskKey: payload.taskKey,
      dispatchTarget: payload.dispatchTarget,
    });

    await writeOutboxEventStandalone({
      ownerId: owner.id,
      projectId: queuedTask?.projectId ?? null,
      eventType: TASK_UPDATED,
      entityType: ENTITY_TASK,
      entityId: payload.taskKey,
      payload: {
        changedFields: ['runState', 'runStateUpdatedAt', 'dispatchTarget'],
      },
    });

    await writeAuditLog({
      ownerId: owner.id,
      action: 'telegram.message_sent',
      targetType: 'task',
      targetId: payload.taskKey,
      meta: { chatId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    console.error('[api/telegram/send] POST failed:', error);
    return NextResponse.json({ error: 'Failed to send Telegram message' }, { status: 500 });
  }
}
