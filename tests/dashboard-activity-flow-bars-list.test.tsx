import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mantine/charts', () => ({
  BarsList: ({
    data,
    barsLabel,
    valueLabel,
    valueFormatter,
    getBarProps,
    renderBar,
    autoContrast,
    minBarSize,
    variant,
  }: {
    data: Array<{ id?: string; name: string; value: number }>;
    barsLabel?: string;
    valueLabel?: string;
    valueFormatter?: (value: number) => string;
    getBarProps?: (barData: {
      id?: string;
      name: string;
      value: number;
    }) => React.ComponentProps<'div'>;
    renderBar?: (
      barData: { id?: string; name: string; value: number },
      defaultBar: React.ReactNode,
    ) => React.ReactNode;
    autoContrast?: boolean;
    minBarSize?: number | string;
    variant?: string;
  }) => (
    <div
      data-testid="mantine-bars-list"
      data-bars-label={barsLabel ?? ''}
      data-value-label={valueLabel ?? ''}
      data-auto-contrast={String(autoContrast)}
      data-min-bar-size={String(minBarSize ?? '')}
      data-variant={variant ?? ''}
    >
      {data.map((item) => {
        const key = item.id ?? item.name;
        const barProps = getBarProps ? getBarProps(item) : {};
        const formattedValue = valueFormatter ? valueFormatter(item.value) : String(item.value);
        const defaultBar = (
          <div
            data-default-bar={key}
            data-default-bar-value={String(item.value)}
            data-default-bar-formatted-value={formattedValue}
            {...barProps}
          >
            {item.name}
            {formattedValue}
          </div>
        );

        return (
          <div key={key} data-bars-list-row={key}>
            {renderBar ? renderBar(item, defaultBar) : defaultBar}
          </div>
        );
      })}
    </div>
  ),
}));

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();

  return {
    ...actual,
    Tooltip: (({
      children,
      label,
      events,
    }: {
      children?: React.ReactNode;
      label?: React.ReactNode;
      events?: { hover?: boolean; focus?: boolean; touch?: boolean };
    }) => (
      <div
        data-tooltip-label={typeof label === 'string' ? label : ''}
        data-tooltip-hover={String(events?.hover)}
        data-tooltip-focus={String(events?.focus)}
        data-tooltip-touch={String(events?.touch)}
      >
        {children}
      </div>
    )) as unknown as typeof actual.Tooltip,
  };
});

import { DashboardActivityFlowBarsList } from '@/app/components/dashboard-activity-flow-bars-list';
import type { DashboardPortfolioOverviewData } from '@/app/components/dashboard-portfolio-overview';

const source = fs.readFileSync(
  path.join(process.cwd(), 'app/components/dashboard-activity-flow-bars-list.tsx'),
  'utf8',
);

const sampleProjects = [
  {
    id: 'project-risk',
    projectKey: 'RISK',
    name: 'Risk Project',
    status: 'active',
    bucket: 'risk',
    ageLabel: '2d',
    pills: ['hold 2'],
    activity: [
      { date: '2026-03-28', count: 0 },
      { date: '2026-03-29', count: 1 },
      { date: '2026-03-30', count: 2 },
      { date: '2026-03-31', count: 2 },
      { date: '2026-04-01', count: 0 },
      { date: '2026-04-02', count: 0 },
      { date: '2026-04-03', count: 0 },
    ],
  },
  {
    id: 'project-ready',
    projectKey: 'READY',
    name: 'Ready Project',
    status: 'active',
    bucket: 'moving',
    ageLabel: '3h',
    pills: ['ready 4', 'deploy'],
    activity: [
      { date: '2026-03-28', count: 0 },
      { date: '2026-03-29', count: 1 },
      { date: '2026-03-30', count: 2 },
      { date: '2026-03-31', count: 3 },
      { date: '2026-04-01', count: 2 },
      { date: '2026-04-02', count: 3 },
      { date: '2026-04-03', count: 3 },
    ],
  },
] satisfies DashboardPortfolioOverviewData['activityStrips'];

function renderBarsList() {
  return renderToStaticMarkup(
    <MantineProvider>
      <DashboardActivityFlowBarsList projects={sampleProjects} />
    </MantineProvider>,
  );
}

describe('app/components/dashboard-activity-flow-bars-list', () => {
  it('uses Mantine BarsList instead of a local bars-list shim', () => {
    expect(source).toMatch(/import \{[^}]*BarsList[^}]*\} from '@mantine\/charts';/);
    expect(source).not.toContain('function LocalBarsList');
    expect(source).not.toContain('type LocalBarsListProps');
  });

  it('keeps the project title visible even when the bar fill is shorter than the label', () => {
    const html = renderBarsList();

    expect(html).toContain('data-activity-bars-list="true"');
    expect(html).toContain('data-bars-label="Project"');
    expect(html).toContain('data-value-label="Logs"');
    expect(html).toContain('data-auto-contrast="true"');
    expect(html).toContain('data-min-bar-size="112"');
    expect(html).toContain('data-variant="filled"');
    expect(html).toContain('data-activity-project-id="project-risk"');
    expect(html).toContain('data-activity-bar-title="Risk Project"');
    expect(html).toContain('data-activity-label-position="outside"');
    expect(html).toContain('data-activity-bar-label="Risk Project"');
    expect(html).toContain('data-activity-bar-width="36"');
    expect(html).toContain('data-activity-label-position="inside"');
    expect(html).toContain('data-tooltip-label="RISK · 5 logs · 2d ago · hold 2"');
    expect(html).toContain('data-tooltip-hover="true"');
    expect(html).toContain('data-tooltip-focus="true"');
    expect(html).toContain('data-tooltip-touch="false"');
  });
});
