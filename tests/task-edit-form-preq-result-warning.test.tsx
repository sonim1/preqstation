import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const useAutoSaveMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/components/auto-save-indicator', () => ({
  AutoSaveIndicator: () => null,
}));

vi.mock('@/app/components/status-history-breadcrumb', () => ({
  StatusHistoryBreadcrumb: () => <div data-slot="status-history-breadcrumb" />,
}));

vi.mock('@/app/components/task-copy-actions', () => ({
  TaskCopyActions: () => <div data-slot="task-copy-actions" />,
}));

vi.mock('@/app/components/work-log-timeline', () => ({
  WorkLogTimeline: ({ logs }: { logs: Array<{ title: string }> }) => (
    <div data-slot="work-log-timeline">{logs.map((log) => log.title).join(' | ')}</div>
  ),
}));

vi.mock('@/app/hooks/use-auto-save', () => ({
  shouldFlushAutoSaveOnBlur: () => true,
  useAutoSave: () => useAutoSaveMock(),
}));

vi.mock('@/lib/engine-icons', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/engine-icons')>();
  return {
    ...actual,
    getEngineConfig: () => null,
  };
});

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: vi.fn(),
}));

import { TaskEditForm } from '@/app/components/task-edit-form';

type RenderOverrides = Partial<{
  status: string;
  workLogs: Array<{
    id: string;
    title: string;
    detail: string | null;
    workedAt: Date;
    createdAt: Date;
    engine?: string | null;
    todo?: { engine: string | null } | null;
  }>;
}>;

function renderTaskEditForm(overrides: RenderOverrides = {}) {
  useAutoSaveMock.mockReturnValue({
    markDirty: vi.fn(),
    triggerSave: vi.fn(),
    flushSave: vi.fn(),
    syncSnapshot: vi.fn(),
    status: 'idle',
    isDirtyRef: { current: false },
  });

  return renderToStaticMarkup(
    <MantineProvider>
      <TaskEditForm
        editableTodo={{
          id: 'task-1',
          taskKey: 'PROJ-232',
          title: 'Hold result warning',
          note: '## Context\nTask note',
          projectId: null,
          labelIds: [],
          labels: [],
          taskPriority: 'none',
          status: overrides.status ?? 'hold',
          engine: null,
          runState: null,
          runStateUpdatedAt: null,
          workLogs: overrides.workLogs ?? [
            {
              id: 'work-log-1',
              title: 'PREQSTATION Result',
              detail: 'Blocked because **dependencies are missing**.',
              workedAt: new Date('2026-03-13T10:00:00Z'),
              createdAt: new Date('2026-03-13T10:00:00Z'),
            },
          ],
        }}
        projects={[]}
        todoLabels={[]}
        taskPriorityOptions={[{ value: 'none', label: 'None' }]}
        updateTodoAction={async () => ({ ok: true })}
      />
    </MantineProvider>,
  );
}

describe('app/components/task-edit-form PREQ result warning', () => {
  it('keeps status history, the latest PREQSTATION result detail, and Work Logs beneath Notes for hold tasks', () => {
    const html = renderTaskEditForm({
      workLogs: [
        {
          id: 'work-log-older',
          title: 'PREQSTATION Result',
          detail: 'Older result that should not be shown.',
          workedAt: new Date('2026-03-13T09:00:00Z'),
          createdAt: new Date('2026-03-13T09:00:00Z'),
        },
        {
          id: 'work-log-latest',
          title: 'PREQSTATION Result',
          detail: 'Latest blocked result with **markdown**.',
          workedAt: new Date('2026-03-13T11:00:00Z'),
          createdAt: new Date('2026-03-13T11:00:00Z'),
        },
      ],
    });

    expect(html).toContain('data-slot="status-history-breadcrumb"');
    expect(html.indexOf('Notes')).toBeLessThan(
      html.indexOf('data-slot="status-history-breadcrumb"'),
    );
    expect(html.indexOf('data-slot="status-history-breadcrumb"')).toBeLessThan(
      html.indexOf('Latest blocked result with <strong>markdown</strong>.'),
    );
    expect(html).toContain('Latest blocked result with <strong>markdown</strong>.');
    expect(html.indexOf('Latest blocked result with <strong>markdown</strong>.')).toBeLessThan(
      html.indexOf('Work Logs'),
    );
    expect(html).not.toContain('Older result that should not be shown.');
  });

  it('does not render a warning when a hold task has no PREQSTATION result log with detail', () => {
    const html = renderTaskEditForm({
      workLogs: [
        {
          id: 'work-log-1',
          title: 'Investigated issue',
          detail: 'Some unrelated detail.',
          workedAt: new Date('2026-03-13T11:00:00Z'),
          createdAt: new Date('2026-03-13T11:00:00Z'),
        },
        {
          id: 'work-log-2',
          title: 'PREQSTATION Result',
          detail: null,
          workedAt: new Date('2026-03-13T12:00:00Z'),
          createdAt: new Date('2026-03-13T12:00:00Z'),
        },
      ],
    });

    expect(html).not.toContain('Some unrelated detail.');
    expect(html).not.toContain('mantine-Alert-root');
  });

  it('does not render a warning for non-hold tasks even with PREQSTATION result history', () => {
    const html = renderTaskEditForm({
      status: 'todo',
      workLogs: [
        {
          id: 'work-log-1',
          title: 'PREQSTATION Result',
          detail: 'Historic blocked result.',
          workedAt: new Date('2026-03-13T10:00:00Z'),
          createdAt: new Date('2026-03-13T10:00:00Z'),
        },
      ],
    });

    expect(html).not.toContain('Historic blocked result.');
    expect(html).not.toContain('mantine-Alert-root');
  });
});
