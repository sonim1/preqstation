// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const subscribePolledTaskEventsMock = vi.hoisted(() => vi.fn());
const showErrorNotificationMock = vi.hoisted(() => vi.fn());
const showTaskCompletionNotificationMock = vi.hoisted(() => vi.fn());

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

import { TaskNotificationCenter } from '@/app/components/task-notification-center';

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
    taskTitle: overrides.taskTitle ?? 'Browser Notification 추가',
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
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
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
});
