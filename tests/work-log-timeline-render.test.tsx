import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({
    alt,
    src,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) =>
    React.createElement('img', { alt, src, ...props }),
}));

vi.mock('@/app/components/markdown-viewer', () => ({
  MarkdownViewer: ({ markdown, className }: { markdown?: string | null; className?: string }) => (
    <div data-slot="markdown-viewer" className={className}>
      {markdown}
    </div>
  ),
}));

import { WorkLogTimeline } from '@/app/components/work-log-timeline';

describe('app/components/work-log-timeline ledger variant', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-26T20:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a grouped signal ledger around time, title, and identity badges', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <WorkLogTimeline
          variant="ledger"
          showProjectName
          emptyText="No logs."
          logs={[
            {
              id: 'log-1',
              title: 'PROJ-272 moved to ready',
              detail: 'Contrast pass completed for the dashboard hero.',
              engine: 'codex',
              workedAt: new Date('2026-03-26T19:45:00.000Z'),
              project: { name: 'Preq Station' },
            },
            {
              id: 'log-2',
              title: 'Queued palette review',
              detail: 'Lined up the next surface pass.',
              engine: null,
              workedAt: new Date('2026-03-25T17:10:00.000Z'),
              project: { name: 'Preq Station' },
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-work-log-variant="ledger"');
    expect(html).toContain('Today');
    expect(html).toContain('Yesterday');
    expect(html).toContain('dateTime="2026-03-26T19:45:00.000Z"');
    expect(html).toContain('19:45');
    expect(html).toContain('PROJ-272 moved to ready');
    expect(html).toContain('Preq Station');
    expect(html).toContain('Codex CLI');
    expect(html).not.toContain('Contrast pass completed for the dashboard hero.');
    expect(html).not.toContain('Lined up the next surface pass.');
    expect(html).not.toContain('event');
  });

  it('keeps long ledger titles readable when identity badges are present', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <WorkLogTimeline
          variant="ledger"
          showProjectName
          emptyText="No logs."
          logs={[
            {
              id: 'log-1',
              title:
                'PREQSTATION Plan · UI-11: Dogfood the dashboard text-diet pass on desktop and mobile',
              detail:
                'Scope Run a focused dashboard readability QA pass after the text-diet implementation tasks land.',
              engine: 'codex',
              workedAt: new Date('2026-03-26T19:45:00.000Z'),
              project: { name: 'Preq Station' },
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(html).toContain('PREQSTATION Plan');
    expect(html).toContain('Codex CLI');
    expect(html).toContain('Preq Station');
    expect(html).toContain('overflow-wrap:break-word');
    expect(html).not.toContain('word-break:break-word');
    expect(html).not.toContain(
      'Scope Run a focused dashboard readability QA pass after the text-diet implementation tasks land.',
    );
  });

  it('renders the activity variant as a collapsed icon timeline without initial log details', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <WorkLogTimeline
          variant="activity"
          showProjectName
          emptyText="No logs."
          logs={[
            {
              id: 'log-1',
              title: 'PROJ-272 · Fields Updated (1)',
              detail: 'Change log https://app.triva.com/links/ref/38220-18/',
              engine: null,
              workedAt: new Date('2026-03-26T19:45:00.000Z'),
              project: { name: 'Preq Station' },
            },
            {
              id: 'log-2',
              title: 'PREQSTATION Result · Dogfood the task panel timeline',
              detail: 'Verified the new activity rail.',
              engine: 'codex',
              workedAt: new Date('2026-03-26T18:30:00.000Z'),
              project: { name: 'Preq Station' },
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-work-log-variant="activity"');
    expect(html).toContain('data-work-log-action="fields"');
    expect(html).toContain('data-work-log-action-icon="fields"');
    expect(html).toContain('aria-label="Fields updated"');
    expect(html).toContain('title="Fields updated"');
    expect(html).toContain('data-work-log-action="result"');
    expect(html).toContain('data-work-log-action-icon="result"');
    expect(html).toContain('aria-label="PREQSTATION result"');
    expect(html).toContain('title="PREQSTATION result"');
    expect(html).toContain('dateTime="2026-03-26T19:45:00.000Z"');
    expect(html).toContain('2026-03-26 19:45');
    expect(html).not.toContain('View detail');
    expect(html).not.toContain('Change log https://app.triva.com/links/ref/38220-18/');
    expect(html).not.toContain('Verified the new activity rail.');
    expect(html).toContain('Codex CLI');
    expect(html).toContain('Preq Station');
  });

  it('summarizes task field update titles in the activity variant', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <WorkLogTimeline
          variant="activity"
          emptyText="No logs."
          logs={[
            {
              id: 'log-1',
              title: 'PROJ-272 · Fields Updated (1)',
              detail: [
                '**Task:** PROJ-272 · Fix card copy',
                '',
                '- Labels: `(none)` -> `bug`',
              ].join('\n'),
              engine: null,
              workedAt: new Date('2026-03-26T19:45:00.000Z'),
            },
            {
              id: 'log-2',
              title: 'PROJ-272 · Note Updated',
              detail: '**Previous Note**\n\nOld note',
              engine: null,
              workedAt: new Date('2026-03-26T18:30:00.000Z'),
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(html).toContain('Label added');
    expect(html).toContain('Note updated');
    expect(html).not.toContain('PROJ-272 · Fields Updated (1)');
    expect(html).not.toContain('PROJ-272 · Note Updated');
  });

  it('keeps the activity summary on one row while anchoring the icon column to the top', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <WorkLogTimeline
          variant="activity"
          emptyText="No logs."
          logs={[
            {
              id: 'log-1',
              title: 'PREQSTATION Result · Dogfood the task panel timeline',
              detail: 'Verified the new activity rail.',
              engine: 'codex',
              workedAt: new Date('2026-03-26T18:30:00.000Z'),
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-work-log-inline-engine="codex"');
    expect(html).toContain('width:24px;height:24px');
    expect(html).toContain('min-height:24px');
    expect(html).toContain('align-items:center');
    expect(html).toContain('justify-content:center;min-height:24px;align-items:flex-start');
    expect(html.indexOf('Codex CLI')).toBeLessThan(html.indexOf('2026-03-26 18:30'));
  });

  it('renders note updates as a folded inspector in the activity variant', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <WorkLogTimeline
          variant="activity"
          emptyText="No logs."
          logs={[
            {
              id: 'log-1',
              title: 'PROJ-272 · Note Updated',
              detail: JSON.stringify({
                type: 'task.note_change',
                version: 1,
                taskKey: 'PROJ-272',
                taskTitle: 'Fix card copy',
                previousNote: '## Context\n\nOld note body',
                updatedNote: '## Context\n\nNew note body',
              }),
              engine: null,
              workedAt: new Date('2026-03-26T18:30:00.000Z'),
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(html).not.toContain('View detail');
    expect(html).not.toContain('data-work-log-note-change="true"');
    expect(html).not.toContain('Old note body');
    expect(html).not.toContain('New note body');
    expect(html).not.toContain('task.note_change');
  });

  it('renders exact timestamps in the default accordion variant', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <WorkLogTimeline
          emptyText="No logs."
          logs={[
            {
              id: 'log-1',
              title: 'PROJ-300 reviewed',
              detail: null,
              engine: 'codex',
              workedAt: new Date('2026-03-26T19:45:00.000Z'),
              project: { name: 'Preq Station' },
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(html).toContain('2026-03-26 19:45');
  });
});
