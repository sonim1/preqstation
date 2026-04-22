import { Badge, Group, Paper, Stack, Text, Title, Tooltip } from '@mantine/core';

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

function getIntensityLevel(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
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

function buildMonthLabels(weeks: Array<Array<YearlyActivityDatum | null>>) {
  return weeks.map((week, index) => {
    if (index === 0) {
      const firstDay = week.find((entry) => entry !== null);
      return firstDay ? getMonthLabel(firstDay.date) : '';
    }

    const monthStart = week.find((entry) => entry && entry.date.endsWith('-01'));
    return monthStart ? getMonthLabel(monthStart.date) : '';
  });
}

export function DashboardYearlyHeatmap({
  data,
  panelClassName,
}: {
  data: YearlyActivityDatum[];
  panelClassName?: string;
}) {
  const rootClassName = [panelStyles.sectionPanel, panelClassName, classes.panel]
    .filter(Boolean)
    .join(' ');
  const sortedData = [...data].sort((left, right) => left.date.localeCompare(right.date));
  const year = sortedData[0]?.date.slice(0, 4) ?? String(new Date().getFullYear());
  const totalLogs = sortedData.reduce((sum, day) => sum + day.count, 0);
  const weeks = buildWeeks(sortedData);
  const monthLabels = buildMonthLabels(weeks);

  return (
    <Paper withBorder radius="lg" p={{ base: 'md', sm: 'lg' }} className={rootClassName}>
      <Stack gap="md" data-yearly-heatmap="true">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={4}>
            <Title order={4}>Current Year Activity</Title>
            <Text size="sm" c="dimmed">
              {totalLogs > 0
                ? `${totalLogs} work log${totalLogs === 1 ? '' : 's'} across ${sortedData.length} days so far.`
                : 'No work logs yet this year.'}
            </Text>
          </Stack>
          <Badge variant="light" color="gray" size="sm" radius="sm">
            {year}
          </Badge>
        </Group>

        <div className={classes.calendar}>
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
              {weekdayLabels.map((label, index) => (
                <Text key={label} size="xs" c="dimmed" className={classes.weekdayLabel}>
                  {visibleWeekdayLabels.get(index) ?? ''}
                </Text>
              ))}
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
                          data-level={getIntensityLevel(day.count)}
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
      </Stack>
    </Paper>
  );
}
