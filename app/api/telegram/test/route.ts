import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';
import { sendTelegramMessage } from '@/lib/telegram';
import { decryptTelegramToken } from '@/lib/telegram-crypto';
import { getUserSettings, SETTING_KEYS } from '@/lib/user-settings';

export const dynamic = 'force-dynamic';

const testSchema = z.object({
  botToken: z.string().trim().optional().default(''),
  chatId: z.string().trim().min(1),
  message: z.string().trim().min(1).max(1000).optional(),
});

const DEFAULT_TEST_MESSAGE = 'OpenClaw test message';

export async function POST(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const payload = testSchema.parse(await req.json());
    let botToken = payload.botToken;

    if (!botToken) {
      const settings = await getUserSettings(owner.id);
      const encryptedToken = settings[SETTING_KEYS.TELEGRAM_BOT_TOKEN] || '';

      if (!encryptedToken) {
        return NextResponse.json(
          { error: 'Telegram bot token is not configured. Enter a Bot Token or save one first.' },
          { status: 400 },
        );
      }

      try {
        botToken = await decryptTelegramToken(encryptedToken);
      } catch {
        return NextResponse.json(
          { error: 'Telegram bot token is invalid. Save Telegram settings again.' },
          { status: 500 },
        );
      }
    }

    const result = await sendTelegramMessage(
      botToken,
      payload.chatId,
      payload.message || DEFAULT_TEST_MESSAGE,
    );

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.description || 'Failed to send Telegram test message' },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to send Telegram test message' }, { status: 500 });
  }
}
