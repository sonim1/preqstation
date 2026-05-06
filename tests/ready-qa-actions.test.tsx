// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('next/image', () => ({
  default: ({
    className,
    src,
    ...props
  }: {
    className?: string;
    src: string;
    [key: string]: unknown;
  }) => <span className={className} data-next-image={src} {...props} />,
}));

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();

  return {
    ...actual,
    Modal: (({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
      <div data-modal-title={title}>{children}</div>
    )) as unknown as typeof actual.Modal,
    Tooltip: (({ children, label }: { children?: React.ReactNode; label?: React.ReactNode }) => (
      <div data-tooltip-label={label}>{children}</div>
    )) as unknown as typeof actual.Tooltip,
  };
});

vi.mock('@/app/components/markdown-viewer', () => ({
  MarkdownViewer: ({
    artifacts,
    markdown,
    mode,
  }: {
    artifacts?: Array<{ title: string }>;
    markdown?: string | null;
    mode?: 'full' | 'body' | 'artifacts';
  }) => (
    <div data-testid={`markdown-viewer:${mode ?? 'full'}`}>
      {markdown}
      {artifacts?.map((artifact) => (
        <span key={artifact.title}>{artifact.title}</span>
      ))}
    </div>
  ),
}));

vi.mock('@/app/components/infinite-scroll-trigger', () => ({
  InfiniteScrollTrigger: ({
    active,
    hasMore,
    resetKey,
  }: {
    active?: boolean;
    hasMore?: boolean;
    resetKey?: string;
  }) =>
    hasMore ? (
      <div
        data-infinite-scroll-trigger="true"
        data-active={active ? 'true' : 'false'}
        data-reset-key={resetKey}
      />
    ) : null,
}));

import { MantineProvider } from '@mantine/core';

import {
  buildQaRunCopyText,
  formatReadyQaScopeLabel,
  getNextVisibleQaRunCount,
  getVisibleQaRuns,
  hasMoreQaRuns,
  INITIAL_VISIBLE_QA_RUNS,
  ReadyQaActions,
} from '@/app/components/ready-qa-actions';
import { QA_DISPATCH_PREFERENCE_STORAGE } from '@/lib/dispatch-preferences';
import { KITCHEN_TERMINOLOGY } from '@/lib/terminology';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const originalLocalStorage = globalThis.window?.localStorage;
const originalFetch = globalThis.fetch;

