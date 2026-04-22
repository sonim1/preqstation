'use client';

import { Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconSun } from '@tabler/icons-react';
import { useState, useTransition } from 'react';

import { EmptyState } from '@/app/components/empty-state';
import { TaskPriorityIcon } from '@/app/components/task-priority-icon';
import { useTerminology } from '@/app/components/terminology-provider';
import { getBoardStatusLabel } from '@/lib/terminology';

import cardStyles from '../cards.module.css';
import panelStyles from '../panels.module.css';

type TodayFocusTodo = {
  id: string;
  taskKey: string;
  title: string;
  taskPriority: string;
  status: string;
  focusedAt: Date | null;
  project: { name: string } | null;
  labels: Array<{ id: string; name: string; color?: string | null }>;
};

type TodayFocusPanelProps = {
  todayFocusTodos: TodayFocusTodo[];
  toggleTodayFocusAction: (formData: FormData) => Promise<void>;
  updateTodoStatusAction: (formData: FormData) => Promise<void>;
  panelClassName?: string;
};

export function TodayFocusPanel({
  todayFocusTodos,
  toggleTodayFocusAction,
  updateTodoStatusAction,
  panelClassName,
}: TodayFocusPanelProps) {
  const terminology = useTerminology();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [unfocusingIds, setUnfocusingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const visibleTodos = todayFocusTodos.filter((t) => !removedIds.has(t.id));
  const rootClassName = [panelStyles.sectionPanel, panelClassName].filter(Boolean).join(' ');

  function handleDone(todo: TodayFocusTodo) {
    const notifId = `today-done-${todo.id}`;
    setCompletingIds((prev) => new Set(prev).add(todo.id));
    setTimeout(() => {
      setRemovedIds((prev) => new Set(prev).add(todo.id));
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(todo.id);
        return next;
      });
    }, 300);

    startTransition(async () => {
      const formData = new FormData();
      formData.set('id', todo.taskKey);
      formData.set('status', 'done');
      await updateTodoStatusAction(formData);
    });

    notifications.show({
      id: notifId,
      title: `${terminology.task.singular} completed`,
      message: (
        <Button
          size="compact-xs"
          variant="white"
          color="green"
          mt={4}
          onClick={() => {
            notifications.hide(notifId);
            setRemovedIds((prev) => {
              const next = new Set(prev);
              next.delete(todo.id);
              return next;
            });
            setCompletingIds((prev) => {
              const next = new Set(prev);
              next.delete(todo.id);
              return next;
            });
            startTransition(async () => {
              await fetch(`/api/todos/${encodeURIComponent(todo.taskKey)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ status: todo.status }),
              });
            });
          }}
        >
          Undo
        </Button>
      ),
      color: 'green',
      autoClose: 5000,
    });
  }

  function handleUnfocus(todo: TodayFocusTodo) {
    setUnfocusingIds((prev) => new Set(prev).add(todo.id));
    setTimeout(() => {
      setRemovedIds((prev) => new Set(prev).add(todo.id));
      setUnfocusingIds((prev) => {
        const next = new Set(prev);
        next.delete(todo.id);
        return next;
      });
    }, 300);

    startTransition(async () => {
      const formData = new FormData();
      formData.set('taskId', todo.id);
      await toggleTodayFocusAction(formData);
    });
  }

  return (
    <Paper withBorder radius="lg" p={{ base: 'md', sm: 'lg' }} className={rootClassName}>
      <Group justify="space-between" align="center" mb="sm">
        <Group gap="xs" align="center">
          <IconSun size={18} color="var(--mantine-color-yellow-6)" />
          <Title order={4}>Today&apos;s Focus</Title>
        </Group>
        <Badge variant="light" color="gray">
          {visibleTodos.length} items
        </Badge>
      </Group>
      <Stack gap="sm">
        {visibleTodos.length === 0 ? (
          <EmptyState
            icon={<IconSun size={24} />}
            title={`Select today's ${terminology.task.pluralLower}`}
            description={`Press the button next to a ${terminology.task.singularLower} in Focus Queue to add it to today's focus.`}
          />
        ) : null}
        {visibleTodos.map((todo) => {
          const isCompleting = completingIds.has(todo.id);
          const isUnfocusing = unfocusingIds.has(todo.id);
          const isAnimating = isCompleting || isUnfocusing;
          return (
            <Paper
              key={todo.id}
              withBorder
              p="sm"
              radius="md"
              className={`${cardStyles.itemCard} ${cardStyles.taskItemCard}`}
              style={{
                opacity: isAnimating ? 0.5 : 1,
                transform: isAnimating ? 'translateX(20px)' : 'none',
                transition: 'opacity 300ms ease-out, transform 300ms ease-out',
              }}
            >
              <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
                <div>
                  <Group gap={6} align="center" wrap="nowrap">
                    <TaskPriorityIcon priority={todo.taskPriority} size={14} />
                    <Text
                      fw={600}
                      style={{ textDecoration: isCompleting ? 'line-through' : 'none' }}
                    >
                      {`${todo.taskKey} · ${todo.title}`}
                    </Text>
                  </Group>
                  <Group gap={6} mt={4}>
                    <Badge size="xs" variant="light" color={todo.project ? 'blue' : 'gray'}>
                      {todo.project ? todo.project.name : 'General'}
                    </Badge>
                    {todo.labels.map((label) => (
                      <Badge
                        key={label.id}
                        size="xs"
                        variant="filled"
                        color={label.color ?? undefined}
                      >
                        {label.name}
                      </Badge>
                    ))}
                  </Group>
                </div>
                <Group gap="xs" wrap="wrap">
                  <Button
                    variant="light"
                    color="green"
                    size="compact-sm"
                    disabled={isAnimating}
                    onClick={() => handleDone(todo)}
                    aria-label={`Complete ${todo.taskKey} "${todo.title}"`}
                  >
                    {getBoardStatusLabel('done', terminology)}
                  </Button>
                  <Button
                    variant="subtle"
                    color="yellow"
                    size="compact-sm"
                    disabled={isAnimating}
                    onClick={() => handleUnfocus(todo)}
                    aria-label={`Remove ${todo.taskKey} "${todo.title}" from today's focus`}
                  >
                    Remove
                  </Button>
                </Group>
              </Group>
            </Paper>
          );
        })}
      </Stack>
    </Paper>
  );
}
