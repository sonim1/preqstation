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

function formatSparklineDate(date: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00Z` : date;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) return date;

  return tooltipDateFormatter.format(parsed);
}

export function ProjectCardWorklogSparkline({
  data,
  total,
}: {
  data: WeeklyActivity[];
  total: number;
}) {
  return (
    <WeeklySparkline
      data={data}
      h={48}
      color="var(--ui-accent)"
      curveType="linear"
      strokeWidth={2}
      fillOpacity={0.2}
      tooltipLabelFormatter={(point) => (
        <Text size="xs" mb={2} style={{ color: 'var(--ui-muted-text)' }}>
          {formatSparklineDate(point.date)}
        </Text>
      )}
      tooltipValueFormatter={(point) => (
        <Text size="sm" fw={700}>
          {point.count} of {total}
        </Text>
      )}
    />
  );
}
