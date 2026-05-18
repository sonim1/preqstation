import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StatusHistoryBreadcrumb } from '@/app/components/status-history-breadcrumb';
import { TerminologyProvider } from '@/app/components/terminology-provider';
import { KITCHEN_TERMINOLOGY } from '@/lib/terminology';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');

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
    expect(newHtml).toContain('background-color:var(--ui-accent-soft)');
    expect(historicHtml).toContain('Planned');
    expect(historicHtml).not.toContain('Todo');
    expect(historicHtml).toContain('background-color:var(--ui-accent-soft)');
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

  it('uses semantic tokens for warning and success badge borders', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T17:20:00.000Z'));

    const html = renderToStaticMarkup(
      <MantineProvider>
        <StatusHistoryBreadcrumb
          currentStatus="done"
          workLogs={[
            {
              id: 'ready-log',
              title: 'PROJ-242 · Planned -> Ready',
              detail: null,
              workedAt: new Date('2026-03-22T17:10:00.000Z'),
              createdAt: new Date('2026-03-22T17:10:00.000Z'),
            },
            {
              id: 'done-log',
              title: 'PROJ-242 · Ready -> Done',
              detail: null,
              workedAt: new Date('2026-03-22T17:15:00.000Z'),
              createdAt: new Date('2026-03-22T17:15:00.000Z'),
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(globalsCss).toContain('--ui-status-history-badge-border-mix: 38%;');
    expect(globalsCss).toMatch(
      /--ui-status-history-warning-border:\s*color-mix\([\s\S]*var\(--ui-status-history-badge-border-mix\)/,
    );
    expect(globalsCss).toMatch(
      /--ui-status-history-success-border:\s*color-mix\([\s\S]*var\(--ui-status-history-badge-border-mix\)/,
    );
    expect(html).toContain('border-color:var(--ui-status-history-warning-border)');
    expect(html).toContain('border-color:var(--ui-status-history-success-border)');
    expect(html).not.toContain('var(--ui-border) 38%');
  });
});
