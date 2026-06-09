import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mantine/core', () => {
  const Drawer = ({ children, title }: { children: ReactNode; title?: ReactNode }) => (
    <section data-testid="drawer">
      <header>{title}</header>
      <div>{children}</div>
    </section>
  );

  const ActionIcon = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  );
  const Badge = ({ children }: { children: ReactNode }) => <span>{children}</span>;
  const Button = ({
    children,
    color,
    variant,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { color?: string; variant?: string }) => (
    <button type="button" data-color={color} data-variant={variant} {...props}>
      {children}
    </button>
  );
  const Group = ({
    children,
    className,
    justify,
  }: {
    children: ReactNode;
    className?: string;
    justify?: string;
  }) => (
    <div className={className} data-justify={justify}>
      {children}
    </div>
  );
  const Stack = ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  );
  const Text = ({ children }: { children: ReactNode }) => <span>{children}</span>;

  return {
    ActionIcon,
    Badge,
    Button,
    Drawer,
    Group,
    Stack,
    Text,
  };
});

vi.mock('@tabler/icons-react', () => ({
  IconBell: () => <svg aria-hidden="true" />,
  IconHistory: () => <svg aria-hidden="true" />,
}));

vi.mock('@/app/components/empty-state', () => ({
  EmptyState: ({
    title,
    description,
  }: {
    title: string;
    description: string;
    icon?: ReactNode;
  }) => (
    <div data-empty-state="true">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock('@/app/components/load-more-button', () => ({
  LoadMoreButton: ({ disabled }: { disabled?: boolean }) => (
    <div data-load-more-button="true" data-disabled={disabled ? 'true' : 'false'}>
      Load more
    </div>
  ),
}));

import { TaskNotificationDrawer } from '@/app/components/task-notification-drawer';

function makeNotification(
  overrides: Partial<{
    id: string;
    type: 'task';
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
    type: overrides.type ?? 'task',
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

function makeConnectionNotification() {
  return {
    id: 'connection-expiring-soon:mcp:connection-1:2026-04-10T04:00:00.000Z',
    type: 'connection-expiration' as const,
    source: 'mcp' as const,
    title: 'Connection expires soon',
    targetName: 'Codex',
    targetDetail: '127.0.0.1:3456/callback',
    expiresAt: '2026-04-10T04:00:00.000Z',
    readAt: null,
    createdAt: '2026-04-08T05:00:00.000Z',
  };
}

describe('app/components/task-notification-drawer', () => {
  it('renders unread notifications by default with a history toggle', () => {
    const html = renderToStaticMarkup(
      <TaskNotificationDrawer
        opened={true}
        onClose={vi.fn()}
        mode="unread"
        notifications={[
          makeNotification(),
          makeNotification({
            id: 'notif-2',
            taskKey: 'PROJ-328',
            taskTitle: 'Second notification',
            statusTo: 'done',
            createdAt: '2026-04-08T05:10:00.000Z',
          }),
        ]}
        total={2}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        onNotificationClick={vi.fn()}
        onShowHistory={vi.fn()}
        onShowUnread={vi.fn()}
        onLoadMore={vi.fn()}
      />,
    );

    expect(html).toContain('Notifications');
    expect(html).toContain('2');
    expect(html).toContain('Show history');
    expect(html).toContain('PROJ-327');
    expect(html).toContain('Add browser notifications');
    expect(html).toContain('Ready');
    expect(html).toContain('Done');
    expect(html).toContain('<button type="button" class="task-notification-item"');
    expect(html).not.toContain('aria-label="Mark PROJ-327 notification as read"');
    expect(html).toContain('2026-04-08 05:10');
  });

  it('renders the mode action as a centered footer text action', () => {
    const html = renderToStaticMarkup(
      <TaskNotificationDrawer
        opened={true}
        onClose={vi.fn()}
        mode="unread"
        notifications={[makeNotification()]}
        total={1}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        onNotificationClick={vi.fn()}
        onShowHistory={vi.fn()}
        onShowUnread={vi.fn()}
        onLoadMore={vi.fn()}
      />,
    );

    const listIndex = html.indexOf('class="task-notification-drawer-list"');
    const footerIndex = html.indexOf('class="task-notification-drawer-footer"');
    const actionIndex = html.indexOf('class="task-notification-mode-action"');

    expect(footerIndex).toBeGreaterThan(listIndex);
    expect(actionIndex).toBeGreaterThan(footerIndex);
    expect(html).toContain('data-justify="center"');
    expect(html).toContain('data-color="gray"');
    expect(html).toContain('data-variant="transparent"');
  });

  it('renders task and connection expiration notifications with distinct copy', () => {
    const html = renderToStaticMarkup(
      <TaskNotificationDrawer
        opened={true}
        onClose={vi.fn()}
        mode="unread"
        notifications={[makeNotification(), makeConnectionNotification()]}
        total={2}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        now="2026-04-08T05:00:00.000Z"
        onShowHistory={vi.fn()}
        onShowUnread={vi.fn()}
        onLoadMore={vi.fn()}
      />,
    );

    expect(html).toContain('PROJ-327');
    expect(html).toContain('Ready');
    expect(html).toContain('Connection expires soon');
    expect(html).toContain('Codex');
    expect(html).toContain('127.0.0.1:3456/callback');
    expect(html).toContain('Expires 2026-04-10 04:00');
    expect(html).toContain('1d 23h remaining');
  });

  it('omits connection expiration remaining copy when now is omitted', () => {
    const html = renderToStaticMarkup(
      <TaskNotificationDrawer
        opened={true}
        onClose={vi.fn()}
        mode="unread"
        notifications={[makeConnectionNotification()]}
        total={1}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        onShowHistory={vi.fn()}
        onShowUnread={vi.fn()}
        onLoadMore={vi.fn()}
      />,
    );

    expect(html).toContain('Expires 2026-04-10 04:00');
    expect(html).not.toContain('remaining');
    expect(html).not.toContain('1d 23h remaining');
  });

  it('renders history mode with load-more support and a return-to-unread action', () => {
    const html = renderToStaticMarkup(
      <TaskNotificationDrawer
        opened={true}
        onClose={vi.fn()}
        mode="history"
        notifications={[
          makeNotification({
            id: 'notif-9',
            taskKey: 'PROJ-335',
            taskTitle: 'History item',
            statusFrom: 'ready',
            statusTo: 'done',
            readAt: '2026-04-08T05:30:00.000Z',
          }),
        ]}
        total={7}
        isLoading={false}
        isLoadingMore={false}
        hasMore={true}
        onNotificationClick={vi.fn()}
        onShowHistory={vi.fn()}
        onShowUnread={vi.fn()}
        onLoadMore={vi.fn()}
      />,
    );

    expect(html).toContain('Show unread');
    expect(html).toContain('History item');
    expect(html).toContain('<div class="task-notification-item"');
    expect(html).toContain('data-load-more-button="true"');
    expect(html).toContain('data-disabled="false"');
  });

  it('renders distinct empty states for unread and history modes', () => {
    const unreadHtml = renderToStaticMarkup(
      <TaskNotificationDrawer
        opened={true}
        onClose={vi.fn()}
        mode="unread"
        notifications={[]}
        total={0}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        onNotificationClick={vi.fn()}
        onShowHistory={vi.fn()}
        onShowUnread={vi.fn()}
        onLoadMore={vi.fn()}
      />,
    );
    const historyHtml = renderToStaticMarkup(
      <TaskNotificationDrawer
        opened={true}
        onClose={vi.fn()}
        mode="history"
        notifications={[]}
        total={0}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        onNotificationClick={vi.fn()}
        onShowHistory={vi.fn()}
        onShowUnread={vi.fn()}
        onLoadMore={vi.fn()}
      />,
    );

    expect(unreadHtml).toContain('No unread notifications');
    expect(unreadHtml).toContain('Completed work will appear here.');
    expect(historyHtml).toContain('No notification history');
    expect(historyHtml).toContain('Read notifications will appear here once they arrive.');
  });

  it('disables notification rows while their read request is pending', () => {
    const html = renderToStaticMarkup(
      <TaskNotificationDrawer
        opened={true}
        onClose={vi.fn()}
        mode="unread"
        notifications={[makeNotification()]}
        total={1}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        pendingReadNotificationIds={new Set(['notif-1'])}
        onNotificationClick={vi.fn()}
        onShowHistory={vi.fn()}
        onShowUnread={vi.fn()}
        onLoadMore={vi.fn()}
      />,
    );

    expect(html).toContain('disabled=""');
  });
});
