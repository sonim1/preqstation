// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const formAction = vi.hoisted(() => vi.fn());
const useActionStateMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
const taskCopyActionsPropsMock = vi.hoisted(() => vi.fn());
const liveMarkdownEditorPropsMock = vi.hoisted(() => vi.fn());
const useAutoSaveMock = vi.hoisted(() => vi.fn());
const useEffectMock = vi.hoisted(() => vi.fn());
const useTaskOfflineDraftMock = vi.hoisted(() => vi.fn());
const setTaskEditRefreshBlockedMock = vi.hoisted(() => vi.fn());
const taskLabelPickerPropsMock = vi.hoisted(() => vi.fn());

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useActionState: useActionStateMock,
    useEffect: useEffectMock,
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock('@/app/components/live-markdown-editor', () => ({
  LiveMarkdownEditor: (props: { label: string; name: string }) => {
    liveMarkdownEditorPropsMock(props);
    return React.createElement('div', {
      'data-component': 'LiveMarkdownEditor',
      'data-label': props.label,
      'data-name': props.name,
    });
  },
}));

vi.mock('@/app/components/status-history-breadcrumb', () => ({
  StatusHistoryBreadcrumb: () => React.createElement('div', { 'data-component': 'StatusHistory' }),
}));

vi.mock('@/app/components/task-copy-actions', () => ({
  TaskCopyActions: (props: unknown) => {
    taskCopyActionsPropsMock(props);
    return React.createElement('div', { 'data-component': 'TaskCopyActions' }, 'Dispatch');
  },
}));

vi.mock('@/app/components/work-log-timeline', () => ({
  WorkLogTimeline: () => React.createElement('div', { 'data-component': 'WorkLogTimeline' }),
}));

vi.mock('@/app/hooks/use-auto-save', () => ({
  shouldFlushAutoSaveOnBlur: () => false,
  useAutoSave: useAutoSaveMock,
}));

vi.mock('@/app/hooks/use-task-offline-draft', () => ({
  useTaskOfflineDraft: useTaskOfflineDraftMock,
}));

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: vi.fn(),
}));

vi.mock('@/lib/task-edit-refresh-guard', () => ({
  setTaskEditRefreshBlocked: setTaskEditRefreshBlockedMock,
}));

vi.mock('@/app/components/task-label-picker', () => ({
  TaskLabelPicker: (props: Record<string, unknown>) => {
    taskLabelPickerPropsMock(props);
    return React.createElement('div', { 'data-component': 'TaskLabelPicker' });
  },
}));

import { TaskEditForm } from '@/app/components/task-edit-form';
import { TerminologyProvider } from '@/app/components/terminology-provider';
import { KITCHEN_TERMINOLOGY } from '@/lib/terminology';

function renderTaskEditForm(
  overrides: Partial<{
    onTaskQueued: (taskKey: string, queuedAt: string) => void;
    onDispatchQueued: () => void;
  }> = {},
) {
  return renderToStaticMarkup(
    <MantineProvider>
      <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
        <TaskEditForm
          editableTodo={{
            id: '1',
            taskKey: 'PROJ-187',
            title: 'OpenClaw 기능 UI수정',
            note: 'Move the actions into the form meta header.',
            projectId: 'project-1',
            labelIds: [],
            labels: [],
            taskPriority: 'none',
            status: 'todo',
            engine: 'codex',
            runState: null,
            runStateUpdatedAt: null,
            workLogs: [],
          }}
          projects={[{ id: 'project-1', name: 'Project Manager' }]}
          todoLabels={[]}
          taskPriorityOptions={[{ value: 'none', label: 'None' }]}
          updateTodoAction={vi.fn(async () => ({ ok: true as const }))}
          branchName="task/proj-187/openclaw-gineung-uisujeong"
          telegramEnabled
          {...overrides}
        />
      </TerminologyProvider>
    </MantineProvider>,
  );
}

