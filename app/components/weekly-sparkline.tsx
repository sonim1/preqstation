'use client';

import { Paper, Text } from '@mantine/core';
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Area, AreaChart as RechartsAreaChart } from 'recharts';

type WeeklyActivity = { date: string; count: number };
type WeeklySparklineTooltipFormatter = (point: WeeklyActivity) => ReactNode;
type WeeklySparklineCurveType =
  | 'bump'
  | 'linear'
  | 'natural'
  | 'monotone'
  | 'step'
  | 'stepBefore'
  | 'stepAfter';

type WeeklySparklineProps = {
  data: WeeklyActivity[];
  h?: number;
  color?: string;
  curveType?: WeeklySparklineCurveType;
  strokeWidth?: number;
  fillOpacity?: number;
  withGradient?: boolean;
  className?: string;
  tooltipLabelFormatter?: WeeklySparklineTooltipFormatter;
  tooltipValueFormatter?: WeeklySparklineTooltipFormatter;
};

const INITIAL_SPARKLINE_WIDTH = 1;

export function getSparklineHoverIndex({
  offsetX,
  width,
  points,
}: {
  offsetX: number;
  width: number;
  points: number;
}) {
  if (points <= 1 || width <= 0) return 0;

  const clampedOffset = Math.min(Math.max(offsetX, 0), width);

  return Math.round((clampedOffset / width) * (points - 1));
}

function getSparklineHoverLeft(index: number, points: number) {
  if (points <= 1) return '0%';

  return `${(index / (points - 1)) * 100}%`;
}

function getSparklineBandBounds(index: number, points: number) {
  if (points <= 1) {
    return { leftPercent: 0, widthPercent: 100 };
  }

  const segmentPercent = 100 / (points - 1);
  const leftPercent = index === 0 ? 0 : index * segmentPercent - segmentPercent / 2;
  const rightPercent = index === points - 1 ? 100 : index * segmentPercent + segmentPercent / 2;

  return {
    leftPercent,
    widthPercent: rightPercent - leftPercent,
  };
}

function formatSparklineAriaLabel(point: WeeklyActivity) {
  return `${point.date}: ${point.count} log${point.count === 1 ? '' : 's'}`;
}

function resolveSparklineColor(color: string) {
  const mantineColor = color.match(/^([a-zA-Z]+)\.(\d+)$/);

  if (mantineColor) {
    return `var(--mantine-color-${mantineColor[1]}-${mantineColor[2]})`;
  }

  if (/^[a-zA-Z]+$/.test(color)) {
    return `var(--mantine-color-${color}-6, ${color})`;
  }

  return color;
}

export function WeeklySparkline({
  data,
  h = 40,
  color = 'green.6',
  curveType = 'monotone',
  strokeWidth = 1.5,
  fillOpacity = 0.4,
  withGradient = true,
  className,
  tooltipLabelFormatter,
  tooltipValueFormatter,
}: WeeklySparklineProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const gradientId = useId().replace(/:/g, '');
  const chartHeight = Math.max(1, Math.round(h));
  const [chartWidth, setChartWidth] = useState(INITIAL_SPARKLINE_WIDTH);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartData = useMemo(
    () => data.map((point, index) => ({ index, value: point.count })),
    [data],
  );
  const strokeColor = resolveSparklineColor(color);
  const tooltipEnabled = Boolean(tooltipLabelFormatter || tooltipValueFormatter) && data.length > 0;
  const hoveredPoint = hoveredIndex === null ? null : (data[hoveredIndex] ?? null);
  const hoverLeft = hoveredIndex === null ? '0%' : getSparklineHoverLeft(hoveredIndex, data.length);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const setMeasuredWidth = (width: number) => {
      setChartWidth(Math.max(INITIAL_SPARKLINE_WIDTH, Math.round(width)));
    };

    setMeasuredWidth(frame.getBoundingClientRect().width);

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setMeasuredWidth(entry?.contentRect.width ?? frame.getBoundingClientRect().width);
    });

    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  const chart = (
    <RechartsAreaChart
      width={chartWidth}
      height={chartHeight}
      data={chartData}
      margin={{ top: strokeWidth, right: 0, bottom: strokeWidth, left: 0 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area
        dataKey="value"
        type={curveType}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill={withGradient ? `url(#${gradientId})` : strokeColor}
        fillOpacity={withGradient ? 1 : fillOpacity}
        activeDot={false}
        dot={false}
        isAnimationActive={false}
      />
    </RechartsAreaChart>
  );

  const frameStyle = {
    position: 'relative',
    width: '100%',
    minWidth: 0,
    height: chartHeight,
  } as const;

  if (!tooltipEnabled) {
    return (
      <div
        ref={frameRef}
        data-weekly-sparkline-frame="true"
        className={className}
        style={frameStyle}
      >
        {chart}
      </div>
    );
  }

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();

    setHoveredIndex(
      getSparklineHoverIndex({
        offsetX: event.clientX - bounds.left,
        width: bounds.width,
        points: data.length,
      }),
    );
  };

  return (
    <div
      ref={frameRef}
      data-weekly-sparkline-frame="true"
      data-weekly-sparkline-tooltip="true"
      className={className}
      style={frameStyle}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {chart}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {data.map((point, index) => {
          const bounds = getSparklineBandBounds(index, data.length);

          return (
            <button
              key={point.date}
              type="button"
              data-weekly-sparkline-trigger={point.date}
              aria-label={formatSparklineAriaLabel(point)}
              onFocus={() => setHoveredIndex(index)}
              onBlur={() => setHoveredIndex(null)}
              onTouchStart={() => setHoveredIndex(index)}
              onClick={() => setHoveredIndex(index)}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${bounds.leftPercent}%`,
                width: `${bounds.widthPercent}%`,
                padding: 0,
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
              }}
            />
          );
        })}
      </div>
      {hoveredPoint ? (
        <div
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: hoverLeft,
              width: 1,
              transform: 'translateX(-0.5px)',
              background:
                'color-mix(in srgb, var(--ui-accent, var(--mantine-color-blue-6)), transparent 55%)',
            }}
          />
          <Paper
            withBorder
            radius="md"
            p="xs"
            style={{
              position: 'absolute',
              left: hoverLeft,
              top: 0,
              transform: 'translate(-50%, calc(-100% - 0.35rem))',
              minWidth: 112,
              background: 'var(--ui-surface-strong, var(--mantine-color-body))',
              border: '1px solid var(--ui-border, var(--mantine-color-gray-3))',
              boxShadow: 'var(--ui-elevation-1)',
              zIndex: 1,
            }}
          >
            {tooltipLabelFormatter ? tooltipLabelFormatter(hoveredPoint) : null}
            {tooltipValueFormatter ? (
              tooltipValueFormatter(hoveredPoint)
            ) : (
              <Text size="sm" fw={700}>
                {hoveredPoint.count}
              </Text>
            )}
          </Paper>
        </div>
      ) : null}
    </div>
  );
}
