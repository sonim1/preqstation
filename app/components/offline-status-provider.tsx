'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type OfflineStatusContextValue = {
  checkedAt: string | null;
  online: boolean;
};

const OfflineStatusContext = createContext<OfflineStatusContextValue>({
  checkedAt: null,
  online: true,
});

const OFFLINE_PING_TIMEOUT_MS = 2_500;

function getInitialOnlineStatus() {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

export async function resolveOfflineStatus(fetcher: typeof fetch = fetch) {
  if (typeof navigator === 'undefined' || !navigator.onLine) {
    return false;
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('Offline ping timed out.'));
      }, OFFLINE_PING_TIMEOUT_MS);
    });
    const response = await Promise.race([
      fetcher('/api/ping', {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      }),
      timeout,
    ]);
    const payload = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    return response.ok && payload?.ok === true;
  } catch {
    return false;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function OfflineStatusProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(() => getInitialOnlineStatus());
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const updateStatus = async () => {
      const nextOnline = await resolveOfflineStatus();
      if (!active) {
        return;
      }

      setOnline(nextOnline);
      setCheckedAt(new Date().toISOString());
    };

    const handleOnline = () => {
      void updateStatus();
    };

    const handleOffline = () => {
      setOnline(false);
      setCheckedAt(new Date().toISOString());
    };

    void updateStatus();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      active = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const value = useMemo(
    () => ({
      checkedAt,
      online,
    }),
    [checkedAt, online],
  );

  return <OfflineStatusContext.Provider value={value}>{children}</OfflineStatusContext.Provider>;
}

export function useOfflineStatus() {
  return useContext(OfflineStatusContext);
}
