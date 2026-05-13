'use client';

import { useEffect, useMemo, useRef } from 'react';

import { useKanbanStore, useSetTaskUnreadNotification } from './kanban-store-provider';
import { useTaskNotificationStore } from './task-notification-store';

export function BoardNotificationSync() {
  const taskKeysCount = useKanbanStore((state) => Object.keys(state.taskKeysById).length);
  const unreadTaskNotificationCounts = useTaskNotificationStore(
    (state) => state.unreadTaskNotificationCounts,
  );
  const canClearUnreadTaskFlags = useTaskNotificationStore(
    (state) => state.unreadNotifications.length >= state.unreadTotal,
  );
  const setTaskUnreadNotification = useSetTaskUnreadNotification();
  const syncedTaskKeysRef = useRef(new Set<string>());

  const nextUnreadTaskKeys = useMemo(
    () =>
      new Set(
        Object.entries(unreadTaskNotificationCounts)
          .filter(([, count]) => count > 0)
          .map(([taskKey]) => taskKey),
      ),
    [unreadTaskNotificationCounts],
  );

  useEffect(() => {
    for (const taskKey of nextUnreadTaskKeys) {
      setTaskUnreadNotification(taskKey, true);
    }

    if (canClearUnreadTaskFlags) {
      for (const taskKey of syncedTaskKeysRef.current) {
        if (!nextUnreadTaskKeys.has(taskKey)) {
          setTaskUnreadNotification(taskKey, false);
        }
      }

      syncedTaskKeysRef.current = nextUnreadTaskKeys;
      return;
    }

    syncedTaskKeysRef.current = new Set([...syncedTaskKeysRef.current, ...nextUnreadTaskKeys]);
  }, [taskKeysCount, canClearUnreadTaskFlags, setTaskUnreadNotification, nextUnreadTaskKeys]);

  return null;
}
