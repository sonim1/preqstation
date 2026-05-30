// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const subscribePolledTaskEventsMock = vi.hoisted(() => vi.fn());
const showErrorNotificationMock = vi.hoisted(() => vi.fn());
const showTaskCompletionNotificationMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());
const routerRefreshMock = vi.hoisted(() => vi.fn());

let drawerProps: Record<string, unknown> | null = null;
let subscriber: ((events: Array<Record<string, unknown>>) => Promise<boolean> | boolean) | null =
  null;
let fetchMock: ReturnType<typeof vi.fn>;

vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    drawerProps = props;
    return <div data-testid="task-notification-drawer" />;
  },
}));

vi.mock('@/lib/event-poll-subscriptions', () => ({
  extractCreatedNotificationsFromPolledEvents: (events: Array<Record<string, unknown>>) => events,
  subscribePolledTaskEvents: (
    nextSubscriber: ((events: Array<Record<string, unknown>>) => Promise<boolean> | boolean) | null,
  ) => {
    subscriber = nextSubscriber;
    return subscribePolledTaskEventsMock(nextSubscriber);
  },
}));

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: showErrorNotificationMock,
  showTaskCompletionNotification: showTaskCompletionNotificationMock,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPushMock,
    refresh: routerRefreshMock,
  }),
}));

import {
  buildNotificationTaskHref,
  TaskNotificationCenter,
} from '@/app/components/task-notification-center';
import { useTaskNotificationStore } from '@/app/components/task-notification-store';

const taskNotificationCenterSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/task-notification-center.tsx'),
  'utf8',
);

function makeNotification(
  overrides: Partial<{
    id: string;
    taskKey: string;
    taskTitle: string;
    statusFrom: string;
    statusTo: string;
    readAt: string | null;
    createdAt: string;
  }> = {},
) {
  return {
    id: overrides.id ?? 'notif-1',
    projectId: 'project-1',
    taskId: 'task-1',
    taskKey: overrides.taskKey ?? 'PROJ-327',
    taskTitle: overrides.taskTitle ?? 'Add browser notifications',
    statusFrom: overrides.statusFrom ?? 'todo',
    statusTo: overrides.statusTo ?? 'ready',
    readAt: overrides.readAt ?? null,
    createdAt: overrides.createdAt ?? '2026-04-08T05:00:00.000Z',
  };
}

function buildNotifications(count: number) {
  return Array.from({ length: count }, (_unused, index) =>
    makeNotification({
      id: `notif-${index + 1}`,
      taskKey: `PROJ-${327 + index}`,
      taskTitle: `Notification ${index + 1}`,
      createdAt: `2026-04-08T05:${String(index).padStart(2, '0')}:00.000Z`,
    }),
  );
}

