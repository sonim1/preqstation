'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const BOARD_CACHE = 'preq-board-v3';

function isWorkspaceRoutePath(pathname: string | null) {
  return (
    pathname === '/dashboard' ||
    pathname === '/dashboard/' ||
    pathname === '/projects' ||
    pathname === '/projects/' ||
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

    warmedPathnamesRef.current.add(pathname);

    void (async () => {
      try {
        const response = await fetch(window.location.pathname, {
          credentials: 'same-origin',
          headers: { accept: 'text/html' },
          cache: 'no-store',
        });

        if (!response.ok || response.redirected) {
          warmedPathnamesRef.current.delete(pathname);
          return;
        }

        const cache = await caches.open(BOARD_CACHE);
        await cache.put(`${window.location.origin}${pathname}`, response.clone());
      } catch {
        warmedPathnamesRef.current.delete(pathname);
      }
    })();
  }, [pathname]);

  return null;
}
