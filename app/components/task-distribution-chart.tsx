'use client';

import { Badge, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconChartBar } from '@tabler/icons-react';

import { EmptyState } from '@/app/components/empty-state';
import { useTerminology } from '@/app/components/terminology-provider';
import { TASK_STATUS_COLORS, type TaskStatus } from '@/lib/task-meta';
import { getTaskStatusLabel } from '@/lib/terminology';

import panelStyles from './panels.module.css';

type TaskDistributionProps = {
  inbox: number;
  todo: number;
  hold: number;
  ready: number;
  done: number;
  panelClassName?: string;
};

export function TaskDistributionChart({
  inbox,
  todo,
  hold,
  ready,
  done,
  panelClassName,
}: TaskDistributionProps) {
  const terminology = useTerminology();
  const total = inbox + todo + hold + ready + done;
  const rootClassName = [panelStyles.sectionPanel, panelClassName].filter(Boolean).join(' ');

  const data = [
    {
      key: 'inbox' as const,
      label: getTaskStatusLabel('inbox', terminology),
      value: inbox,
      context: 'New work waiting to be shaped.',
    },
    {
      key: 'todo' as const,
      label: getTaskStatusLabel('todo', terminology),
      value: todo,
      context: 'Committed work already in motion or next up.',
    },
    {
      key: 'hold' as const,
      label: getTaskStatusLabel('hold', terminology),
      value: hold,
      context: 'Blocked or intentionally paused work.',
    },
    {
      key: 'ready' as const,
      label: getTaskStatusLabel('ready', terminology),
      value: ready,
      context: 'Ready for QA, handoff, or release.',
    },
    {
      key: 'done' as const,
      label: getTaskStatusLabel('done', terminology),
      value: done,
      context: 'Finished work captured in the current flow.',
    },
  ].filter((item) => item.value > 0);
  const maxValue = data.reduce((currentMax, item) => Math.max(currentMax, item.value), 0);

  if (total === 0) {
    return (
      <Paper withBorder radius="lg" p={{ base: 'md', sm: 'lg' }} className={rootClassName}>
        <Stack gap="xs">
          <Title order={4}>Workflow Snapshot</Title>
          <Text size="sm" c="dimmed">
            Bars compare current task counts across the workflow.
          </Text>
          <EmptyState
            icon={<IconChartBar size={24} />}
            title={`No ${terminology.task.pluralLower} yet`}
            description={`Create ${terminology.task.pluralLower} in your projects to see workflow counts here.`}
          />
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper withBorder radius="lg" p={{ base: 'md', sm: 'lg' }} className={rootClassName}>
      <Group justify="space-between" align="flex-start" mb="sm">
        <Stack gap={4}>
          <Title order={4}>Workflow Snapshot</Title>
          <Text size="sm" c="dimmed">
            Bars compare current task counts across the workflow.
          </Text>
        </Stack>
        <Badge variant="light" color="gray" size="sm" radius="sm">
          {`${total} ${terminology.task.pluralLower}`}
        </Badge>
      </Group>
      <Stack gap="sm" role="list" aria-label="Workflow snapshot">
        {data.map((item) => {
          const share = Math.round((item.value / total) * 100);
          const width = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 12) : 0;
          const barColor = resolveWorkflowBarColor(item.key);

          return (
            <div key={item.key} data-workflow-status-row={item.key} role="listitem">
              <Group justify="space-between" align="center" mb={6}>
                <Text size="sm" fw={700}>
                  {item.label}
                </Text>
                <Group gap="xs" align="baseline">
                  <Text size="xs" c="dimmed">
                    {share}% of flow
                  </Text>
                  <Text size="sm" fw={700}>
                    {item.value}
                  </Text>
                </Group>
              </Group>
              <div
                style={{
                  position: 'relative',
                  height: 10,
                  borderRadius: 999,
                  overflow: 'hidden',
                  background: 'color-mix(in srgb, var(--ui-border), transparent 54%)',
                }}
              >
                <div
                  data-workflow-status-bar={item.key}
                  style={{
                    width: `${width}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: barColor,
                  }}
                />
              </div>
              <Text size="xs" c="dimmed" mt={6}>
                {item.context}
              </Text>
            </div>
          );
        })}
      </Stack>
    </Paper>
  );
}

function resolveWorkflowBarColor(status: TaskStatus) {
  const color = TASK_STATUS_COLORS[status];
  return `var(--mantine-color-${color}-6)`;
}
