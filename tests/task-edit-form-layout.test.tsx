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
  AutoSaveIndicator: () => <div data-slot="auto-save-indicator" />,
}));

vi.mock('@/app/components/live-markdown-editor', () => ({
  LiveMarkdownEditor: ({ label, name }: { label: string; name: string }) => (
    <div data-slot="live-markdown-editor" data-label={label} data-name={name} />
  ),
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
          taskKey: 'PROJ-245',
          title: 'Edit task panel refresh',
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
              detail: 'Blocked because dependencies are missing.',
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

describe('app/components/task-edit-form layout', () => {
  it('renders the edit form as a desktop workbench with metadata, notes, and dispatch rails', () => {
    const html = renderTaskEditForm();

    expect(html).toContain('Notes');
    expect(html).toContain('aria-label="Notes mode"');
    expect(html).toContain('Task settings');
    expect(html).toContain('data-slot="task-copy-actions"');
    expect(html).toContain('Activity');
    expect(html).toContain('aria-label="Notes help"');
    expect(html).toContain('aria-label="Task settings help"');
    expect(html).toContain('aria-label="Activity help"');
    expect(html).toContain('data-layout="task-edit-shell"');
    expect(html).toContain('data-panel="task-edit-sidebar"');
    expect(html).toContain('data-panel="task-edit-main-column"');
    expect(html).toContain('data-panel="task-edit-dispatch"');
    expect(html).toContain('data-panel="task-edit-metadata"');
    expect(html).toContain('data-panel="task-edit-notes-primary"');
    expect(html).toContain('data-panel="task-edit-activity"');
    expect(html).not.toContain('Overview');
    expect(html).not.toContain('aria-label="Overview help"');
    expect(html).not.toContain('data-panel="task-edit-overview"');
    expect(html).not.toContain('data-panel="task-edit-settings"');
    expect(html).not.toContain('Task title');
    expect(html.indexOf('data-panel="task-edit-main-column"')).toBeLessThan(
      html.indexOf('data-panel="task-edit-sidebar"'),
    );
    expect(html.indexOf('data-panel="task-edit-dispatch"')).toBeLessThan(
      html.indexOf('data-slot="task-copy-actions"'),
    );
    expect(html.indexOf('data-panel="task-edit-dispatch"')).toBeLessThan(
      html.indexOf('data-panel="task-edit-metadata"'),
    );
    expect(html.indexOf('data-panel="task-edit-main-column"')).toBeLessThan(
      html.indexOf('data-panel="task-edit-notes-primary"'),
    );
    expect(html.indexOf('Notes')).toBeLessThan(html.indexOf('Activity'));
    expect(html.indexOf('data-panel="task-edit-notes-primary"')).toBeLessThan(
      html.indexOf('data-panel="task-edit-activity"'),
    );
    expect(html).not.toContain('data-slot="auto-save-indicator"');
    expect(html).not.toContain('Task content (Markdown)');
  });

  it('keeps work logs conditional inside the bottom activity section', () => {
    const htmlWithLogs = renderTaskEditForm();
    const htmlWithoutLogs = renderTaskEditForm({ workLogs: [] });

    expect(htmlWithLogs).toContain('data-panel="task-edit-activity"');
    expect(htmlWithLogs).toContain('data-slot="work-log-timeline"');
    expect(htmlWithoutLogs).not.toContain('data-slot="work-log-timeline"');
  });

  it('hides dispatch but keeps task settings for archived tasks', () => {
    const html = renderTaskEditForm({ status: 'archived' });

    expect(html).not.toContain('data-panel="task-edit-dispatch"');
    expect(html).not.toContain('data-slot="task-copy-actions"');
    expect(html).toContain('data-panel="task-edit-sidebar"');
    expect(html).toContain('data-panel="task-edit-metadata"');
    expect(html).toContain('Task settings');
  });
});
