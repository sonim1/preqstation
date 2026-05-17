/** @vitest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockBarDatum = {
  id?: string;
  name: string;
  value: number;
  [key: string]: unknown;
};

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
    data: MockBarDatum[];
    barsLabel?: string;
    valueLabel?: string;
    valueFormatter?: (value: number) => string;
    getBarProps?: (barData: MockBarDatum) => React.ComponentProps<'div'>;
    renderBar?: (barData: MockBarDatum, defaultBar: React.ReactNode) => React.ReactNode;
    autoContrast?: boolean;
    minBarSize?: number | string;
    variant?: string;
  }) =>
    React.createElement(
      'div',
      {
        'data-testid': 'mantine-bars-list',
        'data-bars-label': barsLabel ?? '',
        'data-value-label': valueLabel ?? '',
        'data-auto-contrast': String(autoContrast),
        'data-min-bar-size': String(minBarSize ?? ''),
        'data-variant': variant ?? '',
      },
      data.map((item) => {
        const key = item.id ?? item.name;
        const barProps = getBarProps ? getBarProps(item) : {};
        const formattedValue = valueFormatter ? valueFormatter(item.value) : String(item.value);
        const defaultBar = React.createElement(
          'div',
          {
            'data-default-bar': key,
            'data-default-bar-value': String(item.value),
            'data-default-bar-formatted-value': formattedValue,
            ...barProps,
          },
          item.name,
          formattedValue,
        );

        return React.createElement(
          'div',
          { key, 'data-bars-list-row': key },
          renderBar ? renderBar(item, defaultBar) : defaultBar,
        );
      }),
    ),
}));

vi.mock('recharts', () => ({
  AreaChart: ({
    children,
    data,
    height,
    width,
  }: {
    children?: React.ReactNode;
    data?: unknown[];
    height?: number;
    width?: number;
  }) =>
    React.createElement(
      'svg',
      {
        'data-testid': 'recharts-area-chart',
        'data-points': String(data?.length ?? 0),
        height,
        width,
      },
      children,
    ),
  Area: ({
    dataKey,
    fill,
    fillOpacity,
    stroke,
    strokeWidth,
  }: {
    dataKey?: string;
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    strokeWidth?: number;
  }) =>
    React.createElement('path', {
      'data-testid': 'activity-area',
      'data-key': dataKey,
      fill,
      fillOpacity,
      stroke,
      strokeWidth,
    }),
  CartesianGrid: ({ stroke, strokeDasharray }: { stroke?: string; strokeDasharray?: string }) =>
    React.createElement('g', {
      'data-testid': 'activity-grid',
      stroke,
      strokeDasharray,
    }),
  Tooltip: () => React.createElement('g', { 'data-testid': 'activity-tooltip' }),
  XAxis: ({ tick }: { tick?: { fill?: string } }) =>
    React.createElement('g', {
      'data-testid': 'activity-x-axis',
      'data-tick-fill': tick?.fill ?? '',
    }),
  YAxis: ({ tick }: { tick?: { fill?: string } }) =>
    React.createElement('g', {
      'data-testid': 'activity-y-axis',
      'data-tick-fill': tick?.fill ?? '',
    }),
}));

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();

  return {
    ...actual,
    Tooltip: (({ children, label }: { children?: React.ReactNode; label?: React.ReactNode }) =>
      React.createElement(
        'div',
        { 'data-tooltip-label': typeof label === 'string' ? label : '' },
        children,
      )) as unknown as typeof actual.Tooltip,
  };
});

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href, ...props }, children),
}));

import { ActivityChart } from '@/app/components/activity-chart';
import { DashboardActivityFlowBarsList } from '@/app/components/dashboard-activity-flow-bars-list';
import type { DashboardPortfolioOverviewData } from '@/app/components/dashboard-portfolio-overview';
import { DashboardServicePaceSparkline } from '@/app/components/dashboard-service-pace-sparkline';
import { TaskDistributionChart } from '@/app/components/task-distribution-chart';
import { TerminologyProvider } from '@/app/components/terminology-provider';
import { DEFAULT_TERMINOLOGY } from '@/lib/terminology';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const heatmapCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/dashboard-yearly-heatmap.module.css'),
  'utf8',
);
const metricsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/metrics.module.css'),
  'utf8',
);

const activityProjects = [
  {
    id: 'project-risk',
    projectKey: 'RISK',
    name: 'Risk Project',
    status: 'active',
    bucket: 'risk',
    ageLabel: '2d',
    pills: ['hold 2'],
    activity: [
      { date: '2026-03-28', count: 2 },
      { date: '2026-03-29', count: 2 },
      { date: '2026-03-30', count: 3 },
      { date: '2026-03-31', count: 3 },
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
      { date: '2026-03-30', count: 1 },
      { date: '2026-03-31', count: 0 },
    ],
  },
] satisfies DashboardPortfolioOverviewData['activityStrips'];

function injectStyles(...cssSources: string[]) {
  const style = document.createElement('style');
  style.textContent = cssSources.join('\n');
  document.head.append(style);
}

function renderWithMantine(element: React.ReactElement) {
  return render(React.createElement(MantineProvider, null, element));
}

beforeEach(() => {
  const matchMedia: Window['matchMedia'] = (query) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }) as MediaQueryList;

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
  document.documentElement.removeAttribute('data-mantine-color-scheme');
  vi.unstubAllGlobals();
});

describe('dashboard semantic token contract', () => {
  it('exposes dashboard seam, chart, workflow, workload, and on-token variables as computed root styles', () => {
    injectStyles(globalsCss);

    const rootStyle = window.getComputedStyle(document.documentElement);

    for (const token of [
      '--ui-dashboard-seam',
      '--ui-dashboard-seam-fade',
      '--ui-dashboard-chart-primary',
      '--ui-dashboard-chart-primary-soft',
      '--ui-dashboard-chart-grid',
      '--ui-dashboard-chart-tooltip',
      '--ui-workflow-inbox',
      '--ui-workflow-todo',
      '--ui-workflow-hold',
      '--ui-workflow-ready',
      '--ui-workflow-done',
      '--ui-on-workflow-ready',
      '--ui-workload-level-0',
      '--ui-workload-level-1',
      '--ui-workload-level-2',
      '--ui-workload-level-3',
      '--ui-workload-level-4',
      '--ui-on-workload-level-0',
      '--ui-on-workload-level-1',
      '--ui-on-workload-level-2',
      '--ui-on-workload-level-3',
      '--ui-on-workload-level-4',
    ]) {
      expect(rootStyle.getPropertyValue(token).trim(), token).not.toBe('');
    }
  });

  it('renders the activity chart gradient from the solid chart token and SVG opacity stops', () => {
    const { container } = renderWithMantine(
      React.createElement(ActivityChart, {
        data: [
          { date: '2026-05-01', count: 1 },
          { date: '2026-05-02', count: 3 },
        ],
      }),
    );
    const gradientStops = container.querySelectorAll('#activityGradient stop');

    expect(screen.getByTestId('activity-grid').getAttribute('stroke')).toBe(
      'var(--ui-dashboard-chart-grid)',
    );
    expect(screen.getByTestId('activity-area').getAttribute('stroke')).toBe(
      'var(--ui-dashboard-chart-primary)',
    );
    expect(gradientStops).toHaveLength(2);
    expect(gradientStops[0].getAttribute('stop-color')).toBe('var(--ui-dashboard-chart-primary)');
    expect(gradientStops[0].getAttribute('stop-opacity')).toBe('0.3');
    expect(gradientStops[1].getAttribute('stop-color')).toBe('var(--ui-dashboard-chart-primary)');
    expect(gradientStops[1].getAttribute('stop-opacity')).toBe('0.05');
  });

  it('renders activity bar fills with matching background and on-token foreground colors', () => {
    const { container } = renderWithMantine(
      React.createElement(DashboardActivityFlowBarsList, { projects: activityProjects }),
    );
    const riskBar = container.querySelector<HTMLElement>(
      '[data-activity-project-id="project-risk"] [data-activity-bar-width]',
    );
    const readyBar = container.querySelector<HTMLElement>(
      '[data-activity-project-id="project-ready"] [data-activity-bar-width]',
    );

    expect(riskBar?.getAttribute('style')).toContain(
      'background-color: var(--ui-workload-level-4)',
    );
    expect(riskBar?.getAttribute('style')).toContain('color: var(--ui-on-workload-level-4)');
    expect(readyBar?.getAttribute('style')).toContain(
      'background-color: var(--ui-workload-level-3)',
    );
    expect(readyBar?.getAttribute('style')).toContain('color: var(--ui-on-workload-level-3)');
    expect(screen.getByTestId('mantine-bars-list').getAttribute('data-auto-contrast')).toBe('true');
  });

  it('renders workflow and service-pace chart primitives with dashboard semantic tokens', () => {
    renderWithMantine(
      React.createElement(
        TerminologyProvider,
        { terminology: DEFAULT_TERMINOLOGY } as React.ComponentProps<typeof TerminologyProvider>,
        React.createElement(TaskDistributionChart, {
          inbox: 5,
          todo: 4,
          hold: 2,
          ready: 1,
          done: 1,
        }),
      ),
    );

    expect(
      document
        .querySelector<HTMLElement>('[data-workflow-status-bar="ready"]')
        ?.getAttribute('style'),
    ).toContain('background: var(--ui-workflow-ready)');

    cleanup();

    renderWithMantine(
      React.createElement(DashboardServicePaceSparkline, {
        data: [
          { date: '2026-05-01', count: 1 },
          { date: '2026-05-02', count: 3 },
        ],
      }),
    );

    expect(screen.getByTestId('activity-area').getAttribute('stroke')).toBe(
      'var(--ui-dashboard-chart-primary)',
    );
  });

  it('computes heatmap and metric module styles from semantic dashboard tokens', () => {
    injectStyles(globalsCss, heatmapCss, metricsCss);
    document.body.innerHTML = [
      '<div data-testid="metric" class="metricTile"></div>',
      '<div data-testid="heat-0" class="cell" data-level="0"></div>',
      '<div data-testid="heat-1" class="cell" data-level="1"></div>',
      '<div data-testid="heat-2" class="cell" data-level="2"></div>',
      '<div data-testid="heat-3" class="cell" data-level="3"></div>',
      '<div data-testid="heat-4" class="cell" data-level="4"></div>',
    ].join('');

    const metricStyle = window.getComputedStyle(screen.getByTestId('metric'));

    expect(metricStyle.background).toBe('var(--ui-card-bg)');
    expect(metricStyle.boxShadow).toBe('var(--ui-workspace-control-inset)');

    for (const level of [0, 1, 2, 3, 4]) {
      expect(window.getComputedStyle(screen.getByTestId(`heat-${level}`)).background).toBe(
        `var(--ui-workload-level-${level})`,
      );
    }
  });
});