function makePage(total: number, notifications: ReturnType<typeof buildNotifications>) {
  return {
    notifications,
    total,
    offset: 0,
    limit: 20,
    hasMore: total > notifications.length,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe('app/components/task-notification-center', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    drawerProps = null;
    subscriber = null;
    fetchMock = vi.fn();

    vi.clearAllMocks();
    routerPushMock.mockReset();
    useTaskNotificationStore.setState(useTaskNotificationStore.getInitialState(), true);
    routerRefreshMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    subscribePolledTaskEventsMock.mockImplementation(
      (nextSubscriber: (events: Array<Record<string, unknown>>) => Promise<boolean> | boolean) => {
        subscriber = nextSubscriber;
        return () => undefined;
      },
    );
  });

  function renderTaskNotificationCenter() {
    return render(
      <MantineProvider>
        <TaskNotificationCenter />
      </MantineProvider>,
    );
  }

  it('keeps the navbar notification trigger on the shared 44px control contract', () => {
    expect(taskNotificationCenterSource).toMatch(
      /<ActionIcon[\s\S]*size=\{44\}[\s\S]*className="workspace-notification-trigger"/,
    );
    expect(taskNotificationCenterSource).toMatch(/<IconBell size=\{20\} \/>/);
  });

  it('uses the unread total from the API instead of the loaded page length', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => makePage(26, buildNotifications(20)),
    });

    renderTaskNotificationCenter();

    expect(await screen.findByLabelText('Open notifications (26 unread)')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Open notifications (26 unread)'));

    await waitFor(() => {
      expect(drawerProps?.total).toBe(26);
    });
  });

  it('keeps polled notifications when the first unread fetch resolves later', async () => {
    const firstPage = deferred<{ ok: boolean; json: () => Promise<ReturnType<typeof makePage>> }>();
    fetchMock.mockReturnValueOnce(firstPage.promise).mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makePage(21, [
          makeNotification({
            id: 'notif-live',
            taskKey: 'PROJ-999',
            taskTitle: 'Live notification',
          }),
          ...buildNotifications(19),
        ]),
    });

    renderTaskNotificationCenter();

    await subscriber?.([
      makeNotification({
        id: 'notif-live',
        taskKey: 'PROJ-999',
        taskTitle: 'Live notification',
      }),
    ]);

    firstPage.resolve({
      ok: true,
      json: async () => makePage(20, buildNotifications(20)),
    });

    expect(await screen.findByLabelText('Open notifications (21 unread)')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Open notifications (21 unread)'));

    await waitFor(() => {
      const notifications = drawerProps?.notifications as Array<{ id: string }>;
      expect(notifications.some((notification) => notification.id === 'notif-live')).toBe(true);
    });
  });

  it('keeps unread notifications visible when the drawer opens', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => makePage(3, buildNotifications(3)),
    });

    renderTaskNotificationCenter();

    fireEvent.click(await screen.findByLabelText('Open notifications (3 unread)'));

    await waitFor(() => {
      expect(drawerProps?.total).toBe(3);
      expect((drawerProps?.notifications as Array<{ id: string }>).length).toBe(3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it('closes and navigates before marking only the clicked notification as read', async () => {
    const markReadRequest = deferred<{ ok: boolean; json: () => Promise<{ ok: true }> }>();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makePage(3, buildNotifications(3)),
      })
      .mockReturnValueOnce(markReadRequest.promise);

    renderTaskNotificationCenter();

    fireEvent.click(await screen.findByLabelText('Open notifications (3 unread)'));
    await waitFor(() => expect(drawerProps?.total).toBe(3));

    (
      drawerProps?.onNotificationClick as (
        notification: ReturnType<typeof makeNotification>,
      ) => void
    )(makeNotification({ id: 'notif-1' }));

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith(
        '/board?panel=task-edit&taskId=PROJ-327&focus=PROJ-327',
      );
      expect(routerRefreshMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/notifications',
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'same-origin',
          body: JSON.stringify({ notificationIds: ['notif-1'] }),
        }),
      );
      expect(screen.getByLabelText('Open notifications (2 unread)')).toBeTruthy();
      expect(screen.queryByTestId('task-notification-drawer')).toBeNull();
    });
    expect(routerRefreshMock.mock.invocationCallOrder[0]).toBeLessThan(
      routerPushMock.mock.invocationCallOrder[0],
    );
    expect(routerPushMock.mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[1],
    );

    markReadRequest.resolve({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await waitFor(() => {
      expect(routerRefreshMock).toHaveBeenCalledTimes(2);
      expect(routerPushMock).toHaveBeenCalledTimes(1);
    });
  });

  it('builds a focused board URL with encoded task keys', () => {
    expect(buildNotificationTaskHref({ taskKey: 'PROJ 310/alpha' })).toBe(
      '/board?panel=task-edit&taskId=PROJ%20310%2Falpha&focus=PROJ%20310%2Falpha',
    );
  });

  it('treats already-read notification responses as a successful no-op', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makePage(3, buildNotifications(3)),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, updatedIds: [] }),
      });

    renderTaskNotificationCenter();

    fireEvent.click(await screen.findByLabelText('Open notifications (3 unread)'));
    await waitFor(() => expect(drawerProps?.total).toBe(3));

    (
      drawerProps?.onNotificationClick as (
        notification: ReturnType<typeof makeNotification>,
      ) => void
    )(makeNotification({ id: 'notif-1' }));

    await waitFor(() => {
      expect(showErrorNotificationMock).not.toHaveBeenCalledWith(
        'Failed to mark notification as read.',
      );
      expect(routerPushMock).toHaveBeenCalledWith(
        '/board?panel=task-edit&taskId=PROJ-327&focus=PROJ-327',
      );
      expect(routerRefreshMock).toHaveBeenCalledTimes(2);
      expect(screen.getByLabelText('Open notifications (2 unread)')).toBeTruthy();
      expect(screen.queryByTestId('task-notification-drawer')).toBeNull();
    });
  });

  it('restores unread state when marking a clicked notification fails', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makePage(3, buildNotifications(3)),
      })
      .mockRejectedValueOnce(new Error('patch failed'));

    renderTaskNotificationCenter();

    fireEvent.click(await screen.findByLabelText('Open notifications (3 unread)'));
    await waitFor(() => expect(drawerProps?.total).toBe(3));

    (
      drawerProps?.onNotificationClick as (
        notification: ReturnType<typeof makeNotification>,
      ) => void
    )(makeNotification({ id: 'notif-1' }));

    await waitFor(() => {
      expect(showErrorNotificationMock).toHaveBeenCalledWith(
        'Failed to mark notification as read.',
      );
      expect(routerPushMock).toHaveBeenCalledWith(
        '/board?panel=task-edit&taskId=PROJ-327&focus=PROJ-327',
      );
      expect(routerRefreshMock).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText('Open notifications (3 unread)')).toBeTruthy();
      expect(screen.queryByTestId('task-notification-drawer')).toBeNull();
    });

    fireEvent.click(screen.getByLabelText('Open notifications (3 unread)'));

    await waitFor(() => {
      expect(drawerProps?.total).toBe(3);
      expect((drawerProps?.notifications as Array<{ id: string }>).map(({ id }) => id)).toEqual([
        'notif-1',
        'notif-2',
        'notif-3',
      ]);
    });
  });

  it('restores clicked notifications without losing polled notifications when marking read fails', async () => {
    const markReadRequest = deferred<{ ok: boolean; json: () => Promise<{ ok: true }> }>();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makePage(3, buildNotifications(3)),
      })
      .mockReturnValueOnce(markReadRequest.promise);

    renderTaskNotificationCenter();

    fireEvent.click(await screen.findByLabelText('Open notifications (3 unread)'));
    await waitFor(() => expect(drawerProps?.total).toBe(3));

    (
      drawerProps?.onNotificationClick as (
        notification: ReturnType<typeof makeNotification>,
      ) => void
    )(makeNotification({ id: 'notif-1' }));

    await subscriber?.([
      makeNotification({
        id: 'notif-live',
        taskKey: 'PROJ-999',
        taskTitle: 'Live notification',
      }),
    ]);

    markReadRequest.reject(new Error('patch failed'));

    await waitFor(() => {
      expect(showErrorNotificationMock).toHaveBeenCalledWith(
        'Failed to mark notification as read.',
      );
      expect(routerPushMock).toHaveBeenCalledWith(
        '/board?panel=task-edit&taskId=PROJ-327&focus=PROJ-327',
      );
      expect(routerRefreshMock).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText('Open notifications (4 unread)')).toBeTruthy();
      expect(screen.queryByTestId('task-notification-drawer')).toBeNull();
    });

    fireEvent.click(screen.getByLabelText('Open notifications (4 unread)'));

    await waitFor(() => {
      expect(drawerProps?.total).toBe(4);
      expect((drawerProps?.notifications as Array<{ id: string }>).map(({ id }) => id)).toEqual([
        'notif-1',
        'notif-live',
        'notif-2',
        'notif-3',
      ]);
    });
  });
});