describe('app/components/task-edit-form', () => {
  beforeEach(() => {
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
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);

    formAction.mockReset();
    refreshMock.mockReset();
    taskCopyActionsPropsMock.mockReset();
    liveMarkdownEditorPropsMock.mockReset();
    useAutoSaveMock.mockReset();
    useTaskOfflineDraftMock.mockReset();
    useEffectMock.mockReset();
    useActionStateMock.mockReset();
    setTaskEditRefreshBlockedMock.mockReset();
    taskLabelPickerPropsMock.mockReset();

    useActionStateMock.mockReturnValue([null, formAction]);
    useAutoSaveMock.mockReturnValue({
      markDirty: vi.fn(),
      triggerSave: vi.fn(),
      flushSave: vi.fn(),
      syncSnapshot: vi.fn(),
      status: 'idle',
      isDirty: false,
      isDirtyRef: { current: false },
    });
    useTaskOfflineDraftMock.mockReturnValue({
      canRestoreDraft: false,
      clearDraft: vi.fn(),
      draftBaseNoteFingerprint: 'task-note:v1:0:abc123',
      draftNote: 'Move the actions into the form meta header.',
      draftRevision: 0,
      draftTitle: 'OpenClaw 기능 UI수정',
      hasNoteConflict: false,
      restoreDraft: vi.fn(),
      updateNoteDraft: vi.fn(),
      updateTitleDraft: vi.fn(),
    });
    useEffectMock.mockImplementation(() => undefined);
    vi.stubGlobal('requestAnimationFrame', ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('renders dispatch controls in the right rail when branch context is available', () => {
    const html = renderTaskEditForm();

    expect(html).toContain('task-edit-meta-header');
    expect(html).toContain('data-panel="task-edit-dispatch"');
    expect(html).not.toContain('task-edit-meta-actions');
    expect(html).toContain('Dispatch');
    expect(html).toContain('Ticket settings');
    expect(html).not.toContain('Ticket title');
    expect(taskCopyActionsPropsMock.mock.calls[0]?.[0]).not.toHaveProperty('onAskRequested');
  });

  it('renders the Notes mode switch on the Notes header row instead of the editor header', () => {
    const html = renderTaskEditForm();

    expect(html).toContain('Notes');
    expect(html).toContain('aria-label="Notes mode"');
    expect(html).not.toContain('Ticket content (Markdown)');
  });

  it('wires the shared task label picker with the editable task project and selected labels', () => {
    renderTaskEditForm();

    expect(taskLabelPickerPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        selectedLabelIds: [],
        labelOptions: [],
      }),
    );
  });

  it('includes the note base fingerprint, stale note warning, and restore action when a stale draft is available', () => {
    useTaskOfflineDraftMock.mockReturnValueOnce({
      canRestoreDraft: true,
      clearDraft: vi.fn(),
      draftBaseNoteFingerprint: 'task-note:v1:42:deadbeef',
      draftNote: 'Move the actions into the form meta header.',
      draftRevision: 1,
      draftTitle: 'OpenClaw 기능 UI수정',
      hasNoteConflict: true,
      restoreDraft: vi.fn(),
      updateNoteDraft: vi.fn(),
      updateTitleDraft: vi.fn(),
    });

    const html = renderTaskEditForm();

    expect(html).toContain('name="baseNoteFingerprint"');
    expect(html).toContain('value="task-note:v1:42:deadbeef"');
    expect(html).toContain('Server notes changed while this draft was open.');
    expect(html).toContain('Restore draft');
  });

  it('wires the restore draft action to the draft hook and marks the form dirty', () => {
    const markDirty = vi.fn();
    const restoreDraft = vi.fn();
    useAutoSaveMock.mockReturnValueOnce({
      markDirty,
      triggerSave: vi.fn(),
      flushSave: vi.fn(),
      syncSnapshot: vi.fn(),
      status: 'idle',
      isDirty: false,
      isDirtyRef: { current: false },
    });
    useTaskOfflineDraftMock.mockReturnValueOnce({
      canRestoreDraft: true,
      clearDraft: vi.fn(),
      draftBaseNoteFingerprint: 'task-note:v1:42:deadbeef',
      draftNote: 'Move the actions into the form meta header.',
      draftRevision: 1,
      draftTitle: 'OpenClaw 기능 UI수정',
      hasNoteConflict: true,
      restoreDraft,
      updateNoteDraft: vi.fn(),
      updateTitleDraft: vi.fn(),
    });

    render(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <TaskEditForm
            editableTodo={{
              id: '1',
              taskKey: 'PROJ-187',
              title: 'OpenClaw 기능 UI수정',
              note: 'Move the actions into the form meta header.',
              projectId: 'project-1',
              labelIds: [],
              labels: [],
              taskPriority: 'none',
              status: 'todo',
              engine: 'codex',
              runState: null,
              runStateUpdatedAt: null,
              workLogs: [],
            }}
            projects={[{ id: 'project-1', name: 'Project Manager' }]}
            todoLabels={[]}
            taskPriorityOptions={[{ value: 'none', label: 'None' }]}
            updateTodoAction={vi.fn(async () => ({ ok: true as const }))}
            branchName="task/proj-187/openclaw-gineung-uisujeong"
            telegramEnabled
          />
        </TerminologyProvider>
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Restore draft' }));

    expect(restoreDraft).toHaveBeenCalledTimes(1);
    expect(markDirty).toHaveBeenCalledTimes(1);
  });

  it('wires the notes editor save shortcut to immediate autosave only for task notes', () => {
    const flushSave = vi.fn();
    useAutoSaveMock.mockReturnValueOnce({
      markDirty: vi.fn(),
      triggerSave: vi.fn(),
      flushSave,
      syncSnapshot: vi.fn(),
      status: 'idle',
      isDirty: false,
      isDirtyRef: { current: false },
    });

    renderTaskEditForm();

    const notesEditorProps = liveMarkdownEditorPropsMock.mock.calls[0]?.[0] as
      | { name: string; onSaveShortcut?: () => void }
      | undefined;

    expect(notesEditorProps?.name).toBe('noteMd');
    expect(notesEditorProps?.onSaveShortcut).toBeTypeOf('function');

    notesEditorProps?.onSaveShortcut?.();
    expect(flushSave).toHaveBeenCalledTimes(1);
  });

  it('renders the mobile saving overlay only while autosave is saving', () => {
    const idleHtml = renderTaskEditForm();

    expect(idleHtml).not.toContain('data-slot="task-edit-mobile-saving-overlay"');

    useAutoSaveMock.mockReturnValueOnce({
      markDirty: vi.fn(),
      triggerSave: vi.fn(),
      flushSave: vi.fn(),
      syncSnapshot: vi.fn(),
      status: 'saving',
      isDirty: false,
      isDirtyRef: { current: false },
    });

    const savingHtml = renderTaskEditForm();

    expect(savingHtml).toContain('data-slot="task-edit-mobile-saving-overlay"');
    expect(savingHtml).toContain('role="status"');
    expect(savingHtml).toContain('Saving');
  });

  it('blocks polling while the task form has unsaved edits', () => {
    const effects: Array<() => void | (() => void)> = [];
    useEffectMock.mockImplementation((effect: () => void | (() => void)) => {
      effects.push(effect);
    });

    useAutoSaveMock.mockReturnValueOnce({
      markDirty: vi.fn(),
      triggerSave: vi.fn(),
      flushSave: vi.fn(),
      syncSnapshot: vi.fn(),
      status: 'idle',
      isDirty: true,
      isDirtyRef: { current: true },
    });

    renderTaskEditForm();
    effects[0]?.();

    expect(setTaskEditRefreshBlockedMock).toHaveBeenCalledWith(true);

    effects.length = 0;
    setTaskEditRefreshBlockedMock.mockClear();
    useAutoSaveMock.mockReturnValueOnce({
      markDirty: vi.fn(),
      triggerSave: vi.fn(),
      flushSave: vi.fn(),
      syncSnapshot: vi.fn(),
      status: 'idle',
      isDirty: false,
      isDirtyRef: { current: false },
    });

    renderTaskEditForm();
    effects[0]?.();

    expect(setTaskEditRefreshBlockedMock).toHaveBeenCalledWith(false);
  });

  it('keeps polling blocked while autosave transitions from dirty to saving', () => {
    const effects: Array<() => void | (() => void)> = [];
    useEffectMock.mockImplementation((effect: () => void | (() => void)) => {
      effects.push(effect);
    });

    useAutoSaveMock.mockReturnValueOnce({
      markDirty: vi.fn(),
      triggerSave: vi.fn(),
      flushSave: vi.fn(),
      syncSnapshot: vi.fn(),
      status: 'idle',
      isDirty: true,
      isDirtyRef: { current: true },
    });

    renderTaskEditForm();
    const firstCleanup = effects[0]?.();

    effects.length = 0;
    useAutoSaveMock.mockReturnValueOnce({
      markDirty: vi.fn(),
      triggerSave: vi.fn(),
      flushSave: vi.fn(),
      syncSnapshot: vi.fn(),
      status: 'saving',
      isDirty: false,
      isDirtyRef: { current: false },
    });

    firstCleanup?.();
    renderTaskEditForm();
    effects[0]?.();

    expect(setTaskEditRefreshBlockedMock.mock.calls).not.toContainEqual([false]);
    expect(setTaskEditRefreshBlockedMock).toHaveBeenLastCalledWith(true);
  });

  it('applies queued state before closing the modal after a successful dispatch send', () => {
    const onTaskQueued = vi.fn();
    const onDispatchQueued = vi.fn();

    renderTaskEditForm({ onTaskQueued, onDispatchQueued });

    expect(taskCopyActionsPropsMock.mock.calls[0]?.[0]).toMatchObject({
      telegramEnabled: true,
    });

    const taskCopyActionsProps = taskCopyActionsPropsMock.mock.calls[0]?.[0] as {
      onTaskQueued?: (taskKey: string, queuedAt: string) => void;
    };

    taskCopyActionsProps.onTaskQueued?.('PROJ-187', '2026-03-30T13:10:00.000Z');

    expect(onTaskQueued).toHaveBeenCalledWith('PROJ-187', '2026-03-30T13:10:00.000Z');
    expect(onDispatchQueued).toHaveBeenCalled();
  });

  it('refreshes the current route after a successful save when board reconciliation is unavailable', () => {
    const effects: Array<() => void | (() => void)> = [];
    useActionStateMock.mockReturnValue([{ ok: true }, formAction]);
    useEffectMock.mockImplementation((effect: () => void | (() => void)) => {
      effects.push(effect);
    });

    renderTaskEditForm();
    effects.forEach((effect) => {
      effect();
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('does not refresh the route when a board-level task update callback is present', () => {
    const effects: Array<() => void | (() => void)> = [];
    const onTaskUpdated = vi.fn();
    useActionStateMock.mockReturnValue([{ ok: true }, formAction]);
    useEffectMock.mockImplementation((effect: () => void | (() => void)) => {
      effects.push(effect);
    });

    renderToStaticMarkup(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <TaskEditForm
            editableTodo={{
              id: '1',
              taskKey: 'PROJ-187',
              title: 'OpenClaw 기능 UI수정',
              note: 'Move the actions into the form meta header.',
              projectId: 'project-1',
              labelIds: [],
              labels: [],
              taskPriority: 'none',
              status: 'todo',
              engine: 'codex',
              runState: null,
              runStateUpdatedAt: null,
              workLogs: [],
            }}
            projects={[{ id: 'project-1', name: 'Project Manager' }]}
            todoLabels={[]}
            taskPriorityOptions={[{ value: 'none', label: 'None' }]}
            updateTodoAction={vi.fn(async () => ({ ok: true as const }))}
            onTaskUpdated={onTaskUpdated}
          />
        </TerminologyProvider>
      </MantineProvider>,
    );

    effects.forEach((effect) => {
      effect();
    });

    expect(onTaskUpdated).toHaveBeenCalledWith({
      boardTask: undefined,
      focusedTask: undefined,
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
