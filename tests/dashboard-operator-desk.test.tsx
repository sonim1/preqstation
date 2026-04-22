import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mantine/charts', () => ({
  Sparkline: ({
    data,
    h,
    color,
    curveType,
    strokeWidth,
  }: {
    data: number[];
    h?: number | string;
    color?: string;
    curveType?: string;
    strokeWidth?: number;
  }) => (
    <div
      data-testid="mantine-sparkline"
      data-points={String(data.length)}
      data-values={data.join(',')}
      data-height={String(h ?? '')}
      data-color={String(color ?? '')}
      data-curve-type={String(curveType ?? '')}
      data-stroke-width={String(strokeWidth ?? '')}
    />
  ),
  BarsList: ({
    data,
    barsLabel,
    valueLabel,
    valueFormatter,
    getBarProps,
    renderBar,
  }: {
    data: Array<Record<string, unknown>>;
    barsLabel?: string;
    valueLabel?: string;
    valueFormatter?: (value: number) => string;
    getBarProps?: (barData: Record<string, unknown>) => React.ComponentProps<'div'>;
    renderBar?: (barData: Record<string, unknown>, defaultBar: React.ReactNode) => React.ReactNode;
  }) => (
    <div
      data-testid="mantine-bars-list"
      data-bars-label={barsLabel ?? ''}
      data-value-label={valueLabel ?? ''}
    >
      {data.map((item) => {
        const key = String(item.id ?? item.name);
        const numericValue = typeof item.value === 'number' ? item.value : Number(item.value ?? 0);
        const formattedValue = valueFormatter
          ? valueFormatter(numericValue)
          : String(item.value ?? '');
        const barProps = getBarProps ? getBarProps(item) : {};
        const defaultBar = (
          <div
            data-default-bar={key}
            data-default-bar-value={String(item.value ?? '')}
            data-default-bar-formatted-value={formattedValue}
            {...barProps}
          >
            {String(item.name ?? '')}
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

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import {
  getNextVisibleReadyCount,
  getVisibleReadyTodos,
  hasMoreReadyTodos,
  INITIAL_VISIBLE_READY_TODOS,
} from '@/app/components/dashboard-instrument-rail';
import { DashboardOperatorDesk } from '@/app/components/dashboard-operator-desk';
import type { DashboardPortfolioOverviewData } from '@/app/components/dashboard-portfolio-overview';
import { DEFAULT_TERMINOLOGY } from '@/lib/terminology';

const sampleFocusTodos = [
  {
    id: 'todo-focus-1',
    taskKey: 'PM-142',
    title: 'Tighten task handoff wording',
    taskPriority: 'high',
    status: 'todo',
    focusedAt: null,
    project: { name: 'Preq' },
    labels: [],
    engine: 'codex',
    runState: 'running',
    laneRole: 'now' as const,
    runStateUpdatedAt: new Date('2026-04-03T10:00:00.000Z'),
    updatedAt: new Date('2026-04-03T10:00:00.000Z'),
  },
  {
    id: 'todo-queue-1',
    taskKey: 'PM-149',
    title: 'Simplify approval note grouping',
    taskPriority: 'medium',
    status: 'todo',
    focusedAt: null,
    project: { name: 'Portal' },
    labels: [],
    engine: null,
    runState: null,
    laneRole: 'next' as const,
    runStateUpdatedAt: null,
    updatedAt: new Date('2026-04-03T09:30:00.000Z'),
  },
];

const sampleReadyTodos = [
  {
    id: 'todo-ready-1',
    taskKey: 'PM-151',
    title: 'Release drawer hierarchy',
    taskPriority: 'low',
    status: 'ready',
    focusedAt: null,
    project: { name: 'Preq' },
    labels: [],
    engine: null,
    runState: null,
  },
];

const sampleOverflowReadyTodos = [
  ...sampleReadyTodos,
  {
    id: 'todo-ready-2',
    taskKey: 'PM-152',
    title: 'Review pass lane spacing',
    taskPriority: 'medium',
    status: 'ready',
    focusedAt: null,
    project: { name: 'Portal' },
    labels: [],
    engine: null,
    runState: null,
  },
  {
    id: 'todo-ready-3',
    taskKey: 'PM-153',
    title: 'Tighten release copy',
    taskPriority: 'medium',
    status: 'ready',
    focusedAt: null,
    project: { name: 'General' },
    labels: [],
    engine: null,
    runState: null,
  },
  {
    id: 'todo-ready-4',
    taskKey: 'PM-154',
    title: 'Queue follow-up checks',
    taskPriority: 'low',
    status: 'ready',
    focusedAt: null,
    project: { name: 'Preq' },
    labels: [],
    engine: null,
    runState: null,
  },
  {
    id: 'todo-ready-5',
    taskKey: 'PM-155',
    title: 'Verify operator checklist',
    taskPriority: 'low',
    status: 'ready',
    focusedAt: null,
    project: { name: 'General' },
    labels: [],
    engine: null,
    runState: null,
  },
  {
    id: 'todo-ready-6',
    taskKey: 'PM-156',
    title: 'Prep ship note summary',
    taskPriority: 'medium',
    status: 'ready',
    focusedAt: null,
    project: { name: 'Preq' },
    labels: [],
    engine: null,
    runState: null,
  },
];

const samplePortfolioOverview = {
  distribution: {
    moving: 3,
    watch: 2,
    risk: 1,
    quiet: 1,
  },
  summaryCounts: {
    needsAttention: 1,
    readyToPush: 2,
    longQuiet: 1,
  },
  exceptionRows: {
    mostUrgent: {
      id: 'project-risk',
      projectKey: 'RISK',
      name: 'Risk Project',
      holdCount: 2,
      readyCount: 0,
      ageLabel: '2d',
    },
    mostReady: {
      id: 'project-ready',
      projectKey: 'READY',
      name: 'Ready Project',
      holdCount: 0,
      readyCount: 4,
      ageLabel: '3h',
    },
    quietest: {
      id: 'project-quiet',
      projectKey: 'QUIET',
      name: 'Quiet Project',
      holdCount: 0,
      readyCount: 0,
      ageLabel: '9d',
    },
  },
  matrixProjects: [
    {
      id: 'project-risk',
      projectKey: 'RISK',
      name: 'Risk Project',
      bucket: 'risk',
      status: 'active',
      recencyDays: 2,
      openTaskCount: 6,
    },
    {
      id: 'project-ready',
      projectKey: 'READY',
      name: 'Ready Project',
      bucket: 'moving',
      status: 'active',
      recencyDays: 0,
      openTaskCount: 4,
    },
    {
      id: 'project-quiet',
      projectKey: 'QUIET',
      name: 'Quiet Project',
      bucket: 'quiet',
      status: 'paused',
      recencyDays: 9,
      openTaskCount: 0,
    },
  ],
  activityStrips: [
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
  ],
} satisfies DashboardPortfolioOverviewData;

const overlappingPortfolioOverview = {
  ...samplePortfolioOverview,
  matrixProjects: [
    {
      id: 'project-cluster-a',
      projectKey: 'CLA',
      name: 'Cluster A',
      bucket: 'moving',
      status: 'active',
      recencyDays: 4,
      openTaskCount: 3,
    },
    {
      id: 'project-cluster-b',
      projectKey: 'CLB',
      name: 'Cluster B',
      bucket: 'watch',
      status: 'active',
      recencyDays: 4,
      openTaskCount: 3,
    },
  ],
} satisfies DashboardPortfolioOverviewData;

const edgeOverlappingPortfolioOverview = {
  ...samplePortfolioOverview,
  matrixProjects: [
    {
      id: 'project-anchor',
      projectKey: 'ANCH',
      name: 'Anchor Project',
      bucket: 'risk',
      status: 'active',
      recencyDays: 1,
      openTaskCount: 6,
    },
    {
      id: 'project-edge-a',
      projectKey: 'EDA',
      name: 'Edge A',
      bucket: 'moving',
      status: 'active',
      recencyDays: 14,
      openTaskCount: 1,
    },
    {
      id: 'project-edge-b',
      projectKey: 'EDB',
      name: 'Edge B',
      bucket: 'watch',
      status: 'active',
      recencyDays: 14,
      openTaskCount: 1,
    },
  ],
} satisfies DashboardPortfolioOverviewData;

function renderDesk(options?: {
  readyTodos?: typeof sampleReadyTodos;
  readyCount?: number;
  portfolioOverview?: DashboardPortfolioOverviewData;
}) {
  return renderToStaticMarkup(
    <MantineProvider>
      <DashboardOperatorDesk
        portfolioOverview={options?.portfolioOverview ?? samplePortfolioOverview}
        terminology={DEFAULT_TERMINOLOGY}
        actions={<button type="button">Board</button>}
        readyCount={options?.readyCount ?? 1}
        weeklyWorkLogCount={6}
        projectsCount={3}
        repoConnected={2}
        vercelConnected={1}
        focusTodos={sampleFocusTodos}
        readyTodos={options?.readyTodos ?? sampleReadyTodos}
        weeklyActivity={[
          { date: '2026-03-28', count: 0 },
          { date: '2026-03-29', count: 1 },
          { date: '2026-03-30', count: 3 },
          { date: '2026-03-31', count: 2 },
          { date: '2026-04-01', count: 4 },
          { date: '2026-04-02', count: 5 },
          { date: '2026-04-03', count: 2 },
        ]}
        selectedProjectId={undefined}
        toggleTodayFocusAction={vi.fn(async () => {})}
        updateTodoStatusAction={vi.fn(async () => {})}
      />
    </MantineProvider>,
  );
}

describe('app/components/dashboard-operator-desk', () => {
  it('renders the approved operator-desk hierarchy with hybrid kitchen sections and data visuals', () => {
    const html = renderDesk();
    const servicePaceIndex = html.indexOf('Service Pace');
    const priorityMatrixIndex = html.indexOf('Priority Matrix');
    const servicePaceHelpCopy = 'Weekly work-log rhythm without the extra dashboard noise.';
    const servicePaceHelpCopyMatches = html.match(
      /Weekly work-log rhythm without the extra dashboard noise\./g,
    );

    expect(html).toContain('data-dashboard-operator-desk="true"');
    expect(html).not.toContain('Portfolio Overview');
    expect(html).not.toContain('Needs attention');
    expect(html).not.toContain('Ready to push');
    expect(html).not.toContain('Long quiet');
    expect(html).toContain('Priority Matrix');
    expect(html).toContain('Activity Flow');
    expect(servicePaceIndex).toBeGreaterThan(-1);
    expect(priorityMatrixIndex).toBeGreaterThan(-1);
    expect(servicePaceIndex).toBeLessThan(priorityMatrixIndex);
    expect(html).toContain('Fresh');
    expect(html).toContain('Stale');
    expect(html).toContain('Light load');
    expect(html).toContain('Heavy load');
    expect(html).toContain('data-testid="mantine-bars-list"');
    expect(html).toContain('data-bars-label="Project"');
    expect(html).toContain('data-value-label="Logs"');
    expect(html).toContain('data-activity-summary="quiet"');
    expect(html).toContain('data-activity-summary-value="1"');
    expect(html).toContain('data-activity-summary-label="quiet off chart"');
    expect(html).toContain('data-activity-summary="logs"');
    expect(html).toContain('data-activity-summary-value="19"');
    expect(html).toContain('data-activity-summary-label="logs across 7d"');
    expect(html).toContain('data-label-position="right"');
    expect(html).toContain('data-label-position="bottom"');
    expect(html).toContain('data-label-position="top"');
    expect(html).toContain('data-matrix-project-ids="project-risk"');
    expect(html).toContain('data-matrix-summary-list="true"');
    expect(html).toContain('data-matrix-summary-project="project-risk"');
    expect(html).toContain('data-activity-project-id="project-risk"');
    expect(html).toContain('data-activity-bar-title="Risk Project"');
    expect(html).toContain('data-activity-bar-label="Risk Project"');
    expect(html).toContain('data-activity-label-position="outside"');
    expect(html).toContain('data-activity-highlighted="false"');
    expect(html).toContain('data-tooltip-label="RISK · 5 logs · 2d ago · hold 2"');
    expect(html).not.toContain('[data-matrix-project-ids~="project-risk"]:hover');
    expect(html).toContain('Risk Project');
    expect(html).toContain('Ready Project');
    expect(html).toContain('Quiet Project');
    expect(html).toContain('data-dashboard-module="portfolio-overview"');
    expect(html).toContain('data-portfolio-module="triage"');
    expect(html).toContain('data-portfolio-module="priority-matrix"');
    expect(html).toContain('data-portfolio-module="activity-flow"');
    expect(html).toContain(
      'Active projects ranked by seven-day logs. Open a bar to inspect freshness and blockers.',
    );
    expect(html).toContain('aria-label="Activity Flow help"');
    expect(html).not.toContain(
      'Active projects ranked by seven-day logs with freshness and blockers inline.',
    );
    expect(html).not.toContain('data-dashboard-kpi-rail="true"');
    expect(html).toContain('On the Line');
    expect(html).toContain('At the Pass');
    expect(html).toContain('Mise en Place');
    expect(html).toContain('Service Pace');
    expect(html).toContain(`data-tooltip-label="${servicePaceHelpCopy}"`);
    expect(servicePaceHelpCopyMatches).toHaveLength(1);
    expect(html).not.toContain('Attention');
    expect(html).not.toContain('In Focus');
    expect(html).not.toContain('Ready Next');
    expect(html).not.toContain('Active AI agents');
    expect(html).toContain('PM-142');
    expect(html).toContain('PM-149');
    expect(html).toContain('PM-151');
    expect(html).toContain('data-pass-list="true"');
    expect(html).toContain('data-pass-row="PM-151"');
    expect(html).not.toContain('data-infinite-scroll-trigger="true"');
    expect(html).toContain('data-dashboard-module="on-the-line"');
    expect(html).toContain('data-dashboard-module="at-the-pass"');
    expect(html).toContain('data-dashboard-module="mise-en-place"');
    expect(html).toContain('data-dashboard-module="service-pace"');
    expect(html).toContain('data-dashboard-header="on-the-line"');
    expect(html).toContain('data-dashboard-header="at-the-pass"');
    expect(html).toContain('data-order="3">On the Line</h3>');
    expect(html).toContain('data-order="3">At the Pass</h3>');
    expect(html).toContain('data-on-the-line-summary="now"');
    expect(html).toContain('data-on-the-line-summary="next"');
    expect(html).toContain('data-on-the-line-summary-tone="current"');
    expect(html).toContain('data-on-the-line-summary-tone="muted"');
    expect(html).toContain('1 now');
    expect(html).toContain('1 next');
    expect(html).not.toContain('0 now');
    expect(html).not.toContain('2 next');
    expect(html).not.toContain('data-on-the-line-summary="ready"');
    expect(html).toContain('data-rail-summary="ready"');
    expect(html).toContain('data-rail-summary="logs"');
    expect(html).toContain('aria-label="On the Line help"');
    expect(html).toContain('aria-label="At the Pass help"');
    expect(html).toContain('aria-label="Mise en Place help"');
    expect(html).toContain('aria-label="Service Pace help"');
    expect(html).toContain('data-workflow-stepper="PM-142"');
    expect(html).toContain('data-workflow-step="inbox"');
    expect(html).toContain('data-workflow-step="planned"');
    expect(html).toContain('data-workflow-step="hold"');
    expect(html).toContain('data-workflow-step="ready"');
    expect(html).toContain('data-workflow-step="done"');
    expect(html).toContain('data-workflow-step-icon="inbox"');
    expect(html).toContain('data-workflow-step-icon="planned"');
    expect(html).toContain('data-workflow-step-icon="hold"');
    expect(html).toContain('data-workflow-step-icon="ready"');
    expect(html).toContain('data-workflow-step-icon="done"');
    expect(html).toContain('title="Inbox"');
    expect(html).toContain('title="Planned"');
    expect(html).toContain('Hold');
    expect(html).toContain('Ready');
    expect(html).toContain('Done');
    expect(html).toContain('data-weekly-sparkline-frame="true"');
    expect(html).toContain('height:84px');
    expect(html).toContain('data-weekly-sparkline-trigger="2026-03-28"');
    expect(html).toContain('data-weekly-sparkline-trigger="2026-04-03"');
    expect(html).toContain('data-weekly-sparkline-tooltip="true"');
    expect(html).toContain('data-dashboard-module="service-pace"');
    expect(html).toContain('data-rail-summary="logs"');
    expect(html).not.toContain('Complete PM-142');
    expect(html).not.toContain("today's focus");
    expect(html).not.toContain('Edit PM-142');
    expect(html).not.toContain('data-workflow-step="active"');
    expect(html).not.toContain('Weekly brief, live radar.');
    expect(html).not.toContain('Brief + Radar');
    expect(html).not.toContain('Recent Signals');
    expect(html).not.toContain('Workflow Snapshot');
    expect(html).not.toContain('Scope');
    expect(html).not.toContain('Build');
    expect(html).not.toContain('Review');
    expect(html).not.toContain('Ship');
    expect(html).not.toContain('Activity Strips');
    expect(html).not.toContain('7d total');
    expect(html).not.toContain('Active days');
    expect(html).not.toContain('data-activity-chart="stacked-area"');
    expect(html).not.toContain('data-activity-tooltip-trigger="2026-03-31"');
    expect(html).not.toContain('data-activity-day-summary-list="true"');
    expect(html).not.toContain('Peak 5 logs/day');
  });

  it('renders service pace legend in the same order as the weekly activity dates', () => {
    const html = renderDesk();

    expect(html).toContain('data-pace-day="2026-03-28"');
    expect(html).toContain('data-pace-day="2026-03-29"');
    expect(html).toContain('data-pace-day="2026-03-30"');
    expect(html).toContain('data-pace-day="2026-03-31"');
    expect(html).toContain('data-pace-day="2026-04-01"');
    expect(html).toContain('data-pace-day="2026-04-02"');
    expect(html).toContain('data-pace-day="2026-04-03"');
    expect(html).not.toContain('data-pace-day="mon"');

    const saturdayIndex = html.indexOf('data-pace-day="2026-03-28"');
    const sundayIndex = html.indexOf('data-pace-day="2026-03-29"');
    const mondayIndex = html.indexOf('data-pace-day="2026-03-30"');
    const tuesdayIndex = html.indexOf('data-pace-day="2026-03-31"');
    const wednesdayIndex = html.indexOf('data-pace-day="2026-04-01"');
    const thursdayIndex = html.indexOf('data-pace-day="2026-04-02"');
    const fridayIndex = html.indexOf('data-pace-day="2026-04-03"');

    expect(saturdayIndex).toBeLessThan(sundayIndex);
    expect(sundayIndex).toBeLessThan(mondayIndex);
    expect(mondayIndex).toBeLessThan(tuesdayIndex);
    expect(tuesdayIndex).toBeLessThan(wednesdayIndex);
    expect(wednesdayIndex).toBeLessThan(thursdayIndex);
    expect(thursdayIndex).toBeLessThan(fridayIndex);
  });

  it('renders at the pass as a vertical list with a load more button when ready work exceeds the initial slice', () => {
    const html = renderDesk({
      readyTodos: sampleOverflowReadyTodos,
      readyCount: 6,
    });

    expect(html).toContain('data-pass-list="true"');
    expect(html).toContain('data-pass-row="PM-151"');
    expect(html).toContain('data-pass-row="PM-152"');
    expect(html).toContain('data-pass-row="PM-153"');
    expect(html).toContain('data-pass-row="PM-154"');
    expect(html).toContain('data-pass-row="PM-155"');
    expect(html).not.toContain('data-pass-row="PM-156"');
    expect(html).toContain('data-pass-load-more="true"');
    expect(html).toContain('Load more');
    expect(html).not.toContain('data-infinite-scroll-trigger="true"');
  });

  it('pages ready todos in five-item increments', () => {
    expect(getVisibleReadyTodos(sampleOverflowReadyTodos, INITIAL_VISIBLE_READY_TODOS)).toEqual(
      sampleOverflowReadyTodos.slice(0, 5),
    );
    expect(getNextVisibleReadyCount(INITIAL_VISIBLE_READY_TODOS, 12)).toBe(10);
    expect(getNextVisibleReadyCount(10, 12)).toBe(12);
    expect(hasMoreReadyTodos(6, INITIAL_VISIBLE_READY_TODOS)).toBe(true);
    expect(hasMoreReadyTodos(5, INITIAL_VISIBLE_READY_TODOS)).toBe(false);
  });

  it('collapses exact matrix overlaps into one cluster point with a visible count', () => {
    const html = renderDesk({
      portfolioOverview: overlappingPortfolioOverview,
    });

    expect(html).toContain('data-matrix-cluster="true"');
    expect(html).toContain('data-overlap-size="2"');
    expect(html).toContain('data-cluster-projects="CLA,CLB"');
    expect(html).toContain(
      'aria-label="2 overlapping projects: CLA Cluster A 3 open tasks; CLB Cluster B 3 open tasks"',
    );
    expect(html).toContain('title="CLA · Cluster A · 3 open');
    expect(html).toContain('CLB · Cluster B · 3 open"');
    expect(html).not.toContain('aria-label="CLA Cluster A 3 open tasks"');
    expect(html).not.toContain('aria-label="CLB Cluster B 3 open tasks"');
  });

  it('uses the same cluster behavior when the exact overlap sits on the matrix edge', () => {
    const html = renderDesk({
      portfolioOverview: edgeOverlappingPortfolioOverview,
    });

    expect(html).toContain('data-matrix-cluster="true"');
    expect(html).toContain('data-cluster-projects="EDA,EDB"');
    expect(html).toContain(
      'aria-label="2 overlapping projects: EDA Edge A 1 open tasks; EDB Edge B 1 open tasks"',
    );
    expect(html).not.toContain('aria-label="EDA Edge A 1 open tasks"');
    expect(html).not.toContain('aria-label="EDB Edge B 1 open tasks"');
  });
});
