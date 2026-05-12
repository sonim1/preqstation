// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  OfflineStatusProvider,
  resolveOfflineStatus,
  useOfflineStatus,
} from '@/app/components/offline-status-provider';

function StatusProbe() {
  const { online } = useOfflineStatus();

  return <output>{online ? 'online' : 'offline'}</output>;
}

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

  it('returns offline when /api/ping does not answer within 2.5 seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { onLine: true } as Navigator);
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      init?.signal?.addEventListener('abort', () => undefined);
      return new Promise<Response>(() => undefined);
    });

    const statusPromise = resolveOfflineStatus(fetchMock as typeof fetch);
    await vi.advanceTimersByTimeAsync(2_499);

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

  it('uses a stable online value for the first client render before resolving offline status', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    vi.stubGlobal('fetch', vi.fn());

    render(
      <OfflineStatusProvider>
        <StatusProbe />
      </OfflineStatusProvider>,
    );

    expect(screen.getByText('online')).toBeTruthy();
    expect(await screen.findByText('offline')).toBeTruthy();
  });
});
