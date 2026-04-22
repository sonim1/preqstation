'use client';

import { ActionIcon, Badge, Drawer, Group, Menu, Stack, Text, TextInput } from '@mantine/core';
import { IconArchive, IconArrowBackUp, IconDots, IconTrash } from '@tabler/icons-react';

import { EmptyState } from '@/app/components/empty-state';
import { TaskPriorityIcon } from '@/app/components/task-priority-icon';
import { formatDateTimeForDisplay } from '@/lib/date-time';
import type { KanbanStatus, KanbanTask } from '@/lib/kanban-helpers';

import { InfiniteScrollTrigger } from './infinite-scroll-trigger';
import { useTimeZone } from './timezone-provider';

type KanbanArchiveDrawerProps = {
  opened: boolean;
  onClose: () => void;
  tasks: KanbanTask[];
  total: number;
  query: string;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  nextOffset: number;
  loadMoreError: string | null;
  isPending: boolean;
  onQueryChange: (value: string) => void;
  onRestore: (taskId: string, targetStatus: KanbanStatus) => void;
  onDelete: (taskId: string) => void;
  onLoadMore: () => void;
};

export function KanbanArchiveDrawer({
  opened,
  onClose,
  tasks,
  total,
  query,
  isLoading,
  isLoadingMore,
  hasMore,
  nextOffset,
  loadMoreError,
  isPending,
  onQueryChange,
  onRestore,
  onDelete,
  onLoadMore,
}: KanbanArchiveDrawerProps) {
  const trimmedQuery = query.trim();
  const timeZone = useTimeZone();

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      title={
        <Group gap={8} wrap="nowrap">
          <Text fw={700}>Archived Tasks</Text>
          <Badge size="sm" color="gray" variant="light">
            {total}
          </Badge>
        </Group>
      }
    >
      <Stack gap="sm">
        <TextInput
          placeholder="Search archived tasks"
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
        />
        {tasks.length > 0 || total > 0 ? (
          <Text size="xs" c="dimmed">
            Showing {tasks.length} of {total}
          </Text>
        ) : null}
        <Stack gap={4} className="kanban-archive-drawer-list">
          {isLoading && tasks.length === 0 ? (
            <Text size="sm" c="dimmed">
              Loading archived tasks
            </Text>
          ) : null}
          {!isLoading && total === 0 && !trimmedQuery ? (
            <EmptyState
              icon={<IconArchive size={24} />}
              title="No archived tasks"
              description="Completed tasks you archive will appear here."
            />
          ) : null}
          {!isLoading && total === 0 && trimmedQuery ? (
            <EmptyState
              icon={<IconArchive size={24} />}
              title="No matching archived tasks"
              description="Try a different task key, title, note, branch, or label."
            />
          ) : null}
          {tasks.map((task) => {
            const archivedDate = new Date(task.archivedAt ?? task.updatedAt);
            const timeStr = formatDateTimeForDisplay(archivedDate, timeZone);
            return (
              <Group
                key={task.id}
                gap="xs"
                wrap="nowrap"
                justify="space-between"
                className="kanban-archive-item"
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Group gap={6} wrap="nowrap" align="center">
                    <TaskPriorityIcon priority={task.taskPriority} size={13} />
                    <Text size="sm" fw={500} truncate="end">
                      {task.title}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {timeStr}
                  </Text>
                </div>
                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="gray"
                      aria-label="Archive actions"
                    >
                      <IconDots size={14} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconArrowBackUp size={14} />}
                      onClick={() => onRestore(task.id, 'todo')}
                      disabled={isPending}
                    >
                      Restore
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconTrash size={14} />}
                      color="red"
                      onClick={() => onDelete(task.id)}
                      disabled={isPending}
                    >
                      Delete
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            );
          })}
        </Stack>
        {loadMoreError ? (
          <Stack gap={2}>
            <Text size="sm" c="red">
              {loadMoreError}
            </Text>
            <Text size="xs" c="dimmed">
              Use the retry control to keep loading archived tasks.
            </Text>
          </Stack>
        ) : null}
        <Group justify="center">
          <InfiniteScrollTrigger
            active={opened && !isLoading}
            hasMore={hasMore}
            loading={isLoadingMore}
            disabled={isLoading || isLoadingMore || isPending}
            resetKey={`${query}:${nextOffset}`}
            onLoadMore={onLoadMore}
            showManualFallback={loadMoreError !== null}
          />
        </Group>
      </Stack>
    </Drawer>
  );
}
