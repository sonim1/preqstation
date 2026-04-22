'use client';

import { Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconPencil, IconSun, IconTargetArrow } from '@tabler/icons-react';
import { useState, useTransition } from 'react';

import { EmptyState } from '@/app/components/empty-state';
import { LinkButton } from '@/app/components/link-button';
import { TaskPriorityIcon } from '@/app/components/task-priority-icon';
import { useTerminology } from '@/app/components/terminology-provider';

import cardStyles from '../cards.module.css';
import panelStyles from '../panels.module.css';

type FocusTodo = {
  id: string;
  taskKey: string;
  title: string;
  taskPriority: string;
  status: string;
  focusedAt?: Date | null;
  project: { name: string } | null;
  labels: Array<{ id: string; name: string; color?: string | null }>;
};

function buildDashboardHref(options: {
  panel?: string | null;
  projectId?: string;
  taskId?: string;
}) {
  const query = new URLSearchParams();
  if (options.projectId) query.set('projectId', options.projectId);
  if (options.taskId) query.set('taskId', options.taskId);
  if (options.panel) query.set('panel', options.panel);
  const text = query.toString();
  return text ? `/dashboard?${text}` : '/dashboard';
}

type FocusQueuePanelProps = {
  focusTodos: FocusTodo[];
  updateTodoStatusAction: (formData: FormData) => Promise<void>;
  toggleTodayFocusAction: (formData: FormData) => Promise<void>;
  selectedProjectId?: string;
  panelClassName?: string;
};

const COLLAPSED_TODO_COUNT = 6;

export function FocusQueuePanel({
  focusTodos,
  updateTodoStatusAction,
  toggleTodayFocusAction,
  selectedProjectId,
  panelClassName,
}: FocusQueuePanelProps) {
  const terminology = useTerminology();
  const buildHref = buildDashboardHref;
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [focusingIds, setFocusingIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [, startTransition] = useTransition();

  const visibleTodos = focusTodos.filter((t) => !removedIds.has(t.id));
  const renderedTodos = showAll ? visibleTodos : visibleTodos.slice(0, COLLAPSED_TODO_COUNT);
  const rootClassName = [panelStyles.sectionPanel, panelClassName].filter(Boolean).join(' ');

  function handleDone(todo: FocusTodo) {
    const notifId = `done-${todo.id}`;

    // Immediately apply completing animation
    setCompletingIds((prev) => new Set(prev).add(todo.id));

    // After 300ms transition, remove from list
    setTimeout(() => {
      setRemovedIds((prev) => new Set(prev).add(todo.id));
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(todo.id);
        return next;
      });
    }, 300);

    // Call server action
    startTransition(async () => {
      const formData = new FormData();
      formData.set('id', todo.taskKey);
      formData.set('status', 'done');
      await updateTodoStatusAction(formData);
    });

    // Show undo toast
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
            // Revert on server
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

  function handleFocus(todo: FocusTodo) {
    setFocusingIds((prev) => new Set(prev).add(todo.id));
    setTimeout(() => {
      setRemovedIds((prev) => new Set(prev).add(todo.id));
      setFocusingIds((prev) => {
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
        <Title order={4}>Focus Queue</Title>
        <Badge variant="light" color="gray">
          {visibleTodos.length} todo
        </Badge>
      </Group>
      <Stack gap="sm">
        {visibleTodos.length === 0 ? (
          <EmptyState
            icon={<IconTargetArrow size={24} />}
            title={`No ${terminology.task.pluralLower} in focus`}
            description={`Add inbox or todo ${terminology.task.pluralLower} to see them here.`}
            action={
              <LinkButton
                href={buildHref({ panel: 'task', projectId: selectedProjectId || undefined })}
                size="xs"
              >
                {`Add ${terminology.task.singular}`}
              </LinkButton>
            }
          />
        ) : null}
        {renderedTodos.map((todo) => {
          const isCompleting = completingIds.has(todo.id);
          const isFocusing = focusingIds.has(todo.id);
          const isAnimating = isCompleting || isFocusing;
          const metadata: string[] = [];

          if (!selectedProjectId || !todo.project) {
            metadata.push(todo.project ? todo.project.name : 'General');
          }

          if (todo.labels.length === 1) {
            metadata.push(todo.labels[0].name);
          } else if (todo.labels.length > 1) {
            metadata.push(`${todo.labels.length} labels`);
          }

          return (
            <Paper
              key={todo.id}
              withBorder
              p="xs"
              radius="md"
              className={`${cardStyles.itemCard} ${cardStyles.taskItemCard}`}
              style={{
                opacity: isAnimating ? 0.5 : 1,
                transform: isAnimating ? 'translateX(20px)' : 'none',
                transition: 'opacity 300ms ease-out, transform 300ms ease-out',
              }}
            >
              <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                <Stack gap={2} style={{ flex: '1 1 0', minWidth: 0 }}>
                  <Group gap={6} align="center" wrap="nowrap">
                    <TaskPriorityIcon priority={todo.taskPriority} size={13} />
                    <Text
                      fw={600}
                      size="sm"
                      style={{
                        minWidth: 0,
                        lineHeight: 1.3,
                        textDecoration: isCompleting ? 'line-through' : 'none',
                      }}
                    >
                      {`${todo.taskKey} · ${todo.title}`}
                    </Text>
                  </Group>
                  {metadata.length > 0 ? (
                    <Text c="dimmed" size="xs">
                      {metadata.join(' · ')}
                    </Text>
                  ) : null}
                </Stack>
                <Group gap={4} wrap="nowrap">
                  <Button
                    variant="light"
                    color="green"
                    size="compact-sm"
                    px={8}
                    disabled={isAnimating}
                    onClick={() => handleDone(todo)}
                    aria-label={`Complete ${todo.taskKey} "${todo.title}"`}
                    title={`Complete ${terminology.task.singularLower}`}
                  >
                    <IconCheck size={14} />
                  </Button>
                  <Button
                    variant="subtle"
                    color="yellow"
                    size="compact-sm"
                    px={8}
                    disabled={isAnimating}
                    onClick={() => handleFocus(todo)}
                    aria-label={`Add ${todo.taskKey} "${todo.title}" to today's focus`}
                    title="Add to today's focus"
                  >
                    <IconSun size={14} />
                  </Button>
                  <LinkButton
                    href={buildHref({
                      projectId: selectedProjectId || undefined,
                      panel: 'task-edit',
                      taskId: todo.taskKey,
                    })}
                    variant="default"
                    size="compact-sm"
                    px={8}
                    aria-label={`Edit ${todo.taskKey} "${todo.title}"`}
                    title={`Edit ${terminology.task.singularLower}`}
                  >
                    <IconPencil size={14} />
                  </LinkButton>
                </Group>
              </Group>
            </Paper>
          );
        })}
        {!showAll && visibleTodos.length > COLLAPSED_TODO_COUNT && (
          <Button variant="subtle" size="xs" fullWidth onClick={() => setShowAll(true)}>
            Show more
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
