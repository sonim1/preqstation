// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const usePathnameMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

import { OfflineWorkspaceRouteWarmer } from '@/app/components/offline-board-route-warmer';

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

  it('warms the current dashboard document into the current navigation cache while online', async () => {
    usePathnameMock.mockReturnValue('/dashboard');
    window.history.replaceState({}, '', '/dashboard');
    const cachePutMock = vi.fn().mockResolvedValue(undefined);
    const openMock = vi.fn().mockResolvedValue({ put: cachePutMock });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('<html>cached dashboard</html>', { status: 200 }));

    vi.stubGlobal('caches', { open: openMock });
    vi.stubGlobal('fetch', fetchMock);

    render(<OfflineWorkspaceRouteWarmer />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/dashboard', {
        credentials: 'same-origin',
        headers: { accept: 'text/html' },
        cache: 'no-store',
      });
    });
    expect(openMock).toHaveBeenCalledWith('preq-board-v3');
    expect(cachePutMock).toHaveBeenCalledWith(
      `${window.location.origin}/dashboard`,
      expect.any(Response),
    );
  });

  it('uses the captured route pathname for the fetch and cache key', async () => {
    usePathnameMock.mockReturnValue('/dashboard');
    window.history.replaceState({}, '', '/board');
    const cachePutMock = vi.fn().mockResolvedValue(undefined);
    const openMock = vi.fn().mockResolvedValue({ put: cachePutMock });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('<html>cached dashboard</html>', { status: 200 }));

    vi.stubGlobal('caches', { open: openMock });
    vi.stubGlobal('fetch', fetchMock);

    render(<OfflineWorkspaceRouteWarmer />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/dashboard', {
        credentials: 'same-origin',
        headers: { accept: 'text/html' },
        cache: 'no-store',
      });
    });
    expect(cachePutMock).toHaveBeenCalledWith(
      `${window.location.origin}/dashboard`,
      expect.any(Response),
    );
  });

  it.each(['/projects', '/board', '/board/PQST'])(
    'warms %s as a workspace document route',
    async (pathname) => {
      usePathnameMock.mockReturnValue(pathname);
      window.history.replaceState({}, '', pathname);
      const cachePutMock = vi.fn().mockResolvedValue(undefined);
      const openMock = vi.fn().mockResolvedValue({ put: cachePutMock });
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('<html>cached workspace route</html>', { status: 200 }));

      vi.stubGlobal('caches', { open: openMock });
      vi.stubGlobal('fetch', fetchMock);

      render(<OfflineWorkspaceRouteWarmer />);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(pathname, {
          credentials: 'same-origin',
          headers: { accept: 'text/html' },
          cache: 'no-store',
        });
      });
      expect(openMock).toHaveBeenCalledWith('preq-board-v3');
      expect(cachePutMock).toHaveBeenCalledWith(
        `${window.location.origin}${pathname}`,
        expect.any(Response),
      );
    },
  );

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

    const view = render(<OfflineWorkspaceRouteWarmer />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    pathname = '/board';
    window.history.replaceState({}, '', '/board');
    view.rerender(<OfflineWorkspaceRouteWarmer />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    pathname = '/board/PQST';
    window.history.replaceState({}, '', '/board/PQST');
    view.rerender(<OfflineWorkspaceRouteWarmer />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
