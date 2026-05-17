import { Badge, Group, Paper, Stack, Text, Title, Tooltip } from '@mantine/core';
import { IconActivity } from '@tabler/icons-react';

import classes from './dashboard-yearly-heatmap.module.css';
import panelStyles from './panels.module.css';

type YearlyActivityDatum = {
  date: string;
  count: number;
};

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const visibleWeekdayLabels = new Map([
  [1, 'Mon'],
  [3, 'Wed'],
  [5, 'Fri'],
]);

function toDateKey(date: Date) {
  return date.toISOString().split('T')[0];
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getStartOfWeek(date: Date) {
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return start;
}

function getEndOfWeek(date: Date) {
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));
  return end;
}

function getMonthLabel(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

function formatActivityLabel(dateKey: string, count: number) {
  const label = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T00:00:00.000Z`));

  if (count === 0) {
    return `${label}: no work logs`;
  }

  return `${label}: ${count} work log${count === 1 ? '' : 's'}`;
}

function getIntensityLevel(count: number, maxCount?: number) {
  if (count <= 0) return 0;
  if (maxCount !== undefined) {
    if (maxCount <= 0) return 0;
    if (count >= maxCount) return 4;
    const level = Math.ceil((count / maxCount) * 4);
    return Math.min(4, Math.max(1, level));
  }

  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

function getCurrentStreak(data: YearlyActivityDatum[]) {
  let streak = 0;
  let previousDate: Date | null = null;

  for (let index = data.length - 1; index >= 0; index -= 1) {
    const day = data[index];
    if (!day || day.count <= 0) break;

    const currentDate = new Date(`${day.date}T00:00:00.000Z`);
    if (previousDate) {
      const expected = addUtcDays(previousDate, -1);
      if (toDateKey(currentDate) !== toDateKey(expected)) break;
    }

    streak += 1;
    previousDate = currentDate;
  }

  return streak;
}

function buildWeeks(data: YearlyActivityDatum[]) {
  if (data.length === 0) {
    return [] as Array<Array<YearlyActivityDatum | null>>;
  }

  const dateMap = new Map(data.map((entry) => [entry.date, entry]));
  const firstDate = new Date(`${data[0].date}T00:00:00.000Z`);
  const lastDate = new Date(`${data[data.length - 1].date}T00:00:00.000Z`);
  const start = getStartOfWeek(firstDate);
  const end = getEndOfWeek(lastDate);
  const weeks: Array<Array<YearlyActivityDatum | null>> = [];

  for (const cursor = new Date(start); cursor.getTime() <= end.getTime(); ) {
    const week: Array<YearlyActivityDatum | null> = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const key = toDateKey(cursor);
      week.push(dateMap.get(key) ?? null);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    weeks.push(week);
  }

  return weeks;
}

function buildMonthLabels(weeks: Array<Array<YearlyActivityDatum | null>>, firstDateKey?: string) {
  if (!firstDateKey || weeks.length === 0) {
    return weeks.map(() => '');
  }

  const firstDate = new Date(`${firstDateKey}T00:00:00.000Z`);
  const firstWeekStart = getStartOfWeek(firstDate);

  return weeks.map((_, index) => {
    if (index === 0) {
      return getMonthLabel(firstDateKey);
    }

    const weekStart = new Date(firstWeekStart);
    weekStart.setUTCDate(firstWeekStart.getUTCDate() + index * 7);

    for (const cursor = new Date(weekStart); cursor <= getEndOfWeek(weekStart); ) {
      if (cursor.getUTCDate() === 1) {
        return getMonthLabel(toDateKey(cursor));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return '';
  });
}

export function DashboardYearlyHeatmap({
  data,
  panelClassName,
  title = 'Current Year Activity',
  description,
  variant = 'default',
  rangeLabel = 'last 365d',
}: {
  data: YearlyActivityDatum[];
  panelClassName?: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'projectDetail';
  rangeLabel?: string;
}) {
  const projectDetail = variant === 'projectDetail';
  const rootClassName = [
    panelStyles.sectionPanel,
    panelClassName,
    classes.panel,
    projectDetail ? classes.projectPanel : null,
  ]
    .filter(Boolean)
    .join(' ');
  const sortedData = [...data].sort((left, right) => left.date.localeCompare(right.date));
  const displayData = sortedData;
  const year = displayData[0]?.date.slice(0, 4) ?? String(new Date().getFullYear());
  const totalLogs = sortedData.reduce((sum, day) => sum + day.count, 0);
  const weeks = buildWeeks(displayData);
  const monthLabels = buildMonthLabels(weeks, displayData[0]?.date);
  const streak = getCurrentStreak(displayData);
  const maxCount = projectDetail ? Math.max(0, ...displayData.map((day) => day.count)) : undefined;

  return (
    <Paper withBorder radius="lg" p={{ base: 'md', sm: 'lg' }} className={rootClassName}>
      <Stack gap="md" data-yearly-heatmap="true" data-heatmap-variant={variant}>
        <Group
          justify="space-between"
          align={projectDetail ? 'center' : 'flex-start'}
          wrap="wrap"
          gap="sm"
        >
          {projectDetail ? (
            <Group gap="sm" align="center">
              <IconActivity size={24} className={classes.titleIcon} aria-hidden="true" />
              <Title order={4}>{title}</Title>
            </Group>
          ) : (
            <Stack gap={4}>
              <Title order={4}>{title}</Title>
              <Text size="sm" c="dimmed">
                {description ??
                  (totalLogs > 0
                    ? `${totalLogs} work log${totalLogs === 1 ? '' : 's'} across ${sortedData.length} days so far.`
                    : 'No work logs yet this year.')}
              </Text>
            </Stack>
          )}
          {projectDetail ? (
            <Text size="sm" className={classes.streakLabel}>
              <span>streak</span> {streak}d
            </Text>
          ) : (
            <Badge variant="light" color="gray" size="sm" radius="sm">
              {year}
            </Badge>
          )}
        </Group>

        <div className={classes.calendar} data-heatmap-scroll-region="true">
          <div
            className={classes.monthRow}
            style={{ gridTemplateColumns: `repeat(${weeks.length}, var(--heatmap-cell-size))` }}
          >
            {monthLabels.map((label, index) => (
              <Text
                key={`${label || 'blank'}-${index}`}
                size="xs"
                c="dimmed"
                className={classes.monthLabel}
              >
                {label}
              </Text>
            ))}
          </div>

          <div className={classes.body}>
            <div className={classes.weekdayRail} aria-hidden="true">
              {weekdayLabels.map((label, index) => {
                const visibleLabel = visibleWeekdayLabels.get(index) ?? '';

                return (
                  <Text key={label} size="xs" c="dimmed" className={classes.weekdayLabel}>
                    {projectDetail ? visibleLabel.slice(0, 1) : visibleLabel}
                  </Text>
                );
              })}
            </div>

            <div
              className={classes.weekColumns}
              style={{ gridTemplateColumns: `repeat(${weeks.length}, var(--heatmap-cell-size))` }}
            >
              {weeks.map((week, weekIndex) => (
                <div key={`week-${weekIndex}`} className={classes.weekColumn}>
                  {week.map((day, dayIndex) => {
                    if (!day) {
                      return (
                        <div
                          key={`blank-${weekIndex}-${dayIndex}`}
                          className={classes.placeholder}
                          aria-hidden="true"
                        />
                      );
                    }

                    const label = formatActivityLabel(day.date, day.count);

                    return (
                      <Tooltip key={day.date} label={label} withArrow>
                        <div
                          className={classes.cell}
                          data-count={day.count}
                          data-date={day.date}
                          data-level={getIntensityLevel(day.count, maxCount)}
                          aria-label={label}
                        />
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {projectDetail ? (
          <Group justify="space-between" align="center" gap="sm" className={classes.footer}>
            <Group gap="xs" align="center" className={classes.legend}>
              <Text size="sm">Less</Text>
              {[0, 1, 2, 3, 4].map((level) => (
                <span
                  key={level}
                  className={classes.legendCell}
                  data-level={level}
                  aria-hidden="true"
                />
              ))}
              <Text size="sm">More</Text>
            </Group>
            <Text size="sm" className={classes.totalLabel}>
              {`${totalLogs.toLocaleString()} logs · ${rangeLabel}`}
            </Text>
          </Group>
        ) : null}
      </Stack>
    </Paper>
  );
}
