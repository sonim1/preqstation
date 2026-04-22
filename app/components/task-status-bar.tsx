'use client';

import { Anchor, Group, Paper, Progress, Text, Tooltip } from '@mantine/core';
import { IconLayoutKanban } from '@tabler/icons-react';

import {
  allStatuses,
  type KanbanStatus,
  statusColors,
  taskStatusLabel,
} from '@/lib/kanban-helpers';

import { LinkButton } from './link-button';
import { useTerminology } from './terminology-provider';

type TaskStatusBarProps = {
  tasks: { status: string }[];
  boardHref: string;
  newTaskHref: string;
};

export function TaskStatusBar({ tasks, boardHref, newTaskHref }: TaskStatusBarProps) {
  const terminology = useTerminology();
  const counts = Object.fromEntries(allStatuses.map((s) => [s, 0])) as Record<KanbanStatus, number>;
  for (const task of tasks) {
    if (task.status in counts) {
      counts[task.status as KanbanStatus]++;
    }
  }

  const total = tasks.length;
  const doneCount = counts.done + counts.archived;
  const completionPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const visibleStatuses = allStatuses.filter((status) => counts[status] > 0);
  const distributionSummary = `${total} ${
    total === 1 ? terminology.task.singularLower : terminology.task.pluralLower
  } total: ${visibleStatuses
    .map((status) => `${counts[status]} ${taskStatusLabel(status, terminology)}`)
    .join(', ')}.`;

  if (total === 0) {
    return (
      <Paper withBorder radius="md" p="lg" ta="center">
        <Text c="dimmed" size="sm" mb="sm">
          {`No ${terminology.task.pluralLower} in this project yet.`}
        </Text>
        <LinkButton href={newTaskHref} size="compact-sm" variant="default">
          {`Create First ${terminology.task.singular}`}
        </LinkButton>
      </Paper>
    );
  }

  const sections = visibleStatuses.map((s) => ({
    value: (counts[s] / total) * 100,
    color: `var(--mantine-color-${statusColors[s]}-6)`,
    label: taskStatusLabel(s, terminology),
    count: counts[s],
    status: s,
  }));

  return (
    <div>
      <Group justify="space-between" align="center" mb="xs">
        <Text fw={600} size="sm">
          {`${terminology.task.singular} Progress`}
        </Text>
        <Group gap="xs" align="center">
          <Text size="sm" c="dimmed">
            {`${doneCount} complete (${completionPct}%).`}
          </Text>
          <Anchor href={boardHref} size="sm" fw={500}>
            <Group gap={4} align="center">
              <IconLayoutKanban size={14} />
              Open Kanban
            </Group>
          </Anchor>
        </Group>
      </Group>

      <Text size="sm" c="dimmed" mb="xs">
        {distributionSummary}
      </Text>

      <Anchor href={boardHref} underline="never">
        <Progress.Root size={28} radius="md">
          {sections.map((section) => {
            const percentage = Math.round(section.value);
            return (
              <Tooltip
                key={section.status}
                label={`${section.label}: ${section.count}`}
                position="top"
                withArrow
              >
                <Progress.Section
                  value={section.value}
                  withAria={false}
                  color={section.color}
                  role="progressbar"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={percentage}
                  aria-label={`${section.label}: ${section.count} of ${total} ${terminology.task.pluralLower} (${percentage}%)`}
                  aria-valuetext={`${section.count} of ${total} ${terminology.task.pluralLower} (${percentage}%)`}
                >
                  {section.value > 8 && (
                    <Progress.Label fz={11}>
                      {section.label}: {section.count}
                    </Progress.Label>
                  )}
                </Progress.Section>
              </Tooltip>
            );
          })}
        </Progress.Root>
      </Anchor>

      <Group
        mt="xs"
        gap="sm"
        wrap="wrap"
        role="list"
        aria-label={`${terminology.task.singular} pipeline breakdown`}
      >
        {visibleStatuses.map((s) => (
          <Group
            key={s}
            gap={4}
            align="center"
            role="listitem"
            aria-label={`${taskStatusLabel(s, terminology)}: ${counts[s]} of ${total} ${terminology.task.pluralLower}`}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: `var(--mantine-color-${statusColors[s]}-6)`,
              }}
            />
            <Text size="xs" c="dimmed">
              {taskStatusLabel(s, terminology)}: {counts[s]}
            </Text>
          </Group>
        ))}
      </Group>
    </div>
  );
}
