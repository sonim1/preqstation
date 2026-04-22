import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/components/work-log-timeline', () => ({
  WorkLogTimeline: ({ logs, variant }: { logs: Array<{ id: string }>; variant?: string }) => (
    <div data-log-count={logs.length} data-slot="work-log-timeline" data-variant={variant} />
  ),
}));

vi.mock('@/app/components/infinite-scroll-trigger', () => ({
  InfiniteScrollTrigger: ({
    hasMore,
    loading,
    resetKey,
    showManualFallback,
  }: {
    hasMore?: boolean;
    loading?: boolean;
    resetKey?: string;
    showManualFallback?: boolean;
  }) =>
    hasMore ? (
      <div
        data-infinite-scroll-trigger="true"
        data-loading={loading ? 'true' : 'false'}
        data-reset-key={resetKey}
        data-manual-fallback={showManualFallback ? 'true' : 'false'}
      />
    ) : null,
}));

import { ProjectWorkLogTimeline } from '@/app/components/project-work-log-timeline';

const sampleLog = {
  id: 'log-1',
  title: 'Investigated paging issue',
  detail: null,
  engine: 'codex',
  workedAt: new Date('2026-03-12T00:00:00.000Z'),
};

describe('app/components/project-work-log-timeline', () => {
  it('renders an infinite scroll trigger when another page is available', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ProjectWorkLogTimeline
          projectId="project-1"
          initialLogs={[sampleLog]}
          initialNextOffset={10}
          emptyText="No work logs."
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-slot="work-log-timeline"');
    expect(html).toContain('data-log-count="1"');
    expect(html).toContain('data-variant="activity"');
    expect(html).toContain('data-infinite-scroll-trigger="true"');
    expect(html).toContain('data-loading="false"');
    expect(html).toContain('data-reset-key="10"');
    expect(html).toContain('data-manual-fallback="false"');
  });

  it('omits the infinite scroll trigger when no next page is available', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ProjectWorkLogTimeline
          projectId="project-1"
          initialLogs={[sampleLog]}
          initialNextOffset={null}
          emptyText="No work logs."
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-variant="activity"');
    expect(html).not.toContain('data-infinite-scroll-trigger="true"');
  });
});
