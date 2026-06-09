// @vitest-environment jsdom

import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const usePathnameMock = vi.hoisted(() => vi.fn());
const routerPrefetchMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ prefetch: routerPrefetchMock }),
}));

import {
  OfflineWorkspaceRouteWarmer,
  resolveWorkspaceWarmPathnames,
} from '@/app/components/offline-board-route-warmer';

describe('app/components/offline-board-route-warmer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    usePathnameMock.mockReset();
    routerPrefetchMock.mockReset();
    window.history.replaceState({}, '', '/board/PQST');
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) =>
      window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0),
    );
  });

  it('builds a small workspace route warm set from the current board route', () => {
    expect(resolveWorkspaceWarmPathnames('/board/PQST')).toEqual([
      '/board/PQST',
      '/dashboard',
      '/projects',
      '/settings',
      '/connections',
    ]);
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

  it('warms related workspace routes and prefetches them after idle time', async () => {
    usePathnameMock.mockReturnValue('/board/PQST');
    window.history.replaceState({}, '', '/board/PQST');
    const cachePutMock = vi.fn().mockResolvedValue(undefined);
    const openMock = vi.fn().mockResolvedValue({ put: cachePutMock });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('<html>cached workspace route</html>', { status: 200 }));

    vi.stubGlobal('caches', { open: openMock });
    vi.stubGlobal('fetch', fetchMock);

    render(<OfflineWorkspaceRouteWarmer />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/board/PQST', expect.any(Object));
      expect(fetchMock).toHaveBeenCalledWith('/dashboard', expect.any(Object));
      expect(fetchMock).toHaveBeenCalledWith('/projects', expect.any(Object));
      expect(fetchMock).toHaveBeenCalledWith('/settings', expect.any(Object));
      expect(fetchMock).toHaveBeenCalledWith('/connections', expect.any(Object));
    });
    expect(routerPrefetchMock).toHaveBeenCalledWith('/dashboard');
    expect(routerPrefetchMock).toHaveBeenCalledWith('/projects');
    expect(routerPrefetchMock).toHaveBeenCalledWith('/settings');
    expect(routerPrefetchMock).toHaveBeenCalledWith('/connections');
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

    const view = render(<OfflineWorkspaceRouteWarmer />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    pathname = '/board';
    window.history.replaceState({}, '', '/board');
    view.rerender(<OfflineWorkspaceRouteWarmer />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(6);
    });

    pathname = '/board/PQST';
    window.history.replaceState({}, '', '/board/PQST');
    view.rerender(<OfflineWorkspaceRouteWarmer />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(6);
    });
  });

  it('does not mark routes as warmed when navigation cancels the pending idle callback', async () => {
    let pathname = '/board/PQST';
    let nextIdleCallbackId = 1;
    const idleCallbacks = new Map<number, IdleRequestCallback>();
    usePathnameMock.mockImplementation(() => pathname);
    const cachePutMock = vi.fn().mockResolvedValue(undefined);
    const openMock = vi.fn().mockResolvedValue({ put: cachePutMock });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('<html>cached workspace route</html>', { status: 200 }));

    vi.stubGlobal('caches', { open: openMock });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
      const id = nextIdleCallbackId++;
      idleCallbacks.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelIdleCallback', (id: number) => {
      idleCallbacks.delete(id);
    });

    const view = render(<OfflineWorkspaceRouteWarmer />);

    expect(idleCallbacks.has(1)).toBe(true);
    pathname = '/board';
    window.history.replaceState({}, '', '/board');
    view.rerender(<OfflineWorkspaceRouteWarmer />);
    expect(idleCallbacks.has(1)).toBe(false);

    const secondIdleCallback = idleCallbacks.get(2);
    expect(secondIdleCallback).toBeDefined();
    await act(async () => {
      secondIdleCallback?.({ didTimeout: false, timeRemaining: () => 50 });
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/dashboard', expect.any(Object));
      expect(fetchMock).toHaveBeenCalledWith('/projects', expect.any(Object));
      expect(fetchMock).toHaveBeenCalledWith('/settings', expect.any(Object));
      expect(fetchMock).toHaveBeenCalledWith('/connections', expect.any(Object));
    });
  });
});
