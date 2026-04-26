// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const showErrorNotificationMock = vi.hoisted(() => vi.fn());
const showSuccessNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@tabler/icons-react', () => {
  const icon = (name: string) => {
    const MockIcon = (props: React.SVGProps<SVGSVGElement>) => <svg data-icon={name} {...props} />;
    MockIcon.displayName = `Mock${name}`;
    return MockIcon;
  };

  return {
    IconCheck: icon('check'),
    IconCopy: icon('copy'),
    IconFlask: icon('flask'),
    IconInfoCircle: icon('info-circle'),
  };
});

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
    Modal: (({
      children,
      opened,
    }: {
      children?: React.ReactNode;
      opened?: boolean;
    }) => (opened ? <div data-modal="true">{children}</div> : null)) as unknown as typeof actual.Modal,
    Tooltip: (({ children }: { children?: React.ReactNode }) => <>{children}</>) as unknown as typeof actual.Tooltip,
  };
});

vi.mock('@/app/components/infinite-scroll-trigger', () => ({
  InfiniteScrollTrigger: () => null,
}));

vi.mock('@/app/components/markdown-viewer', () => ({
  MarkdownViewer: ({ markdown }: { markdown?: string | null }) => <div>{markdown}</div>,
}));

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: showErrorNotificationMock,
  showSuccessNotification: showSuccessNotificationMock,
}));

import { DispatchPromptPreview } from '@/app/components/dispatch-prompt-preview';
import { ReadyQaActions } from '@/app/components/ready-qa-actions';
import { buildProjectQaDispatchMessage } from '@/lib/task-telegram-client';

const clipboardWriteTextMock = vi.fn<(value: string) => Promise<void>>();
const fetchMock = vi.fn<typeof fetch>();

function renderWithMantine(element: React.ReactElement) {
  return render(<MantineProvider>{element}</MantineProvider>);
}

function createRun() {
  return {
    id: 'run-123',
    projectId: 'project-1',
    branchName: 'release/mobile',
    status: 'failed' as const,
    engine: 'codex' as const,
    targetUrl: 'http://127.0.0.1:3000',
    taskKeys: ['QA-1'],
    summary: { total: 1, critical: 0, high: 1, medium: 0, low: 0 },
    reportMarkdown: '# QA Report',
    createdAt: '2026-03-18T10:00:00.000Z',
    startedAt: '2026-03-18T10:01:00.000Z',
    finishedAt: '2026-03-18T10:03:00.000Z',
  };
}

describe('copy feedback icons', () => {
  beforeEach(() => {
    clipboardWriteTextMock.mockReset();
    clipboardWriteTextMock.mockResolvedValue(undefined);
    fetchMock.mockReset();
    showErrorNotificationMock.mockReset();
    showSuccessNotificationMock.mockReset();
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteTextMock },
    });
    vi.stubGlobal('fetch', fetchMock);

    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a checkmark after copying the dispatch prompt', async () => {
    renderWithMantine(<DispatchPromptPreview prompt="Dispatch this prompt" />);

    const copyButton = screen.getByLabelText('Copy dispatch prompt');

    expect(copyButton.querySelector('[data-icon="copy"]')).not.toBeNull();

    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith('Dispatch this prompt');
    });
    await waitFor(() => {
      expect(copyButton.querySelector('[data-icon="check"]')).not.toBeNull();
    });
  });

  it('shows a checkmark after copying a QA report', async () => {
    const view = renderWithMantine(
      <ReadyQaActions
        projectId="project-1"
        projectKey="ALPHA"
        projectName="Project One"
        branchName="release/mobile"
        readyCount={1}
        telegramEnabled
        initialRuns={[createRun()]}
      />,
    );

    const openButtons = screen.getAllByLabelText('Open QA runs');
    fireEvent.click(openButtons[openButtons.length - 1]!);

    const copyButton = await screen.findByLabelText('Copy QA report for run-123');

    expect(copyButton.querySelector('[data-icon="copy"]')).not.toBeNull();

    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith('# QA Report');
    });
    await waitFor(() => {
      expect(copyButton.querySelector('[data-icon="check"]')).not.toBeNull();
    });
  });

  it('copies a queued QA dispatch prompt with the returned run metadata', async () => {
    const queuedRun = {
      ...createRun(),
      id: 'run-456',
      engine: 'claude-code' as const,
      status: 'queued' as const,
      taskKeys: ['QA-7', 'QA-8'],
      reportMarkdown: null,
      startedAt: null,
      finishedAt: null,
    };

    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true, run: queuedRun }),
    } as unknown as Response);

    const view = renderWithMantine(
      <ReadyQaActions
        projectId="project-1"
        projectKey="ALPHA"
        projectName="Project One"
        branchName="release/mobile"
        readyCount={2}
        telegramEnabled
        initialRuns={[]}
      />,
    );

    const scope = within(view.container);
    fireEvent.click(scope.getByLabelText('Open QA runs'));

    const copyButton = await scope.findByLabelText('Copy dispatch prompt');
    expect((copyButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(scope.getByText('Queue QA'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect((copyButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(
        buildProjectQaDispatchMessage({
          projectKey: 'ALPHA',
          engine: 'claude-code',
          branchName: 'release/mobile',
          dispatchTarget: 'telegram',
          qaRunId: 'run-456',
          qaTaskKeys: ['QA-7', 'QA-8'],
        }),
      );
    });
  });
});
