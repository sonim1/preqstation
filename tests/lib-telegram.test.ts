import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sendTelegramMessage, TELEGRAM_REQUEST_TIMEOUT_MS } from '@/lib/telegram';

describe('lib/telegram', () => {
  const timeoutMessage = 'Telegram request timed out. Please try again shortly.';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns a timeout error when Telegram does not respond', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        const signal = init?.signal as AbortSignal | undefined;
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(
              signal.reason instanceof Error
                ? signal.reason
                : new Error('Telegram request timed out'),
            );
          });
        });
      }),
    );

    let result: Awaited<ReturnType<typeof sendTelegramMessage>> | undefined;
    const promise = sendTelegramMessage('123:bot-token', '1234567', 'hello').then((value) => {
      result = value;
      return value;
    });

    await vi.advanceTimersByTimeAsync(TELEGRAM_REQUEST_TIMEOUT_MS + 1);

    expect(result).toEqual({ ok: false, description: timeoutMessage });
    await expect(promise).resolves.toEqual({
      ok: false,
      description: timeoutMessage,
    });
  });
});
