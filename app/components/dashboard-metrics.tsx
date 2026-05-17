import { Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconCalendarEvent,
  IconCircleCheck,
  IconListCheck,
  IconPlayerPause,
  IconRobot,
} from '@tabler/icons-react';

import metricStyles from './metrics.module.css';
import { useTerminology } from './terminology-provider';
import { WeeklySparkline } from './weekly-sparkline';

type WeeklyActivity = { date: string; count: number };

type MetricCardProps = {
  value: number;
  label: string;
  icon: React.ReactNode;
  tone: 'focus' | 'hold' | 'todo' | 'done' | 'active';
  highlight?: boolean;
  sparklineData?: WeeklyActivity[];
  emptyLabel?: string;
};

const METRIC_TONE_TOKENS: Record<MetricCardProps['tone'], string> = {
  focus: 'var(--ui-workflow-todo)',
  hold: 'var(--ui-workflow-hold)',
  todo: 'var(--ui-workflow-ready)',
  done: 'var(--ui-workflow-done)',
  active: 'var(--ui-status-running)',
};

function MetricCard({
  value,
  label,
  icon,
  tone,
  highlight,
  sparklineData,
  emptyLabel,
}: MetricCardProps) {
  const isEmpty = value === 0;
  const accentToken = METRIC_TONE_TOKENS[tone];
  let highlightBg: string | undefined;
  if (highlight && !isEmpty) {
    if (value >= 10) {
      highlightBg = 'color-mix(in srgb, var(--ui-workflow-done), transparent 86%)';
    } else if (value >= 5) {
      highlightBg = 'color-mix(in srgb, var(--ui-dashboard-chart-primary), transparent 88%)';
    }
  }
  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      className={metricStyles.metricTile}
      style={{
        borderLeft: `3px solid ${isEmpty ? 'var(--ui-neutral-strong)' : accentToken}`,
        backgroundColor: highlightBg,
      }}
    >
      <Group gap="xs" align="flex-start">
        <ThemeIcon
          variant="light"
          size="sm"
          radius="xl"
          style={{
            color: isEmpty ? 'var(--ui-muted-text)' : accentToken,
            background: isEmpty
              ? 'var(--ui-neutral-soft)'
              : `color-mix(in srgb, ${accentToken}, transparent 84%)`,
          }}
        >
          {icon}
        </ThemeIcon>
        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
          <Text fw={700} fz="xl" c={isEmpty ? 'dimmed' : undefined}>
            {value}
          </Text>
          <Text size="xs" c="dimmed">
            {label}
          </Text>
          {isEmpty && emptyLabel && (
            <Text size="xs" c="dimmed" fs="italic">
              {emptyLabel}
            </Text>
          )}
          {sparklineData && sparklineData.length > 0 && !isEmpty && (
            <div style={{ marginTop: 6 }}>
              <WeeklySparkline data={sparklineData} />
            </div>
          )}
        </Stack>
      </Group>
    </Paper>
  );
}

type DashboardMetricsProps = {
  metrics: {
    todayTodos: number;
    holdCount: number;
    todoCount: number;
    weeklyDoneCount: number;
  };
  aiActiveCount?: number;
  weeklyActivity?: WeeklyActivity[];
};

export function DashboardMetrics({
  metrics,
  aiActiveCount,
  weeklyActivity,
}: DashboardMetricsProps) {
  const terminology = useTerminology();
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing={{ base: 'xs', sm: 'sm' }} mt="sm">
      <MetricCard
        value={metrics.todayTodos}
        label={`Today ${terminology.task.plural}`}
        icon={<IconCalendarEvent size={14} />}
        tone="focus"
      />
      <MetricCard
        value={metrics.holdCount}
        label={terminology.statuses.hold}
        icon={<IconPlayerPause size={14} />}
        tone="hold"
      />
      <MetricCard
        value={metrics.todoCount}
        label="Todo"
        icon={<IconListCheck size={14} />}
        tone="todo"
      />
      <MetricCard
        value={metrics.weeklyDoneCount}
        label={`${terminology.statuses.done} This Week`}
        icon={<IconCircleCheck size={14} />}
        tone="done"
        highlight
        sparklineData={weeklyActivity}
      />
      <MetricCard
        value={aiActiveCount || 0}
        label={terminology.agents.plural}
        icon={<IconRobot size={14} />}
        tone="active"
        emptyLabel={`No ${terminology.agents.pluralLower} running`}
      />
    </SimpleGrid>
  );
}
