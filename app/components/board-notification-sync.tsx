'use client';

import { useEffect, useMemo, useRef } from 'react';

import { useKanbanStore, useSetTaskUnreadNotification } from './kanban-store-provider';
import { useTaskNotificationStore } from './task-notification-store';

export function BoardNotificationSync() {
  const taskKeysCount = useKanbanStore((state) => Object.keys(state.taskKeysById).length);
  const unreadTaskNotificationCounts = useTaskNotificationStore(
    (state) => state.unreadTaskNotificationCounts,
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

    for (const taskKey of syncedTaskKeysRef.current) {
      if (!nextUnreadTaskKeys.has(taskKey)) {
        setTaskUnreadNotification(taskKey, false);
      }
    }

    syncedTaskKeysRef.current = nextUnreadTaskKeys;
  }, [taskKeysCount, setTaskUnreadNotification, nextUnreadTaskKeys]);

  return null;
}
