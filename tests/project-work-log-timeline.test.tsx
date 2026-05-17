// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/components/work-log-timeline', () => ({
  WorkLogTimeline: ({ logs, variant }: { logs: Array<{ id: string }>; variant?: string }) => (
    <div data-log-count={logs.length} data-slot="work-log-timeline" data-variant={variant} />
  ),
}));

vi.mock('@/app/components/infinite-scroll-trigger', () => ({
  InfiniteScrollTrigger: ({
    hasMore,
    loading,
    onLoadMore,
    resetKey,
    showManualFallback,
  }: {
    hasMore?: boolean;
    loading?: boolean;
    onLoadMore?: () => void;
    resetKey?: string;
    showManualFallback?: boolean;
  }) =>
    hasMore ? (
      <button
        type="button"
        data-infinite-scroll-trigger="true"
        data-loading={loading ? 'true' : 'false'}
        data-reset-key={resetKey}
        data-manual-fallback={showManualFallback ? 'true' : 'false'}
        onClick={onLoadMore}
      >
        Load trigger
      </button>
    ) : null,
}));

import { ProjectWorkLogTimeline } from '@/app/components/project-work-log-timeline';
import { TerminologyProvider } from '@/app/components/terminology-provider';
import { DEFAULT_TERMINOLOGY } from '@/lib/terminology';

const sampleLog = {
  id: 'log-1',
  title: 'Investigated paging issue',
  detail: null,
  engine: 'codex',
  workedAt: new Date('2026-03-12T00:00:00.000Z'),
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

  it('shows a loading indicator while the next work log page is loading', async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    render(
      <MantineProvider>
        <TerminologyProvider
          terminology={{
            ...DEFAULT_TERMINOLOGY,
            workLogs: { loadingMoreLabel: 'Loading additional history...' },
          }}
        >
          <ProjectWorkLogTimeline
            projectId="project-1"
            initialLogs={[sampleLog]}
            initialNextOffset={10}
            emptyText="No work logs."
          />
        </TerminologyProvider>
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load trigger' }));

    expect(await screen.findByText('Loading additional history...')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Load trigger' }).dataset.loading).toBe('true');

    resolveFetch?.(
      new Response(JSON.stringify({ workLogs: [], nextOffset: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading additional history...')).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/work-logs?projectId=project-1&offset=10&limit=10');
  });
});
