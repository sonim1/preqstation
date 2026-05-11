import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveOfflineStatus } from '@/app/components/offline-status-provider';

describe('app/components/offline-status-provider', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks the app offline until navigator.onLine and /api/ping both succeed', async () => {
    vi.stubGlobal('navigator', { onLine: true } as Navigator);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    );

    await expect(resolveOfflineStatus()).resolves.toBe(true);
  });

  it('returns offline when the browser is offline before pinging the backend', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('navigator', { onLine: false } as Navigator);
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveOfflineStatus()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns offline when /api/ping does not answer within 15 seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { onLine: true } as Navigator);
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      init?.signal?.addEventListener('abort', () => undefined);
      return new Promise<Response>(() => undefined);
    });

    const statusPromise = resolveOfflineStatus(fetchMock as typeof fetch);
    await vi.advanceTimersByTimeAsync(14_999);

    await expect(Promise.race([statusPromise, Promise.resolve('pending')])).resolves.toBe(
      'pending',
    );

    await vi.advanceTimersByTimeAsync(1);
    await expect(statusPromise).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ping',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    vi.useRealTimers();
  });
});
