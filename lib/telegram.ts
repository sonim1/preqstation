import { normalizeTelegramCommandMessage } from '@/lib/openclaw-command';

type TelegramApiResponse = {
  ok?: boolean;
  description?: string;
};

export type TelegramSendResult = {
  ok: boolean;
  description?: string;
};

type TelegramSendOptions = {
  normalizeCommand?: boolean;
};

export const TELEGRAM_REQUEST_TIMEOUT_MS = 30_000;
const TELEGRAM_TIMEOUT_DESCRIPTION = 'Telegram request timed out. Please try again shortly.';

function parseTelegramError(response: Response, payload: TelegramApiResponse | null) {
  if (payload?.description) return payload.description;
  if (!response.ok) return `Telegram request failed (${response.status})`;
  return 'Telegram request failed';
}

function createTelegramTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutError = new Error(TELEGRAM_TIMEOUT_DESCRIPTION);
  timeoutError.name = 'TimeoutError';
  const timeoutId = setTimeout(() => controller.abort(timeoutError), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  options: TelegramSendOptions = {},
): Promise<TelegramSendResult> {
  const timeout = createTelegramTimeoutSignal(TELEGRAM_REQUEST_TIMEOUT_MS);

  try {
    const normalizedText =
      options.normalizeCommand === false ? text.trim() : normalizeTelegramCommandMessage(text);
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      signal: timeout.signal,
      body: JSON.stringify({
        chat_id: chatId,
        text: normalizedText,
      }),
    });

    let payload: TelegramApiResponse | null = null;
    try {
      payload = (await response.json()) as TelegramApiResponse;
    } catch {
      payload = null;
    }

    if (!response.ok || !payload?.ok) {
      return { ok: false, description: parseTelegramError(response, payload) };
    }

    return { ok: true, description: payload.description };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { ok: false, description: TELEGRAM_TIMEOUT_DESCRIPTION };
    }

    return {
      ok: false,
      description: error instanceof Error ? error.message : 'Telegram request failed',
    };
  } finally {
    timeout.clear();
  }
}
