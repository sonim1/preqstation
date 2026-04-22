'use client';

import { Text } from '@mantine/core';

import { WeeklySparkline } from './weekly-sparkline';

type WeeklyActivity = { date: string; count: number };

const tooltipDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

function formatServicePaceDate(date: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00Z` : date;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) return date;

  return tooltipDateFormatter.format(parsed);
}

export function DashboardServicePaceSparkline({ data }: { data: WeeklyActivity[] }) {
  return (
    <WeeklySparkline
      data={data}
      h={84}
      color="var(--ui-accent)"
      curveType="linear"
      strokeWidth={2}
      fillOpacity={0.28}
      tooltipLabelFormatter={(point) => (
        <Text size="xs" mb={2} style={{ color: 'var(--ui-muted-text)' }}>
          {formatServicePaceDate(point.date)}
        </Text>
      )}
      tooltipValueFormatter={(point) => (
        <Text size="sm" fw={700}>
          {point.count} logs
        </Text>
      )}
    />
  );
}
