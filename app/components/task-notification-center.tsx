'use client';

import { ActionIcon, Indicator } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import {
  extractCreatedNotificationsFromPolledEvents,
  type PolledNotification,
  subscribePolledTaskEvents,
} from '@/lib/event-poll-subscriptions';
import { showErrorNotification, showTaskCompletionNotification } from '@/lib/notifications';

import type { TaskNotificationDrawerMode, TaskNotificationItem } from './task-notification-drawer';

const TaskNotificationDrawer = dynamic(
  () => import('./task-notification-drawer').then((mod) => mod.TaskNotificationDrawer),
  { ssr: false },
);

const HISTORY_PAGE_SIZE = 20;

type NotificationPage = {
  notifications: TaskNotificationItem[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

function prependUniqueById(
  incoming: TaskNotificationItem[],
  existing: TaskNotificationItem[],
): TaskNotificationItem[] {
  const seen = new Set<string>();
  const merged: TaskNotificationItem[] = [];

  for (const notification of [...incoming, ...existing]) {
    if (seen.has(notification.id)) continue;
    seen.add(notification.id);
    merged.push(notification);
  }

  return merged;
}

function appendUniqueById(
  existing: TaskNotificationItem[],
  incoming: TaskNotificationItem[],
): TaskNotificationItem[] {
  const seen = new Set<string>();
  const merged: TaskNotificationItem[] = [];

  for (const notification of [...existing, ...incoming]) {
    if (seen.has(notification.id)) continue;
    seen.add(notification.id);
    merged.push(notification);
  }

  return merged;
}

async function fetchNotificationPage(params: {
  history?: boolean;
  offset?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.history) searchParams.set('history', '1');
  searchParams.set('offset', String(params.offset ?? 0));
  searchParams.set('limit', String(params.limit ?? HISTORY_PAGE_SIZE));

  const response = await fetch(`/api/notifications?${searchParams.toString()}`, {
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch notifications: ${response.status}`);
  }

  return (await response.json()) as NotificationPage;
}

async function markNotificationsRead(notificationIds: string[]) {
  if (notificationIds.length === 0) {
    return;
  }

  const response = await fetch('/api/notifications', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ notificationIds }),
  });

  if (!response.ok) {
    throw new Error(`Failed to mark notifications as read: ${response.status}`);
  }
}

function toTaskNotificationItem(notification: PolledNotification): TaskNotificationItem {
  return {
    id: notification.id,
    projectId: notification.projectId,
    taskId: notification.taskId,
    taskKey: notification.taskKey,
    taskTitle: notification.taskTitle,
    statusFrom: notification.statusFrom,
    statusTo: notification.statusTo,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}

export function TaskNotificationCenter() {
  const [opened, setOpened] = useState(false);
  const [mode, setMode] = useState<TaskNotificationDrawerMode>('unread');
  const [unreadNotifications, setUnreadNotifications] = useState<TaskNotificationItem[]>([]);
  const [sessionReadNotifications, setSessionReadNotifications] = useState<TaskNotificationItem[]>(
    [],
  );
  const [historyNotifications, setHistoryNotifications] = useState<TaskNotificationItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyNextOffset, setHistoryNextOffset] = useState(0);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [isUnreadLoading, setIsUnreadLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isHistoryLoadingMore, setIsHistoryLoadingMore] = useState(false);
  const knownNotificationIdsRef = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;

    async function loadUnreadNotifications() {
      setIsUnreadLoading(true);
      try {
        const page = await fetchNotificationPage({
          limit: HISTORY_PAGE_SIZE,
        });
        if (cancelled) {
          return;
        }

        for (const notification of page.notifications) {
          knownNotificationIdsRef.current.add(notification.id);
        }
        setUnreadNotifications(page.notifications);
      } catch {
        if (!cancelled) {
          showErrorNotification('Failed to load notifications.');
        }
      } finally {
        if (!cancelled) {
          setIsUnreadLoading(false);
        }
      }
    }

    void loadUnreadNotifications();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribePolledTaskEvents(async (events) => {
      const createdNotifications = extractCreatedNotificationsFromPolledEvents(events)
        .filter((notification) => !knownNotificationIdsRef.current.has(notification.id))
        .map(toTaskNotificationItem);

      if (createdNotifications.length === 0) {
        return false;
      }

      for (const notification of createdNotifications) {
        knownNotificationIdsRef.current.add(notification.id);
        showTaskCompletionNotification(notification);
      }

      setUnreadNotifications((current) => prependUniqueById(createdNotifications, current));
      return true;
    });
  }, []);

  async function loadHistory(offset: number, append: boolean) {
    if (append) {
      setIsHistoryLoadingMore(true);
    } else {
      setIsHistoryLoading(true);
    }

    try {
      const page = await fetchNotificationPage({
        history: true,
        offset,
        limit: HISTORY_PAGE_SIZE,
      });

      for (const notification of page.notifications) {
        knownNotificationIdsRef.current.add(notification.id);
      }

      setHistoryNotifications((current) =>
        append ? appendUniqueById(current, page.notifications) : page.notifications,
      );
      setHistoryTotal(page.total);
      setHistoryHasMore(page.hasMore);
      setHistoryNextOffset(page.offset + page.notifications.length);
      setHasLoadedHistory(true);
    } catch {
      showErrorNotification('Failed to load notification history.');
    } finally {
      setIsHistoryLoading(false);
      setIsHistoryLoadingMore(false);
    }
  }

  function openDrawer() {
    setOpened(true);
    setMode('unread');

    if (unreadNotifications.length === 0) {
      return;
    }

    const notificationsToMark = unreadNotifications;
    setSessionReadNotifications((current) => prependUniqueById(notificationsToMark, current));
    setUnreadNotifications([]);

    void markNotificationsRead(notificationsToMark.map((notification) => notification.id)).catch(
      () => {
        showErrorNotification('Failed to mark notifications as read.');
      },
    );
  }

  function closeDrawer() {
    setOpened(false);
    setMode('unread');
    setSessionReadNotifications([]);
  }

  function showHistory() {
    setMode('history');
    if (!hasLoadedHistory) {
      void loadHistory(0, false);
    }
  }

  function showUnread() {
    setMode('unread');
  }

  function loadMoreHistory() {
    if (!historyHasMore || isHistoryLoadingMore) {
      return;
    }

    void loadHistory(historyNextOffset, true);
  }

  const visibleUnreadNotifications = prependUniqueById(
    unreadNotifications,
    sessionReadNotifications,
  );
  const unreadCount = unreadNotifications.length;
  const drawerNotifications =
    mode === 'history' ? historyNotifications : visibleUnreadNotifications;
  const drawerTotal = mode === 'history' ? historyTotal : visibleUnreadNotifications.length;
  const drawerLoading = mode === 'history' ? isHistoryLoading : isUnreadLoading;
  const drawerHasMore = mode === 'history' ? historyHasMore : false;
  const drawerLoadingMore = mode === 'history' ? isHistoryLoadingMore : false;

  return (
    <>
      <Indicator
        inline
        size={18}
        offset={6}
        label={unreadCount > 0 ? unreadCount : undefined}
        disabled={unreadCount === 0}
        className="workspace-notification-indicator"
      >
        <ActionIcon
          size={44}
          radius="xl"
          variant="default"
          className="workspace-notification-trigger"
          aria-label={
            unreadCount > 0 ? `Open notifications (${unreadCount} unread)` : 'Open notifications'
          }
          onClick={openDrawer}
        >
          <IconBell size={18} />
        </ActionIcon>
      </Indicator>

      {opened ? (
        <TaskNotificationDrawer
          opened={opened}
          onClose={closeDrawer}
          mode={mode}
          notifications={drawerNotifications}
          total={drawerTotal}
          isLoading={drawerLoading}
          isLoadingMore={drawerLoadingMore}
          hasMore={drawerHasMore}
          onShowHistory={showHistory}
          onShowUnread={showUnread}
          onLoadMore={loadMoreHistory}
        />
      ) : null}
    </>
  );
}
