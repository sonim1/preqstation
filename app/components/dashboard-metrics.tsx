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
  accentColor: string;
  highlight?: boolean;
  sparklineData?: WeeklyActivity[];
  emptyLabel?: string;
};

function MetricCard({
  value,
  label,
  icon,
  accentColor,
  highlight,
  sparklineData,
  emptyLabel,
}: MetricCardProps) {
  const isEmpty = value === 0;
  let highlightBg: string | undefined;
  if (highlight && !isEmpty) {
    if (value >= 10) {
      highlightBg = 'var(--mantine-color-green-0)';
    } else if (value >= 5) {
      highlightBg = 'var(--mantine-color-blue-0)';
    }
  }
  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      className={metricStyles.metricTile}
      style={{
        borderLeft: isEmpty
          ? '3px solid var(--mantine-color-gray-4)'
          : `3px solid var(--mantine-color-${accentColor}-6)`,
        backgroundColor: highlightBg,
      }}
    >
      <Group gap="xs" align="flex-start">
        <ThemeIcon variant="light" color={isEmpty ? 'gray' : accentColor} size="sm" radius="xl">
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
        accentColor="blue"
      />
      <MetricCard
        value={metrics.holdCount}
        label={terminology.statuses.hold}
        icon={<IconPlayerPause size={14} />}
        accentColor="yellow"
      />
      <MetricCard
        value={metrics.todoCount}
        label="Todo"
        icon={<IconListCheck size={14} />}
        accentColor="orange"
      />
      <MetricCard
        value={metrics.weeklyDoneCount}
        label={`${terminology.statuses.done} This Week`}
        icon={<IconCircleCheck size={14} />}
        accentColor="green"
        highlight
        sparklineData={weeklyActivity}
      />
      <MetricCard
        value={aiActiveCount || 0}
        label={terminology.agents.plural}
        icon={<IconRobot size={14} />}
        accentColor="indigo"
        emptyLabel={`No ${terminology.agents.pluralLower} running`}
      />
    </SimpleGrid>
  );
}
