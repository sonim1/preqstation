import { beforeEach, describe, expect, it } from 'vitest';

import type { TaskNotificationItem } from '@/app/components/task-notification-drawer';
import {
  type NotificationPage,
  useTaskNotificationStore,
} from '@/app/components/task-notification-store';

function makeNotification(
  overrides: Partial<{
    id: string;
    taskKey: string;
    taskTitle: string;
    readAt: string | null;
    createdAt: string;
  }> = {},
): TaskNotificationItem {
  return {
    id: overrides.id ?? 'notif-1',
    type: 'task',
    projectId: 'project-1',
    taskId: 'task-1',
    taskKey: overrides.taskKey ?? 'PROJ-327',
    taskTitle: overrides.taskTitle ?? 'Add browser notifications',
    statusFrom: 'todo',
    statusTo: 'ready',
    readAt: overrides.readAt ?? null,
    createdAt: overrides.createdAt ?? '2026-04-08T05:00:00.000Z',
  };
}

function makePage(
  notifications: TaskNotificationItem[],
  total = notifications.length,
): NotificationPage {
  return {
    notifications,
    total,
    offset: 0,
    limit: 20,
    hasMore: total > notifications.length,
  };
}

describe('app/components/task-notification-store', () => {
  beforeEach(() => {
    useTaskNotificationStore.setState(useTaskNotificationStore.getInitialState(), true);
  });

  it('keeps polled notifications when hydrating an unread API page', () => {
    const polledNotification = makeNotification({
      id: 'notif-live',
      taskKey: 'PROJ-999',
      taskTitle: 'Live notification',
    });

    useTaskNotificationStore.getState().addCreatedNotifications([polledNotification]);
    useTaskNotificationStore.getState().hydrateUnreadPage(makePage([makeNotification()], 1));

    expect(useTaskNotificationStore.getState().unreadTotal).toBe(2);
    expect(useTaskNotificationStore.getState().unreadNotifications.map(({ id }) => id)).toEqual([
      'notif-live',
      'notif-1',
    ]);
  });

  it('ignores duplicate polled notifications when increasing unread total', () => {
    const notification = makeNotification({ id: 'notif-live' });

    useTaskNotificationStore.getState().addCreatedNotifications([notification]);
    useTaskNotificationStore.getState().addCreatedNotifications([notification]);

    expect(useTaskNotificationStore.getState().unreadTotal).toBe(1);
    expect(useTaskNotificationStore.getState().unreadNotifications.map(({ id }) => id)).toEqual([
      'notif-live',
    ]);
  });

  it('restores a failed optimistic read without losing newer polled notifications', () => {
    const firstNotification = makeNotification({ id: 'notif-1', taskKey: 'PROJ-327' });
    const secondNotification = makeNotification({ id: 'notif-2', taskKey: 'PROJ-328' });
    const liveNotification = makeNotification({ id: 'notif-live', taskKey: 'PROJ-999' });

    useTaskNotificationStore
      .getState()
      .hydrateUnreadPage(makePage([firstNotification, secondNotification], 2));
    useTaskNotificationStore.getState().beginMarkRead(firstNotification);
    useTaskNotificationStore.getState().addCreatedNotifications([liveNotification]);
    useTaskNotificationStore.getState().rollbackMarkRead(firstNotification);

    expect(useTaskNotificationStore.getState().unreadTotal).toBe(3);
    expect(useTaskNotificationStore.getState().unreadNotifications.map(({ id }) => id)).toEqual([
      'notif-1',
      'notif-live',
      'notif-2',
    ]);
  });

  it('does not restore a pending optimistic read during unread page hydration', () => {
    const firstNotification = makeNotification({ id: 'notif-1', taskKey: 'PROJ-327' });
    const secondNotification = makeNotification({ id: 'notif-2', taskKey: 'PROJ-328' });

    useTaskNotificationStore
      .getState()
      .hydrateUnreadPage(makePage([firstNotification, secondNotification], 2));
    useTaskNotificationStore.getState().beginMarkRead(firstNotification);
    useTaskNotificationStore
      .getState()
      .hydrateUnreadPage(makePage([firstNotification, secondNotification], 2));

    expect(useTaskNotificationStore.getState().unreadTotal).toBe(1);
    expect(useTaskNotificationStore.getState().unreadNotifications.map(({ id }) => id)).toEqual([
      'notif-2',
    ]);
  });

  it('subtracts pending reads outside the fetched page from hydrated unread total', () => {
    const firstNotification = makeNotification({ id: 'notif-1', taskKey: 'PROJ-327' });
    const secondNotification = makeNotification({ id: 'notif-2', taskKey: 'PROJ-328' });
    const offPageNotification = makeNotification({ id: 'notif-off-page', taskKey: 'PROJ-999' });

    useTaskNotificationStore
      .getState()
      .hydrateUnreadPage(makePage([firstNotification, secondNotification], 5));
    useTaskNotificationStore.getState().beginMarkRead(offPageNotification);
    useTaskNotificationStore
      .getState()
      .hydrateUnreadPage(makePage([firstNotification, secondNotification], 5));

    expect(useTaskNotificationStore.getState().unreadTotal).toBe(4);
    expect(useTaskNotificationStore.getState().unreadNotifications.map(({ id }) => id)).toEqual([
      'notif-1',
      'notif-2',
    ]);
  });

  it('optimistically decrements unread total for notifications missing from the local list', () => {
    const firstNotification = makeNotification({ id: 'notif-1', taskKey: 'PROJ-327' });
    const offPageNotification = makeNotification({ id: 'notif-off-page', taskKey: 'PROJ-999' });

    useTaskNotificationStore.getState().hydrateUnreadPage(makePage([firstNotification], 5));
    useTaskNotificationStore.getState().beginMarkRead(offPageNotification);

    expect(useTaskNotificationStore.getState().unreadTotal).toBe(4);
    expect(useTaskNotificationStore.getState().unreadNotifications.map(({ id }) => id)).toEqual([
      'notif-1',
    ]);
  });

  it('keeps a task unread count while another notification for the same task remains unread', () => {
    const firstNotification = makeNotification({ id: 'notif-1', taskKey: 'PROJ-327' });
    const secondNotification = makeNotification({ id: 'notif-2', taskKey: 'PROJ-327' });

    useTaskNotificationStore
      .getState()
      .hydrateUnreadPage(makePage([firstNotification, secondNotification], 2));
    useTaskNotificationStore.getState().beginMarkRead(firstNotification);
    useTaskNotificationStore.getState().finishMarkRead(firstNotification);

    expect(useTaskNotificationStore.getState().unreadTotal).toBe(1);
    expect(useTaskNotificationStore.getState().unreadTaskNotificationCounts).toEqual({
      'PROJ-327': 1,
    });
  });
});
