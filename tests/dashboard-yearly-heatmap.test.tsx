import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();

  return {
    ...actual,
    Tooltip: (({ children, label }: { children?: React.ReactNode; label?: React.ReactNode }) => (
      <div data-tooltip-label={label}>{children}</div>
    )) as unknown as typeof actual.Tooltip,
  };
});

import { DashboardYearlyHeatmap } from '@/app/components/dashboard-yearly-heatmap';

function renderHeatmap() {
  return renderToStaticMarkup(
    <MantineProvider>
      <DashboardYearlyHeatmap
        data={[
          { date: '2026-01-01', count: 3 },
          { date: '2026-01-02', count: 0 },
          { date: '2026-01-03', count: 1 },
          { date: '2026-01-04', count: 0 },
          { date: '2026-01-05', count: 6 },
          { date: '2026-01-06', count: 0 },
          { date: '2026-01-07', count: 2 },
          { date: '2026-01-08', count: 0 },
          { date: '2026-01-09', count: 0 },
          { date: '2026-01-10', count: 0 },
        ]}
      />
    </MantineProvider>,
  );
}

function renderHeatmapRange(startDate: string, endDate: string) {
  const data: Array<{ date: string; count: number }> = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor.getTime() <= end.getTime()) {
    data.push({
      date: cursor.toISOString().split('T')[0],
      count: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return renderToStaticMarkup(
    <MantineProvider>
      <DashboardYearlyHeatmap data={data} />
    </MantineProvider>,
  );
}

describe('app/components/dashboard-yearly-heatmap', () => {
  it('renders the yearly activity panel with stable month, weekday, tooltip, and intensity hooks', () => {
    const html = renderHeatmap();

    expect(html).toContain('Current Year Activity');
    expect(html).toContain('2026');
    expect(html).toContain('Jan');
    expect(html).toContain('Mon');
    expect(html).toContain('Wed');
    expect(html).toContain('Fri');
    expect(html).toContain('data-yearly-heatmap="true"');
    expect(html).toContain('data-date="2026-01-01"');
    expect(html).toContain('data-date="2026-01-02"');
    expect(html).toContain('data-count="3"');
    expect(html).toContain('data-count="0"');
    expect(html).toContain('data-level="2"');
    expect(html).toContain('data-level="0"');
    expect(html).toContain('data-tooltip-label="Jan 1, 2026: 3 work logs"');
    expect(html).toContain('data-tooltip-label="Jan 2, 2026: no work logs"');
    expect(html).toContain('aria-label="Jan 1, 2026: 3 work logs"');
    expect(html).toContain('aria-label="Jan 2, 2026: no work logs"');
  });

  it('does not duplicate dates across DST boundaries in the weekly grid', () => {
    const html = renderHeatmapRange('2026-01-01', '2026-03-31');
    const march8Matches = html.match(/data-date="2026-03-08"/g) ?? [];

    expect(march8Matches).toHaveLength(1);
  });
});
