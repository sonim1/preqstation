'use client';

import { Badge, Button, Drawer, Group, Stack, Text } from '@mantine/core';
import { IconBell, IconHistory } from '@tabler/icons-react';

import { EmptyState } from '@/app/components/empty-state';
import { formatDateTimeForDisplay } from '@/lib/date-time';
import { TASK_STATUS_LABELS } from '@/lib/task-meta';

import { LoadMoreButton } from './load-more-button';
import { useTimeZone } from './timezone-provider';

export type TaskNotificationItem = {
  id: string;
  projectId: string | null;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  statusFrom: string;
  statusTo: string;
  readAt: string | null;
  createdAt: string;
};

export type TaskNotificationDrawerMode = 'unread' | 'history';

type TaskNotificationDrawerProps = {
  opened: boolean;
  onClose: () => void;
  mode: TaskNotificationDrawerMode;
  notifications: TaskNotificationItem[];
  total: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onShowHistory: () => void;
  onShowUnread: () => void;
  onLoadMore: () => void;
};

function labelForStatus(status: string) {
  return TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS] ?? status;
}

export function TaskNotificationDrawer({
  opened,
  onClose,
  mode,
  notifications,
  total,
  isLoading,
  isLoadingMore,
  hasMore,
  onShowHistory,
  onShowUnread,
  onLoadMore,
}: TaskNotificationDrawerProps) {
  const timeZone = useTimeZone();
  const isHistoryMode = mode === 'history';

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      title={
        <Group gap={8} wrap="nowrap">
          <Text fw={700}>Task Notifications</Text>
          <Badge size="sm" color="gray" variant="light">
            {total}
          </Badge>
        </Group>
      }
    >
      <Stack gap="sm">
        <Group justify="space-between">
          {isHistoryMode ? (
            <Button variant="subtle" onClick={onShowUnread}>
              Show unread
            </Button>
          ) : (
            <Button variant="subtle" onClick={onShowHistory}>
              Show history
            </Button>
          )}
        </Group>

        <Stack gap={4} className="task-notification-drawer-list">
          {isLoading && notifications.length === 0 ? (
            <Text size="sm" c="dimmed">
              Loading notifications
            </Text>
          ) : null}

          {!isLoading && notifications.length === 0 && !isHistoryMode ? (
            <EmptyState
              icon={<IconBell size={24} />}
              title="No unread notifications"
              description="Completed work will appear here."
            />
          ) : null}

          {!isLoading && notifications.length === 0 && isHistoryMode ? (
            <EmptyState
              icon={<IconHistory size={24} />}
              title="No notification history"
              description="Read notifications will appear here once they arrive."
            />
          ) : null}

          {notifications.map((notification) => (
            <div key={notification.id} className="task-notification-item">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <div className="task-notification-copy">
                  <Text size="sm" fw={600}>
                    {notification.taskKey} · {notification.taskTitle}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {labelForStatus(notification.statusFrom)} -&gt;{' '}
                    {labelForStatus(notification.statusTo)}
                  </Text>
                </div>
                <Text size="xs" c="dimmed">
                  {formatDateTimeForDisplay(notification.createdAt, timeZone)}
                </Text>
              </Group>
            </div>
          ))}
        </Stack>

        {isHistoryMode && hasMore ? (
          <Group justify="center">
            <LoadMoreButton onClick={onLoadMore} disabled={isLoadingMore} />
          </Group>
        ) : null}
      </Stack>
    </Drawer>
  );
}
