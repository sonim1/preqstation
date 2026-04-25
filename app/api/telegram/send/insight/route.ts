import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';
import { sendTelegramMessage } from '@/lib/telegram';
import { decryptTelegramToken } from '@/lib/telegram-crypto';
import { resolveTelegramDispatchConfig } from '@/lib/telegram-dispatch-settings';
import { getUserSettings } from '@/lib/user-settings';

export const dynamic = 'force-dynamic';

const sendSchema = z.object({
  projectKey: z.string().trim().min(1).max(20),
  message: z.string().trim().min(1),
});

export async function POST(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const payload = sendSchema.parse(await req.json());
    const settings = await getUserSettings(owner.id);

    const { enabled, encryptedToken, chatId } = resolveTelegramDispatchConfig(settings, 'openclaw');
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
      console.error('[api/telegram/send/insight] failed to decrypt Telegram bot token:', error);
      return NextResponse.json(
        { error: 'Telegram bot token is invalid. Save Telegram settings again.' },
        { status: 500 },
      );
    }

    const result = await sendTelegramMessage(botToken, chatId, payload.message);
    if (!result.ok) {
      console.error('[api/telegram/send/insight] Telegram send failed:', {
        projectKey: payload.projectKey,
        description: result.description ?? 'Unknown Telegram error',
      });
      return NextResponse.json(
        { error: result.description || 'Failed to send Telegram message' },
        { status: 502 },
      );
    }

    await writeAuditLog({
      ownerId: owner.id,
      action: 'telegram.insight_sent',
      targetType: 'project',
      targetId: payload.projectKey,
      meta: { chatId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    console.error('[api/telegram/send/insight] POST failed:', error);
    return NextResponse.json({ error: 'Failed to send Telegram message' }, { status: 500 });
  }
}
