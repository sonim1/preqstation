import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();

  return {
    ...actual,
    Tooltip: (({
      children,
      events,
      label,
    }: {
      children?: React.ReactNode;
      events?: { hover?: boolean; focus?: boolean; touch?: boolean };
      label?: React.ReactNode;
    }) => (
      <div
        data-tooltip-label={label}
        data-tooltip-hover={String(events?.hover)}
        data-tooltip-focus={String(events?.focus)}
        data-tooltip-touch={String(events?.touch)}
      >
        {children}
      </div>
    )) as unknown as typeof actual.Tooltip,
  };
});

import { DashboardBriefRadarHero } from '@/app/components/dashboard-brief-radar-hero';
import { DEFAULT_TERMINOLOGY } from '@/lib/terminology';

function renderHero() {
  return renderToStaticMarkup(
    <MantineProvider>
      <DashboardBriefRadarHero
        dateLabel="Thu, Mar 26"
        actions={<button type="button">Board</button>}
        terminology={DEFAULT_TERMINOLOGY}
        weeklyWorkLogCount={6}
        projectsCount={3}
        repoConnected={2}
        vercelConnected={1}
        todayFocusCount={2}
        focusQueueCount={5}
        holdCount={1}
        readyCount={4}
        aiActiveCount={1}
      />
    </MantineProvider>,
  );
}

describe('app/components/dashboard-brief-radar-hero', () => {
  it('keeps scan-first hero copy while adding always-visible context for the weekly and right-now groups', () => {
    const html = renderHero();

    expect(html).toContain('Weekly brief, live radar.');
    expect(html).toContain('Brief + Radar');
    expect(html).toContain('This Week');
    expect(html).toContain('Right Now');
    expect(html).toContain(
      'Last 7 days of output and how many visible projects already have repo or deploy coverage.',
    );
    expect(html).toContain(
      'Focus is selected for today, queue is the remaining inbox or todo load, plus ready handoffs and active agents.',
    );
    expect(html).toContain('data-dashboard-brief-grid="2-up"');
    expect(html).toContain('data-dashboard-radar-grid="2-up"');
    expect(html).not.toContain(
      'background:linear-gradient(180deg, rgba(229, 236, 246, 0.98), rgba(210, 221, 236, 0.95))',
    );
    expect(html).not.toContain(
      'background:linear-gradient(180deg, rgba(223, 232, 243, 0.98), rgba(206, 218, 233, 0.95))',
    );
    expect(html).not.toContain('background:rgba(220, 230, 243, 0.96)');
    expect(html).not.toContain('background:rgba(228, 236, 246, 0.9)');
    expect(html).not.toContain('color:#162536');
    expect(html).not.toContain('color:#44556a');
    expect(html).not.toContain('color:#46586c');
    expect(html).not.toContain('color:#415165');
    expect(html).not.toContain('color:#203143');
    expect(html).not.toContain('color:#304254');
    expect(html).not.toContain('color:#6a7781');
    expect(html).not.toContain(
      'background:linear-gradient(180deg, rgba(246, 250, 253, 0.97), rgba(232, 240, 248, 0.94))',
    );
    expect(html).not.toContain(
      'background:linear-gradient(180deg, rgba(242, 247, 252, 0.97), rgba(228, 236, 245, 0.94))',
    );
    expect(html).not.toContain('background:rgba(242, 247, 252, 0.96)');
    expect(html).not.toContain('Prototype D / Brief + Radar');
    expect(html).not.toContain('Week framed first. Active pressure below.');
    expect(html).not.toContain('The first layer frames the week.');
  });

  it('renders per-card help text for the metric and signal conditions', () => {
    const html = renderHero();

    expect(html).toContain('data-tooltip-label="Counts work logs from the last 7 days."');
    expect(html).toContain(
      'data-tooltip-label="Shows projects with a connected repo out of all visible projects."',
    );
    expect(html).toContain(
      'data-tooltip-label="Counts inbox or todo tasks that are not already in the focus list for today."',
    );
    expect(html).toContain('data-tooltip-label="Counts tasks currently in Ready."');
    expect(html).toContain('data-tooltip-label="Counts tasks with active AI agents."');
    expect(html).toContain('data-tooltip-hover="true"');
    expect(html).toContain('data-tooltip-focus="true"');
    expect(html).toContain('data-tooltip-touch="false"');
    expect(html).toContain('aria-label="Work Logs help"');
    expect(html).toContain('aria-label="Repos help"');
    expect(html).toContain('aria-label="Today Focus help"');
    expect(html).toContain('aria-label="In Focus help"');
    expect(html).toContain('aria-label="Queue help"');
    expect(html).toContain('aria-label="Ready help"');
    expect(html).toContain('aria-label="AI agents help"');
    expect(html).toMatch(/aria-describedby="work-logs-help-description-[^"]+"/);
    expect(html).toMatch(/aria-describedby="ready-help-description-[^"]+"/);
    expect(html).not.toContain('title="Counts work logs from the last 7 days."');
  });

  it('renders a single scan-first title and short metric labels', () => {
    const html = renderHero();

    expect(html).toContain('Weekly brief, live radar.');
    expect(html).toContain('Brief + Radar');
    expect(html).toContain('Thu, Mar 26');
    expect(html).toContain('Current Exception');
    expect(html).not.toContain('data-dashboard-hero-headline="mobile"');
    expect(html).not.toContain('data-dashboard-hero-headline="desktop"');
    expect(html).not.toContain('data-dashboard-hero-support="mobile"');
    expect(html).not.toContain('data-dashboard-hero-support="desktop"');
    expect(html).not.toContain('data-dashboard-brief-summary="mobile"');
    expect(html).not.toContain('data-dashboard-radar-summary="mobile"');
    expect(html).not.toContain('Frame the week before reacting to the queue.');
    expect(html).not.toContain(
      'Show what needs motion without letting the whole page feel urgent.',
    );
    expect(html).not.toContain('Recent work volume captured by the dashboard data loader.');
    expect(html).not.toContain('Projects already linked to repositories.');
    expect(html).not.toContain('Projects already linked to deployment targets.');
    expect(html).not.toContain('Items already committed to today’s focus list.');
    expect(html).toContain('Repos');
    expect(html).toContain('Deploys');
    expect(html).toContain('Today Focus');
    expect(html).toContain('In Focus');
    expect(html).toContain('Queue');
    expect(html).toContain('Ready');
    expect(html).toContain('AI agents');
    expect(html).toContain('data-dashboard-brief-grid="2-up"');
    expect(html).toContain('data-dashboard-radar-grid="2-up"');
  });
});
