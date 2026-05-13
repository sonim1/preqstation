'use client';

import { create } from 'zustand';

import type { TaskNotificationItem } from './task-notification-drawer';

export type NotificationPage = {
  notifications: TaskNotificationItem[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

type TaskNotificationStoreState = {
  unreadNotifications: TaskNotificationItem[];
  unreadTotal: number;
  knownNotificationIds: Set<string>;
  pendingReadNotificationIds: Set<string>;
  unreadTaskNotificationCounts: Record<string, number>;
  hydrateUnreadPage: (page: NotificationPage) => void;
  addCreatedNotifications: (items: TaskNotificationItem[]) => TaskNotificationItem[];
  beginMarkRead: (notification: TaskNotificationItem) => void;
  finishMarkRead: (notification: TaskNotificationItem) => void;
  rollbackMarkRead: (notification: TaskNotificationItem) => void;
  rememberNotifications: (items: TaskNotificationItem[]) => void;
};

function isUnread(notification: TaskNotificationItem) {
  return notification.readAt === null;
}

function taskKeyForNotification(notification: TaskNotificationItem) {
  return 'taskKey' in notification ? notification.taskKey : null;
}

function countUnreadTaskNotifications(notifications: TaskNotificationItem[]) {
  const counts: Record<string, number> = {};

  for (const notification of notifications) {
    if (!isUnread(notification)) continue;

    const taskKey = taskKeyForNotification(notification);
    if (!taskKey) continue;

    counts[taskKey] = (counts[taskKey] ?? 0) + 1;
  }

  return counts;
}

function mergeUniqueById(
  first: TaskNotificationItem[],
  second: TaskNotificationItem[],
): TaskNotificationItem[] {
  const seen = new Set<string>();
  const merged: TaskNotificationItem[] = [];

  for (const notification of [...first, ...second]) {
    if (seen.has(notification.id)) continue;
    seen.add(notification.id);
    merged.push(notification);
  }

  return merged;
}

function addKnownIds(current: Set<string>, notifications: TaskNotificationItem[]) {
  const next = new Set(current);
  for (const notification of notifications) {
    next.add(notification.id);
  }
  return next;
}

function removePendingId(current: Set<string>, notificationId: string) {
  if (!current.has(notificationId)) return current;

  const next = new Set(current);
  next.delete(notificationId);
  return next;
}

function initialTaskNotificationStoreState(): Pick<
  TaskNotificationStoreState,
  | 'unreadNotifications'
  | 'unreadTotal'
  | 'knownNotificationIds'
  | 'pendingReadNotificationIds'
  | 'unreadTaskNotificationCounts'
> {
  return {
    unreadNotifications: [],
    unreadTotal: 0,
    knownNotificationIds: new Set(),
    pendingReadNotificationIds: new Set(),
    unreadTaskNotificationCounts: {},
  };
}

export const useTaskNotificationStore = create<TaskNotificationStoreState>()((set) => ({
  ...initialTaskNotificationStoreState(),
  hydrateUnreadPage(page) {
    set((state) => {
      const pageNotifications = page.notifications.filter(
        (notification) => !state.pendingReadNotificationIds.has(notification.id),
      );
      const pageNotificationIds = new Set(pageNotifications.map((notification) => notification.id));
      const retainedNotifications = state.unreadNotifications.filter(
        (notification) =>
          isUnread(notification) &&
          !pageNotificationIds.has(notification.id) &&
          !state.pendingReadNotificationIds.has(notification.id),
      );
      const unreadNotifications = mergeUniqueById(retainedNotifications, pageNotifications).filter(
        isUnread,
      );

      return {
        unreadNotifications,
        unreadTotal: Math.max(
          page.total - state.pendingReadNotificationIds.size,
          unreadNotifications.length,
        ),
        knownNotificationIds: addKnownIds(state.knownNotificationIds, unreadNotifications),
        unreadTaskNotificationCounts: countUnreadTaskNotifications(unreadNotifications),
      };
    });
  },
  addCreatedNotifications(items) {
    const unreadItems = items.filter(isUnread);
    if (unreadItems.length === 0) return [];

    let addedNotifications: TaskNotificationItem[] = [];

    set((state) => {
      addedNotifications = unreadItems.filter(
        (notification) => !state.knownNotificationIds.has(notification.id),
      );

      if (addedNotifications.length === 0) {
        return state;
      }

      const unreadNotifications = mergeUniqueById(
        addedNotifications,
        state.unreadNotifications,
      ).filter(isUnread);

      return {
        unreadNotifications,
        unreadTotal: state.unreadTotal + addedNotifications.length,
        knownNotificationIds: addKnownIds(state.knownNotificationIds, addedNotifications),
        unreadTaskNotificationCounts: countUnreadTaskNotifications(unreadNotifications),
      };
    });

    return addedNotifications;
  },
  beginMarkRead(notification) {
    if (!isUnread(notification)) return;

    set((state) => {
      if (state.pendingReadNotificationIds.has(notification.id)) {
        return state;
      }

      const unreadNotifications = state.unreadNotifications.filter(
        (item) => item.id !== notification.id,
      );

      return {
        unreadNotifications,
        unreadTotal: Math.max(0, state.unreadTotal - 1),
        knownNotificationIds: addKnownIds(state.knownNotificationIds, [notification]),
        pendingReadNotificationIds: new Set(state.pendingReadNotificationIds).add(notification.id),
        unreadTaskNotificationCounts: countUnreadTaskNotifications(unreadNotifications),
      };
    });
  },
  finishMarkRead(notification) {
    set((state) => ({
      pendingReadNotificationIds: removePendingId(
        state.pendingReadNotificationIds,
        notification.id,
      ),
    }));
  },
  rollbackMarkRead(notification) {
    if (!isUnread(notification)) return;

    set((state) => {
      const alreadyUnread = state.unreadNotifications.some((item) => item.id === notification.id);
      const unreadNotifications = alreadyUnread
        ? state.unreadNotifications
        : mergeUniqueById([notification], state.unreadNotifications);

      return {
        unreadNotifications,
        unreadTotal: alreadyUnread ? state.unreadTotal : state.unreadTotal + 1,
        knownNotificationIds: addKnownIds(state.knownNotificationIds, [notification]),
        pendingReadNotificationIds: removePendingId(
          state.pendingReadNotificationIds,
          notification.id,
        ),
        unreadTaskNotificationCounts: countUnreadTaskNotifications(unreadNotifications),
      };
    });
  },
  rememberNotifications(items) {
    if (items.length === 0) return;

    set((state) => ({
      knownNotificationIds: addKnownIds(state.knownNotificationIds, items),
    }));
  },
}));
