// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const usePathnameMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

import { OfflineBoardRouteWarmer } from '@/app/components/offline-board-route-warmer';

describe('app/components/offline-board-route-warmer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    usePathnameMock.mockReset();
    window.history.replaceState({}, '', '/board/PQST');
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('warms the current board route document into the board cache while online', async () => {
    usePathnameMock.mockReturnValue('/board/PQST');
    const cachePutMock = vi.fn().mockResolvedValue(undefined);
    const openMock = vi.fn().mockResolvedValue({ put: cachePutMock });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('<html>cached board</html>', { status: 200 }));

    vi.stubGlobal('caches', { open: openMock });
    vi.stubGlobal('fetch', fetchMock);

    render(<OfflineBoardRouteWarmer />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/board/PQST', {
        credentials: 'same-origin',
        headers: { accept: 'text/html' },
        cache: 'no-store',
      });
    });
    expect(openMock).toHaveBeenCalledWith('preq-board-v2');
    expect(cachePutMock).toHaveBeenCalledWith(
      `${window.location.origin}/board/PQST`,
      expect.any(Response),
    );
  });

  it('does not re-warm a pathname that was already cached in the current session', async () => {
    let pathname = '/board/PQST';
    usePathnameMock.mockImplementation(() => pathname);
    const cachePutMock = vi.fn().mockResolvedValue(undefined);
    const openMock = vi.fn().mockResolvedValue({ put: cachePutMock });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('<html>cached board</html>', { status: 200 }));

    vi.stubGlobal('caches', { open: openMock });
    vi.stubGlobal('fetch', fetchMock);

    const view = render(<OfflineBoardRouteWarmer />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    pathname = '/board';
    window.history.replaceState({}, '', '/board');
    view.rerender(<OfflineBoardRouteWarmer />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    pathname = '/board/PQST';
    window.history.replaceState({}, '', '/board/PQST');
    view.rerender(<OfflineBoardRouteWarmer />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
