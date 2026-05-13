import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import taskEditFormClasses from '@/app/components/task-edit-form.module.css';

const useAutoSaveMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/components/auto-save-indicator', () => ({
  AutoSaveIndicator: () => React.createElement('div', { 'data-slot': 'auto-save-indicator' }),
}));

vi.mock('@/app/components/live-markdown-editor', () => ({
  LiveMarkdownEditor: ({ label, name }: { label: string; name: string }) =>
    React.createElement('div', {
      'data-slot': 'live-markdown-editor',
      'data-label': label,
      'data-name': name,
    }),
}));

vi.mock('@/app/components/status-history-breadcrumb', () => ({
  StatusHistoryBreadcrumb: () =>
    React.createElement('div', { 'data-slot': 'status-history-breadcrumb' }),
}));

vi.mock('@/app/components/task-copy-actions', () => ({
  SEND_SHORTCUT_LABEL: 'Cmd+Enter',
  TaskCopyActions: () =>
    React.createElement('div', {
      className: 'task-dispatch-actions',
      'data-slot': 'task-copy-actions',
    }),
}));

vi.mock('@/app/components/work-log-timeline', () => ({
  WorkLogTimeline: ({ logs }: { logs: Array<{ title: string }> }) =>
    React.createElement(
      'div',
      { 'data-slot': 'work-log-timeline' },
      logs.map((log) => log.title).join(' | '),
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

function renderTaskEditForm(saveStatus: 'idle' | 'saving' = 'idle') {
  useAutoSaveMock.mockReturnValue({
    markDirty: vi.fn(),
    triggerSave: vi.fn(),
    flushSave: vi.fn(),
    syncSnapshot: vi.fn(),
    status: saveStatus,
    isDirtyRef: { current: false },
  });

  return renderToStaticMarkup(
    React.createElement(
      MantineProvider,
      null,
      React.createElement(TaskEditForm, {
        editableTodo: {
          id: 'task-1',
          taskKey: 'PROJ-245',
          title: 'Edit task panel refresh',
          note: '## Context\nTask note',
          projectId: 'project-1',
          labelIds: ['label-1'],
          labels: [{ id: 'label-1', name: 'Frontend', color: '#228be6' }],
          taskPriority: 'none',
          status: 'hold',
          engine: null,
          runState: null,
          runStateUpdatedAt: null,
          workLogs: [
            {
              id: 'work-log-1',
              title: 'PREQSTATION Result',
              detail: 'Blocked because dependencies are missing.',
              workedAt: new Date('2026-03-13T10:00:00Z'),
              createdAt: new Date('2026-03-13T10:00:00Z'),
            },
          ],
        },
        projects: [{ id: 'project-1', name: 'Project Manager' }],
        todoLabels: [{ id: 'label-1', name: 'Frontend', color: '#228be6' }],
        taskPriorityOptions: [{ value: 'none', label: 'None' }],
        updateTodoAction: async () => ({ ok: true as const }),
      }),
    ),
  );
}

describe('task edit modal scroll-shell rendered layout regressions', () => {
  it('renders the edit form as a two-column workbench with dispatch above task settings', () => {
    const html = renderTaskEditForm();

    expect(html).toContain(`class="${taskEditFormClasses.shell}"`);
    expect(html).toContain('data-layout="task-edit-shell"');
    expect(html).toContain(`class="${taskEditFormClasses.mainColumn}"`);
    expect(html).toContain(`class="${taskEditFormClasses.sidebar}"`);
    expect(html).toContain(
      `class="${taskEditFormClasses.dispatchRail} ${taskEditFormClasses.sectionSurface}"`,
    );
    expect(html).toContain(
      `class="${taskEditFormClasses.metadataSection} ${taskEditFormClasses.sectionSurface}"`,
    );
    expect(html).toContain(
      `class="${taskEditFormClasses.notesCard} ${taskEditFormClasses.sectionSurface}"`,
    );
    expect(html).toContain(
      `class="${taskEditFormClasses.activityCard} ${taskEditFormClasses.sectionSurface}"`,
    );
    expect(html).toContain('data-panel="task-edit-main-column"');
    expect(html).toContain('data-panel="task-edit-sidebar"');
    expect(html).toContain('data-panel="task-edit-dispatch"');
    expect(html).toContain('data-panel="task-edit-metadata"');
    expect(html).toContain('data-panel="task-edit-notes-primary"');
    expect(html).toContain('data-panel="task-edit-activity"');
    expect(html).toContain('data-panel="task-edit-settings-card"');
    expect(html).toContain('data-slot="task-copy-actions"');
    expect(html.indexOf('data-panel="task-edit-main-column"')).toBeLessThan(
      html.indexOf('data-panel="task-edit-sidebar"'),
    );
    expect(html.indexOf('data-panel="task-edit-dispatch"')).toBeLessThan(
      html.indexOf('data-panel="task-edit-metadata"'),
    );
    expect(html.indexOf('data-panel="task-edit-notes-primary"')).toBeLessThan(
      html.indexOf('data-panel="task-edit-activity"'),
    );
    expect(html).not.toContain('data-panel="task-edit-overview"');
    expect(html).not.toContain('data-panel="task-edit-settings"');
  });

  it('renders compact task settings and resilient text hooks inside the metadata rail', () => {
    const html = renderTaskEditForm();

    expect(html).toContain('Task settings');
    expect(html).toContain('Project Manager');
    expect(html).toContain('Frontend');
    expect(html).toContain(`class="${taskEditFormClasses.settingsPanel}"`);
    expect(html).toContain(taskEditFormClasses.metaHeader);
    expect(html).toContain(taskEditFormClasses.taskIdentityRow);
    expect(html).toContain(taskEditFormClasses.projectName);
    expect(html).toContain(taskEditFormClasses.settingsControls);
    expect(html).toContain(taskEditFormClasses.settingsDivider);
    expect(html).toContain('name="taskPriority"');
    expect(html).toContain('data-task-priority-value="none"');
    expect(html).toContain('data-task-label-trigger="default"');
    expect(html).not.toContain('data-task-edit-label-shortcut="true"');
    expect(html).not.toContain('data-task-edit-priority-shortcut="true"');
  });

  it('renders the notes editor and activity content in scroll-owned body panels', () => {
    const html = renderTaskEditForm();

    expect(html).toContain('Notes');
    expect(html).toContain('Activity');
    expect(html).toContain(taskEditFormClasses.notesContent);
    expect(html).toContain(`class="${taskEditFormClasses.notesEditor}"`);
    expect(html).toContain('data-slot="live-markdown-editor"');
    expect(html).toContain('data-slot="work-log-timeline"');
    expect(html).toContain('PREQSTATION Result');
    expect(html.indexOf('Notes')).toBeLessThan(html.indexOf('Activity'));
  });

  it('keeps the mobile saving overlay in the form body markup', () => {
    const html = renderTaskEditForm('saving');

    expect(html).toContain(taskEditFormClasses.mobileSavingOverlay);
    expect(html).toContain(`class="${taskEditFormClasses.mobileSavingOverlayCard}"`);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Saving');
  });
});
