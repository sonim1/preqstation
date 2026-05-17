'use client';

import { Tooltip } from '@mantine/core';

import classes from './project-card-worklog-sparkline.module.css';

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

function formatLogCount(count: number) {
  return `${count} work log${count === 1 ? '' : 's'}`;
}

function formatActivityCount(count: number) {
  return count === 0 ? 'no work logs' : formatLogCount(count);
}

function getActivityLevel(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

export function ProjectCardWorklogSparkline({
  data,
  total,
}: {
  data: WeeklyActivity[];
  total: number;
}) {
  const label = `${formatLogCount(total)} across the last ${data.length} days`;

  return (
    <div aria-label={label} className={classes.strip} data-project-card-activity-strip="true">
      {data.map((point) => {
        const pointLabel = `Activity for ${formatSparklineDate(point.date)}: ${formatActivityCount(point.count)}`;

        return (
          <Tooltip key={point.date} label={pointLabel} withArrow>
            <span
              aria-label={pointLabel}
              className={classes.cell}
              data-activity-date={point.date}
              data-activity-level={getActivityLevel(point.count)}
              tabIndex={0}
            />
          </Tooltip>
        );
      })}
    </div>
  );
}
