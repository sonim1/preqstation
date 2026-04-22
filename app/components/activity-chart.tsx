'use client';

import { Badge, Group, Paper, Stack, Text, Title, useMantineTheme } from '@mantine/core';
import { IconChartLine } from '@tabler/icons-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState } from '@/app/components/empty-state';

import panelStyles from './panels.module.css';

const emptySubscribe = () => () => {};

type DailyActivity = { date: string; count: number };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatKoreanDate(dateStr: string): string {
  // dateStr is "MM-DD" (sliced from "YYYY-MM-DD")
  const year = new Date().getFullYear();
  const [month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const weekday = WEEKDAYS[d.getDay()];
  return `${weekday}, ${month}/${day}`;
}

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
};

function ActivityTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || !label) return null;
  const count = payload[0].value;
  return (
    <Paper
      withBorder
      radius="md"
      p="xs"
      style={{
        background: 'var(--mantine-color-body)',
        border: '1px solid var(--ui-border)',
        minWidth: 140,
      }}
    >
      <Text size="xs" c="dimmed" mb={2}>
        {formatKoreanDate(label)}
      </Text>
      <Text fw={700} size="sm">
        {count} logs
      </Text>
    </Paper>
  );
}

export function ActivityChart({
  data,
  panelClassName,
}: {
  data: DailyActivity[];
  panelClassName?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const chartData = data.map((d) => ({
    date: d.date.slice(5),
    count: d.count,
  }));

  const theme = useMantineTheme();
  const brandColor = theme.colors.brand[5];

  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(400);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const rootClassName = [panelStyles.sectionPanel, 'activity-chart-panel', panelClassName]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setChartWidth(entry.contentRect.width);
    });
    observer.observe(el);
    setChartWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  if (total === 0) {
    return (
      <Paper withBorder radius="lg" p={{ base: 'md', sm: 'lg' }} className={rootClassName}>
        <Stack gap="xs">
          <Title order={4} className="activity-chart-title">
            Work Activity
          </Title>
          <EmptyState
            icon={<IconChartLine size={24} />}
            title="No work logs in the last 30 days"
            description="Log your work to see activity trends here."
          />
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper withBorder radius="lg" p={{ base: 'md', sm: 'lg' }} className={rootClassName}>
      <Group justify="space-between" align="center" mb="sm">
        <Title order={4} className="activity-chart-title">
          Work Activity
        </Title>
        <Badge variant="light" color="gray" size="sm" radius="sm">
          {total} logs · 30d
        </Badge>
      </Group>
      <div ref={containerRef} className="activity-chart">
        {mounted ? (
          <RechartsAreaChart width={chartWidth} height={200} data={chartData}>
            <defs>
              <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={brandColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={brandColor} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--ui-muted-text)' }}
              interval={4}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: 'var(--ui-muted-text)' }}
              width={32}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ActivityTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              stroke={brandColor}
              strokeWidth={2}
              fill="url(#activityGradient)"
              dot={false}
            />
          </RechartsAreaChart>
        ) : (
          <div style={{ width: chartWidth, height: 200 }} />
        )}
      </div>
    </Paper>
  );
}
