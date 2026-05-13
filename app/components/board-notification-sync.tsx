'use client';

import { useEffect, useRef } from 'react';

import { useKanbanColumns, useSetTaskUnreadNotification } from './kanban-store-provider';
import { useTaskNotificationStore } from './task-notification-store';

export function BoardNotificationSync() {
  const columns = useKanbanColumns();
  const unreadTaskNotificationCounts = useTaskNotificationStore(
    (state) => state.unreadTaskNotificationCounts,
  );
  const setTaskUnreadNotification = useSetTaskUnreadNotification();
  const syncedTaskKeysRef = useRef(new Set<string>());

  useEffect(() => {
    const nextUnreadTaskKeys = new Set(
      Object.entries(unreadTaskNotificationCounts)
        .filter(([, count]) => count > 0)
        .map(([taskKey]) => taskKey),
    );

    for (const taskKey of nextUnreadTaskKeys) {
      setTaskUnreadNotification(taskKey, true);
    }

    for (const taskKey of syncedTaskKeysRef.current) {
      if (!nextUnreadTaskKeys.has(taskKey)) {
        setTaskUnreadNotification(taskKey, false);
      }
    }

    syncedTaskKeysRef.current = nextUnreadTaskKeys;
  }, [columns, setTaskUnreadNotification, unreadTaskNotificationCounts]);

  return null;
}
