'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const BOARD_CACHE = 'preq-board-v3';

function isWorkspaceRoutePath(pathname: string | null) {
  return (
    pathname === '/dashboard' ||
    pathname === '/projects' ||
    pathname === '/board' ||
    pathname?.startsWith('/board/') === true
  );
}

export function OfflineWorkspaceRouteWarmer() {
  const pathname = usePathname();
  const warmedPathnamesRef = useRef(new Set<string>());

  useEffect(() => {
    if (
      !pathname ||
      !isWorkspaceRoutePath(pathname) ||
      !navigator.onLine ||
      warmedPathnamesRef.current.has(pathname) ||
      typeof window === 'undefined' ||
      typeof caches === 'undefined'
    ) {
      return;
    }

    const routePathname = pathname;
    warmedPathnamesRef.current.add(routePathname);

    void (async () => {
      try {
        const response = await fetch(routePathname, {
          credentials: 'same-origin',
          headers: { accept: 'text/html' },
          cache: 'no-store',
        });

        if (!response.ok || response.redirected) {
          warmedPathnamesRef.current.delete(routePathname);
          return;
        }

        const cache = await caches.open(BOARD_CACHE);
        await cache.put(`${window.location.origin}${routePathname}`, response.clone());
      } catch {
        warmedPathnamesRef.current.delete(routePathname);
      }
    })();
  }, [pathname]);

  return null;
}
