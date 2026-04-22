import { NextResponse } from 'next/server';

import { auth, isOwnerEmail } from '@/lib/auth';
import { normalizeTelegramCommandMessage } from '@/lib/openclaw-command';

function quoteMessageValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ').trim()}"`;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isOwnerEmail(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const branchName = typeof body.branch_name === 'string' ? body.branch_name.trim() : '';
    if (!message) {
      return NextResponse.json({ error: 'Missing or empty message field' }, { status: 400 });
    }
    const metadata = [];
    if (branchName) metadata.push(`branch_name=${quoteMessageValue(branchName)}`);
    const finalMessage = normalizeTelegramCommandMessage(
      metadata.length > 0 ? `${message} ${metadata.join(' ')}` : message,
    );

    const token = process.env.TG_BOT_TOKEN;
    const chatId = process.env.TG_CHANNEL_ID;
    if (!token || !chatId) {
      return NextResponse.json({ error: 'Telegram not configured' }, { status: 500 });
    }

    const tgResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: finalMessage }),
    });

    const data = (await tgResponse.json()) as {
      ok: boolean;
      description?: string;
      result?: { message_id: number };
    };

    if (!data.ok) {
      return NextResponse.json(
        { error: data.description ?? 'Telegram API error' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message_id: data.result?.message_id,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
