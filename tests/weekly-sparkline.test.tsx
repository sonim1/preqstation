import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('recharts', () => ({
  AreaChart: ({
    data,
    width,
    height,
    children,
  }: {
    data: Array<{ value: number }>;
    width?: number;
    height?: number;
    children?: React.ReactNode;
  }) => (
    <svg
      data-testid="weekly-sparkline-area-chart"
      data-points={String(data.length)}
      data-values={data.map((point) => point.value).join(',')}
      data-width={String(width ?? '')}
      data-height={String(height ?? '')}
    >
      {children}
    </svg>
  ),
  Area: ({
    type,
    stroke,
    strokeWidth,
  }: {
    type?: string;
    stroke?: string;
    strokeWidth?: number;
  }) => (
    <path
      data-testid="weekly-sparkline-area"
      data-curve-type={String(type ?? '')}
      data-stroke={String(stroke ?? '')}
      data-stroke-width={String(strokeWidth ?? '')}
    />
  ),
}));

import { WeeklySparkline } from '@/app/components/weekly-sparkline';

function renderSparkline() {
  return renderToStaticMarkup(
    <MantineProvider>
      <WeeklySparkline
        data={[
          { date: '2026-03-28', count: 0 },
          { date: '2026-03-29', count: 1 },
          { date: '2026-03-30', count: 3 },
          { date: '2026-03-31', count: 2 },
        ]}
      />
    </MantineProvider>,
  );
}

describe('app/components/weekly-sparkline', () => {
  it('renders a fixed-size Recharts sparkline with the weekly counts in order', () => {
    const html = renderSparkline();

    expect(html).toContain('data-weekly-sparkline-frame="true"');
    expect(html).toContain('data-testid="weekly-sparkline-area-chart"');
    expect(html).toContain('data-points="4"');
    expect(html).toContain('data-values="0,1,3,2"');
    expect(html).toContain('data-height="40"');
    expect(html).toContain('data-width="1"');
    expect(html).toContain('data-stroke="var(--mantine-color-green-6)"');
    expect(html).toContain('data-curve-type="monotone"');
    expect(html).toContain('data-stroke-width="1.5"');
  });

  it('exports hover index math that clamps the pointer to the nearest data point', async () => {
    const sparklineModule = await import('@/app/components/weekly-sparkline');

    expect('getSparklineHoverIndex' in sparklineModule).toBe(true);

    if (!('getSparklineHoverIndex' in sparklineModule)) return;

    expect(
      sparklineModule.getSparklineHoverIndex({
        offsetX: -12,
        width: 140,
        points: 7,
      }),
    ).toBe(0);

    expect(
      sparklineModule.getSparklineHoverIndex({
        offsetX: 70,
        width: 140,
        points: 7,
      }),
    ).toBe(3);

    expect(
      sparklineModule.getSparklineHoverIndex({
        offsetX: 200,
        width: 140,
        points: 7,
      }),
    ).toBe(6);
  });

  it('renders an interactive wrapper when tooltip formatters are provided', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        {React.createElement(
          WeeklySparkline as unknown as React.ComponentType<Record<string, unknown>>,
          {
            data: [
              { date: '2026-03-28', count: 0 },
              { date: '2026-03-29', count: 1 },
              { date: '2026-03-30', count: 3 },
              { date: '2026-03-31', count: 2 },
            ],
            tooltipLabelFormatter: (point: { date: string }) => point.date,
            tooltipValueFormatter: (point: { count: number }) => `${point.count} logs`,
          },
        )}
      </MantineProvider>,
    );

    expect(html).toContain('data-weekly-sparkline-tooltip="true"');
    expect(html).toContain('data-weekly-sparkline-trigger="2026-03-28"');
    expect(html).toContain('data-weekly-sparkline-trigger="2026-03-31"');
    expect(html).toContain('aria-label="2026-03-28: 0 logs"');
    expect(html).toContain('aria-label="2026-03-30: 3 logs"');
  });
});
