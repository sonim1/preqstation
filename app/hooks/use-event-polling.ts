'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { publishPolledTaskEvents } from '@/lib/event-poll-subscriptions';
import {
  consumePendingTaskEditRefresh,
  getTaskEditRefreshState,
  markPendingTaskEditRefresh,
  subscribeTaskEditRefresh,
} from '@/lib/task-edit-refresh-guard';

const DEFAULT_INTERVAL = 60_000;
const SLOW_INTERVAL = 30_000;
const MAX_INTERVAL = 300_000;
const CURSOR_KEY = 'event-poll-cursor';

interface UseEventPollingOptions {
  projectId?: string;
  enabled?: boolean;
  intervalMs?: number;
}

export function useEventPolling(options?: UseEventPollingOptions) {
  const { projectId, enabled = true, intervalMs } = options ?? {};
  const baseInterval = intervalMs ?? DEFAULT_INTERVAL;
  const router = useRouter();
  const cursorRef = useRef<string>('0');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIntervalMs = useRef(baseInterval);
  const [isPolling, setIsPolling] = useState(false);

  // Keep base interval in sync with prop changes
  useEffect(() => {
    currentIntervalMs.current = baseInterval;
  }, [baseInterval]);

  // Initialize cursor from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(CURSOR_KEY);
      if (stored) cursorRef.current = stored;
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  const poll = useCallback(async () => {
    if (!enabled) return;
    setIsPolling(true);
    try {
      const params = new URLSearchParams({
        after: cursorRef.current,
        limit: '50',
      });
      if (projectId) params.set('projectId', projectId);

      const res = await fetch(`/api/events?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as {
        events: Array<{
          id: string;
          eventType?: string;
          entityType?: string;
          entityId?: string;
          payload?: unknown;
          createdAt?: string;
        }>;
        nextCursor: string | null;
      };

      if (data.events.length > 0 && data.nextCursor) {
        cursorRef.current = data.nextCursor;
        try {
          sessionStorage.setItem(CURSOR_KEY, data.nextCursor);
        } catch {
          // sessionStorage unavailable
        }

        const handled = await publishPolledTaskEvents(data.events);
        if (!handled) {
          if (getTaskEditRefreshState().blocked) {
            markPendingTaskEditRefresh();
          } else {
            router.refresh();
          }
        }
      }

      // Success - reset interval to base
      currentIntervalMs.current = baseInterval;
    } catch {
      // Error backoff: double interval up to max
      currentIntervalMs.current = Math.min(currentIntervalMs.current * 2, MAX_INTERVAL);
    } finally {
      setIsPolling(false);
    }
  }, [enabled, projectId, router, baseInterval]);

  const startInterval = useCallback(
    (ms: number) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        poll();
      }, ms);
    },
    [poll],
  );

  useEffect(() => {
    return subscribeTaskEditRefresh(() => {
      const refreshState = getTaskEditRefreshState();
      if (refreshState.blocked) {
        return;
      }

      if (!consumePendingTaskEditRefresh()) {
        return;
      }

      router.refresh();
    });
  }, [router]);

  // Main polling effect
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Initial poll
    poll();
    startInterval(currentIntervalMs.current);

    // Visibility change handler
    const onVisibilityChange = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);

      if (document.hidden) {
        startInterval(SLOW_INTERVAL);
      } else {
        // Immediately poll, then restore normal interval
        poll();
        startInterval(currentIntervalMs.current);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, poll, startInterval]);

  return { isPolling };
}
