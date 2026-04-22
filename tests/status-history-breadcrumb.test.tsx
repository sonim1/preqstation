import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StatusHistoryBreadcrumb } from '@/app/components/status-history-breadcrumb';
import { TerminologyProvider } from '@/app/components/terminology-provider';
import { KITCHEN_TERMINOLOGY } from '@/lib/terminology';

describe('app/components/status-history-breadcrumb', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders Planned for both new and historic todo work-log labels', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T17:20:00.000Z'));

    const newHtml = renderToStaticMarkup(
      <MantineProvider>
        <StatusHistoryBreadcrumb
          currentStatus="ready"
          workLogs={[
            {
              id: 'new-log',
              title: 'PROJ-242 · Planned -> Ready',
              detail: null,
              workedAt: new Date('2026-03-22T17:10:00.000Z'),
              createdAt: new Date('2026-03-22T17:10:00.000Z'),
            },
          ]}
        />
      </MantineProvider>,
    );

    const historicHtml = renderToStaticMarkup(
      <MantineProvider>
        <StatusHistoryBreadcrumb
          currentStatus="ready"
          workLogs={[
            {
              id: 'historic-log',
              title: 'PROJ-242 · Todo -> Ready',
              detail: null,
              workedAt: new Date('2026-03-22T17:10:00.000Z'),
              createdAt: new Date('2026-03-22T17:10:00.000Z'),
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(newHtml).toContain('Planned');
    expect(newHtml).not.toContain('Todo');
    expect(historicHtml).toContain('Planned');
    expect(historicHtml).not.toContain('Todo');
  });

  it('renders kitchen labels while still understanding historic default labels', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T17:20:00.000Z'));

    const html = renderToStaticMarkup(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <StatusHistoryBreadcrumb
            currentStatus="done"
            workLogs={[
              {
                id: 'historic-log',
                title: 'PROJ-242 · Todo -> Ready',
                detail: null,
                workedAt: new Date('2026-03-22T17:10:00.000Z'),
                createdAt: new Date('2026-03-22T17:10:00.000Z'),
              },
              {
                id: 'new-log',
                title: 'PROJ-242 · Pass -> Order Up',
                detail: null,
                workedAt: new Date('2026-03-22T17:15:00.000Z'),
                createdAt: new Date('2026-03-22T17:15:00.000Z'),
              },
            ]}
          />
        </TerminologyProvider>
      </MantineProvider>,
    );

    expect(html).toContain('Pass');
    expect(html).toContain('Order Up');
    expect(html).not.toContain('Ready');
    expect(html).not.toContain('Done');
  });
});
