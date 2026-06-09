'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

const BOARD_CACHE = 'preq-board-v3';
const WARM_FALLBACK_PATHS = ['/dashboard', '/projects', '/settings', '/connections'] as const;

function isWorkspaceRoutePath(pathname: string | null) {
  return (
    pathname === '/dashboard' ||
    pathname === '/projects' ||
    pathname === '/settings' ||
    pathname === '/connections' ||
    pathname === '/board' ||
    pathname?.startsWith('/board/') === true
  );
}

function requestWarmIdleCallback(callback: () => void) {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback);
    return () => window.cancelIdleCallback?.(id);
  }

  const id = window.setTimeout(callback, 0);
  return () => window.clearTimeout(id);
}

export function resolveWorkspaceWarmPathnames(pathname: string | null) {
  if (!isWorkspaceRoutePath(pathname)) {
    return [];
  }

  const warmPathnames = new Set<string>();
  if (pathname) {
    warmPathnames.add(pathname);
  }
  for (const fallbackPath of WARM_FALLBACK_PATHS) {
    warmPathnames.add(fallbackPath);
  }

  return [...warmPathnames];
}

async function cacheWorkspaceDocument(pathname: string) {
  const response = await fetch(pathname, {
    credentials: 'same-origin',
    headers: { accept: 'text/html' },
    cache: 'no-store',
  });

  if (!response.ok || response.redirected) {
    return false;
  }

  const cache = await caches.open(BOARD_CACHE);
  await cache.put(`${window.location.origin}${pathname}`, response.clone());
  return true;
}

export function OfflineWorkspaceRouteWarmer() {
  const pathname = usePathname();
  const router = useRouter();
  const warmedPathnamesRef = useRef(new Set<string>());

  useEffect(() => {
    const routePathnames = resolveWorkspaceWarmPathnames(pathname);
    if (
      routePathnames.length === 0 ||
      !navigator.onLine ||
      typeof window === 'undefined' ||
      typeof caches === 'undefined'
    ) {
      return;
    }

    const warmedPathnames = warmedPathnamesRef.current;
    const pendingPathnames = routePathnames.filter(
      (routePathname) => !warmedPathnames.has(routePathname),
    );
    if (pendingPathnames.length === 0) {
      return;
    }

    for (const routePathname of pendingPathnames) {
      warmedPathnames.add(routePathname);
    }

    let didStartWarming = false;
    const cancelWarm = requestWarmIdleCallback(() => {
      didStartWarming = true;
      void Promise.all(
        pendingPathnames.map(async (routePathname) => {
          try {
            if (routePathname !== pathname) {
              router.prefetch(routePathname);
            }

            const cached = await cacheWorkspaceDocument(routePathname);
            if (!cached) {
              warmedPathnames.delete(routePathname);
            }
          } catch {
            warmedPathnames.delete(routePathname);
          }
        }),
      );
    });

    return () => {
      cancelWarm();
      if (!didStartWarming) {
        for (const routePathname of pendingPathnames) {
          warmedPathnames.delete(routePathname);
        }
      }
    };
  }, [pathname, router]);

  return null;
}