describe('app/components/ready-qa-actions', () => {
  let localStorage: MemoryStorage;

  beforeEach(() => {
    localStorage = new MemoryStorage();
    Object.defineProperty(globalThis.window, 'localStorage', {
      configurable: true,
      value: localStorage,
    });
    Object.defineProperty(globalThis.window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(globalThis.window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: originalFetch,
    });
  });

  const ReadyQaActionsAny = ReadyQaActions as unknown as (props: {
    projectId: string;
    projectKey: string;
    projectName?: string;
    branchName: string;
    readyCount: number;
    readyTasks?: Array<{ taskKey: string; title: string }>;
    telegramEnabled: boolean;
    hermesTelegramEnabled?: boolean;
    defaultEngine?: string | null;
    initialRuns: Array<{
      id: string;
      projectId: string;
      branchName: string;
      status: 'failed';
      engine: 'codex';
      targetUrl: string;
      taskKeys: string[];
      summary: { total: number; critical: number; high: number; medium: number; low: number };
      reportMarkdown: string | null;
      artifacts?: Array<{
        type: 'image' | 'video' | 'document' | 'link';
        title: string;
        url?: string | null;
      }>;
      createdAt: string;
      startedAt: string;
      finishedAt: string;
    }>;
  }) => React.ReactElement;

  function createRun(id: number) {
    return {
      id: `run-${id}`,
      projectId: 'project-1',
      branchName: 'main',
      status: 'failed' as const,
      engine: 'codex' as const,
      targetUrl: 'http://127.0.0.1:3000',
      taskKeys: [`PROJ-${id}`],
      summary: { total: 1, critical: 0, high: 1, medium: 0, low: 0 },
      reportMarkdown: '# QA Report',
      artifacts: [],
      createdAt: `2026-03-${String(id).padStart(2, '0')}T10:00:00.000Z`,
      startedAt: `2026-03-${String(id).padStart(2, '0')}T10:01:00.000Z`,
      finishedAt: `2026-03-${String(id).padStart(2, '0')}T10:03:00.000Z`,
    };
  }

  const readyTasks = [
    { taskKey: 'PROJ-1', title: 'One' },
    { taskKey: 'PROJ-2', title: 'Two' },
  ];

  it('returns the report markdown as the QA run copy text', () => {
    expect(
      buildQaRunCopyText({
        ...createRun(1),
        reportMarkdown: '# QA Report\n\n- Repro step',
      }),
    ).toBe('# QA Report\n\n- Repro step');
  });

  it('renders artifact cards before the QA report body when artifact lines are present', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ReadyQaActionsAny
          projectId="project-1"
          projectKey="ALPHA"
          projectName="Project One"
          branchName="release/mobile"
          readyCount={1}
          telegramEnabled
          initialRuns={[
            {
              id: 'run-321',
              projectId: 'project-1',
              branchName: 'release/mobile',
              status: 'failed',
              engine: 'codex',
              targetUrl: 'http://127.0.0.1:3000',
              taskKeys: ['QA-1'],
              summary: { total: 1, critical: 0, high: 1, medium: 0, low: 0 },
              reportMarkdown: [
                '# QA Report',
                '',
                'Artifacts:',
                '- [image] Inbox screenshot | provider=fastio | access=private | url=https://fast.io/s/abc',
              ].join('\n'),
              createdAt: '2026-03-18T10:00:00.000Z',
              startedAt: '2026-03-18T10:01:00.000Z',
              finishedAt: '2026-03-18T10:03:00.000Z',
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-testid="markdown-viewer:artifacts"');
    expect(html).toContain('data-testid="markdown-viewer:body"');
    expect(html.indexOf('data-testid="markdown-viewer:artifacts"')).toBeLessThan(
      html.indexOf('data-testid="markdown-viewer:body"'),
    );
  });

  it('passes structured QA artifacts to the artifact viewer without requiring markdown lines', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ReadyQaActionsAny
          projectId="project-1"
          projectKey="ALPHA"
          projectName="Project One"
          branchName="release/mobile"
          readyCount={1}
          telegramEnabled
          initialRuns={[
            {
              id: 'run-321',
              projectId: 'project-1',
              branchName: 'release/mobile',
              status: 'failed',
              engine: 'codex',
              targetUrl: 'http://127.0.0.1:3000',
              taskKeys: ['QA-1'],
              summary: { total: 1, critical: 0, high: 1, medium: 0, low: 0 },
              reportMarkdown: '# QA Report',
              artifacts: [
                {
                  type: 'image',
                  title: 'QA screenshot',
                  url: 'https://fast.io/s/qa',
                },
              ],
              createdAt: '2026-03-18T10:00:00.000Z',
              startedAt: '2026-03-18T10:01:00.000Z',
              finishedAt: '2026-03-18T10:03:00.000Z',
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(html).toContain('QA screenshot');
    expect(html).toContain('data-testid="markdown-viewer:artifacts"');
  });

  it('renders a direct QA trigger and scoped modal copy for the action island', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ReadyQaActionsAny
          projectId="project-1"
          projectKey="ALPHA"
          projectName="Project One"
          branchName="release/mobile"
          readyCount={2}
          telegramEnabled
          initialRuns={[
            {
              id: 'run-123',
              projectId: 'project-1',
              branchName: 'release/mobile',
              status: 'failed',
              engine: 'codex',
              targetUrl: 'http://127.0.0.1:3000',
              taskKeys: ['QA-1', 'QA-2'],
              summary: { total: 2, critical: 0, high: 1, medium: 1, low: 0 },
              reportMarkdown: '# QA Report',
              artifacts: [],
              createdAt: '2026-03-18T10:00:00.000Z',
              startedAt: '2026-03-18T10:01:00.000Z',
              finishedAt: '2026-03-18T10:03:00.000Z',
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(html).toContain('aria-label="Open QA runs"');
    expect(html).toContain('data-tooltip-label="QA"');
    expect(html).toContain('Queue QA');
    expect(html).toContain('QA Runs');
    expect(html).toContain('current Ready tasks');
    expect(html).toContain('Project One');
    expect(html).toContain('ALPHA');
    expect(html).toContain('release/mobile');
    expect(html).toContain('data-tooltip-label="Choose engine, then press play to queue QA."');
    expect(html).toContain('task-dispatch-engine-segments');
    expect(html).toContain('task-dispatch-target-segments');
    expect(html).toContain('task-dispatch-prompt-shell');
    expect(html).toContain('Selected engine: Claude');
    expect(html).toContain('Selected target: 🦞 Telegram');
    expect(html).toContain('Queue QA');
    expect(html).toContain('aria-label="Copy dispatch prompt"');
    expect(html).toContain(
      'Queue QA to generate an executable dispatch prompt for the current ready tasks.',
    );
    expect(html).not.toContain('QA Engine');
    expect(html).not.toContain('data-menu');
    expect(html).not.toContain('openclaw-action-trigger');
    expect(html).toContain('2026-03-18 10:00');
    expect(html).toContain('aria-label="Copy QA report for run-123"');
    expect(html).toContain('data-tooltip-label="Copy report"');
    expect(formatReadyQaScopeLabel(2, KITCHEN_TERMINOLOGY)).toBe('2 ready tickets');
  });

  it('renders ready tasks with select all and clear all controls', () => {
    render(
      <MantineProvider>
        <ReadyQaActionsAny
          projectId="project-1"
          projectKey="ALPHA"
          projectName="Project One"
          branchName="release/mobile"
          readyCount={2}
          readyTasks={readyTasks}
          telegramEnabled
          initialRuns={[]}
        />
      </MantineProvider>,
    );

    expect((screen.getByLabelText('Include PROJ-1 in QA') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Include PROJ-2 in QA') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('One')).toBeTruthy();
    expect(screen.getByText('Two')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all ready tasks' }));

    expect((screen.getByLabelText('Include PROJ-1 in QA') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Include PROJ-2 in QA') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByText('Queue QA').closest('button') as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select all ready tasks' }));

    expect((screen.getByLabelText('Include PROJ-1 in QA') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Include PROJ-2 in QA') as HTMLInputElement).checked).toBe(true);
  });

  it('posts only the selected ready task keys when queueing QA', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ok: true,
        run: {
          ...createRun(1),
          id: 'run-456',
          status: 'queued',
          taskKeys: ['PROJ-1'],
          reportMarkdown: null,
          startedAt: null,
          finishedAt: null,
        },
      }),
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetchMock,
    });

    render(
      <MantineProvider>
        <ReadyQaActionsAny
          projectId="project-1"
          projectKey="ALPHA"
          projectName="Project One"
          branchName="release/mobile"
          readyCount={2}
          readyTasks={readyTasks}
          telegramEnabled
          initialRuns={[]}
        />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByLabelText('Include PROJ-2 in QA'));
    fireEvent.click(screen.getByText('Queue QA'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      engine: 'claude-code',
      dispatchTarget: 'telegram',
      taskKeys: ['PROJ-1'],
    });
  });

  it('shows only Telegram QA targets when both transports are available', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ReadyQaActionsAny
          projectId="project-1"
          projectKey="ALPHA"
          projectName="Project One"
          branchName="release/mobile"
          readyCount={2}
          telegramEnabled
          hermesTelegramEnabled
          initialRuns={[]}
        />
      </MantineProvider>,
    );

    expect(html).toContain('H Telegram');
    expect(html).toContain('🦞 Telegram');
    expect(html).not.toContain('Channels');
  });

  it('prefers the stored QA engine over the incoming default engine', () => {
    localStorage.setItem(QA_DISPATCH_PREFERENCE_STORAGE, '"gemini-cli"');
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ReadyQaActionsAny
          projectId="project-1"
          projectKey="ALPHA"
          projectName="Project One"
          branchName="release/mobile"
          readyCount={2}
          telegramEnabled
          defaultEngine="claude-code"
          initialRuns={[]}
        />
      </MantineProvider>,
    );

    expect(html).toContain('Selected engine: Gemini');
  });

  it('omits the copy control when the QA run has no uploaded report', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ReadyQaActionsAny
          projectId="project-1"
          projectKey="ALPHA"
          projectName="Project One"
          branchName="release/mobile"
          readyCount={2}
          telegramEnabled
          initialRuns={[
            {
              ...createRun(1),
              reportMarkdown: null,
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(html).not.toContain('Copy QA report');
    expect(html).toContain('Report not uploaded yet. Refresh after the QA run finishes.');
  });

  it('shows only the most recent five runs by default', () => {
    const runs = Array.from({ length: 8 }, (_, index) => createRun(index + 1));

    expect(getVisibleQaRuns(runs, INITIAL_VISIBLE_QA_RUNS)).toEqual(runs.slice(0, 5));
  });

  it('increases the visible run count in steps of five and caps at the total', () => {
    expect(getNextVisibleQaRunCount(INITIAL_VISIBLE_QA_RUNS, 12)).toBe(10);
    expect(getNextVisibleQaRunCount(10, 12)).toBe(12);
  });

  it('shows the load more control only when hidden runs remain', () => {
    expect(hasMoreQaRuns(6, INITIAL_VISIBLE_QA_RUNS)).toBe(true);
    expect(hasMoreQaRuns(5, INITIAL_VISIBLE_QA_RUNS)).toBe(false);
  });

  it('renders the shared infinite scroll trigger when additional QA runs are hidden', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ReadyQaActionsAny
          projectId="project-1"
          projectKey="ALPHA"
          projectName="Project One"
          branchName="release/mobile"
          readyCount={2}
          telegramEnabled
          initialRuns={Array.from({ length: 6 }, (_, index) => createRun(index + 1))}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-infinite-scroll-trigger="true"');
    expect(html).toContain('data-active="false"');
    expect(html).toContain('data-reset-key="5"');
  });
});
