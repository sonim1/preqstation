// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const formAction = vi.hoisted(() => vi.fn());
const useActionStateMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
const taskCopyActionsPropsMock = vi.hoisted(() => vi.fn());
const liveMarkdownEditorPropsMock = vi.hoisted(() => vi.fn());
const useAutoSaveMock = vi.hoisted(() => vi.fn());
const useEffectMock = vi.hoisted(() => vi.fn());
const useBoardOfflineSyncMock = vi.hoisted(() => vi.fn());
const useOfflineStatusMock = vi.hoisted(() => vi.fn());
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

vi.mock('@/app/components/board-offline-sync-provider', () => ({
  useBoardOfflineSync: () => useBoardOfflineSyncMock(),
}));

vi.mock('@/app/components/offline-status-provider', () => ({
  useOfflineStatus: () => useOfflineStatusMock(),
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
            dispatchTarget: null,
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
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

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
    useBoardOfflineSyncMock.mockReset();
    useOfflineStatusMock.mockReset();
    useTaskOfflineDraftMock.mockReset();
    useEffectMock.mockReset();
    useActionStateMock.mockReset();
    setTaskEditRefreshBlockedMock.mockReset();
    taskLabelPickerPropsMock.mockReset();

    useActionStateMock.mockReturnValue([null, formAction]);
    useBoardOfflineSyncMock.mockReturnValue(null);
    useOfflineStatusMock.mockReturnValue({ online: true });
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
      autoSaveDraft: null,
      clearDraft: vi.fn(),
      draftBaseNoteFingerprint: 'task-note:v1:0:abc123',
      draftBaseTitleFingerprint: 'task-title:v1:19:abc123',
      draftNote: 'Move the actions into the form meta header.',
      draftRevision: 0,
      draftTitle: 'OpenClaw 기능 UI수정',
      hasNoteConflict: false,
      hasTitleConflict: false,
      markAutoSaveDraftFailed: vi.fn(),
      restoreDraft: vi.fn(),
      restoreDraftPreview: null,
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

  it('keeps notes editable offline while disabling server-only edit panel controls', () => {
    useOfflineStatusMock.mockReturnValueOnce({ online: false });
    useBoardOfflineSyncMock.mockReturnValueOnce({
      online: false,
      queueTaskCreate: vi.fn(),
      queueTaskMove: vi.fn(),
      queueTaskPatch: vi.fn(),
    });

    const html = renderTaskEditForm();

    expect(html).toContain('data-component="LiveMarkdownEditor"');
    expect(liveMarkdownEditorPropsMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ name: 'noteMd' }),
    );
    expect(html).not.toContain('data-panel="task-edit-comments"');
    expect(html).not.toContain('data-panel="task-edit-dispatch"');
    expect(taskCopyActionsPropsMock).not.toHaveBeenCalled();
    expect(taskLabelPickerPropsMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  it('includes the base fingerprints, stale note warning, and restore action when a stale draft is available', () => {
    useTaskOfflineDraftMock.mockReturnValueOnce({
      canRestoreDraft: true,
      autoSaveDraft: null,
      clearDraft: vi.fn(),
      draftBaseNoteFingerprint: 'task-note:v1:42:deadbeef',
      draftBaseTitleFingerprint: 'task-title:v1:18:feedface',
      draftNote: 'Move the actions into the form meta header.',
      draftRevision: 1,
      draftTitle: 'OpenClaw 기능 UI수정',
      hasNoteConflict: true,
      markAutoSaveDraftFailed: vi.fn(),
      restoreDraft: vi.fn(),
      restoreDraftPreview: {
        title: '복구될 브라우저 초안',
        note: '## Local rewrite\n\nSaved from browser draft.',
        updatedAt: '2026-04-28T15:00:00.000Z',
      },
      updateNoteDraft: vi.fn(),
      updateTitleDraft: vi.fn(),
    });

    const html = renderTaskEditForm();

    expect(html).toContain('name="baseNoteFingerprint"');
    expect(html).toContain('value="task-note:v1:42:deadbeef"');
    expect(html).toContain('name="baseTitleFingerprint"');
    expect(html).toContain('value="task-title:v1:18:feedface"');
    expect(html).toContain('Server notes changed while this draft was open.');
    expect(html).toContain('Restore draft');
    expect(html).toContain('Restore preview · PROJ-187');
    expect(html).toContain('Saved ');
    expect(html).not.toContain('Restores into PROJ-187');
    expect(html).toContain('복구될 브라우저 초안');
    expect(html).toContain('Saved from browser draft.');
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
      autoSaveDraft: null,
      clearDraft: vi.fn(),
      draftBaseNoteFingerprint: 'task-note:v1:42:deadbeef',
      draftBaseTitleFingerprint: 'task-title:v1:18:feedface',
      draftNote: 'Move the actions into the form meta header.',
      draftRevision: 1,
      draftTitle: 'OpenClaw 기능 UI수정',
      hasNoteConflict: true,
      markAutoSaveDraftFailed: vi.fn(),
      restoreDraft,
      restoreDraftPreview: null,
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
              dispatchTarget: null,
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

  it('dismisses the current draft warning without restoring the draft', () => {
    const restoreDraft = vi.fn();
    useTaskOfflineDraftMock.mockReturnValueOnce({
      canRestoreDraft: true,
      autoSaveDraft: null,
      clearDraft: vi.fn(),
      draftBaseNoteFingerprint: 'task-note:v1:42:deadbeef',
      draftBaseTitleFingerprint: 'task-title:v1:18:feedface',
      draftNote: 'Move the actions into the form meta header.',
      draftRevision: 1,
      draftTitle: 'OpenClaw 기능 UI수정',
      hasNoteConflict: true,
      markAutoSaveDraftFailed: vi.fn(),
      restoreDraft,
      restoreDraftPreview: null,
      updateNoteDraft: vi.fn(),
      updateTitleDraft: vi.fn(),
    });

    const { container } = render(
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
              dispatchTarget: null,
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

    expect(container.textContent).toContain('Server notes changed while this draft was open');

    const dismissButton = container.querySelector('button[aria-label="Dismiss draft warning"]');
    if (!dismissButton) {
      throw new Error('Draft warning dismiss button did not render.');
    }

    fireEvent.click(dismissButton);

    expect(container.textContent).not.toContain('Server notes changed while this draft was open');
    expect(container.textContent).not.toContain('Restore draft');
    expect(restoreDraft).not.toHaveBeenCalled();
    expect(container.querySelector('[data-component="LiveMarkdownEditor"]')).not.toBeNull();
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

  it('disables automatic focus for the edit task notes editor', () => {
    renderTaskEditForm();

    const notesEditorProps = liveMarkdownEditorPropsMock.mock.calls[0]?.[0] as
      | { name: string; autoFocus?: boolean }
      | undefined;

    expect(notesEditorProps?.name).toBe('noteMd');
    expect(notesEditorProps?.autoFocus).toBe(false);
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

  it('queues offline task edits with the draft fingerprint and keeps the draft until replay settles', async () => {
    const clearDraft = vi.fn();
    const queueTaskPatch = vi.fn().mockResolvedValue({
      boardTask: {
        id: '1',
        taskKey: 'PROJ-187',
        branch: null,
        title: 'Offline rename',
        note: '## Offline note',
        status: 'todo' as const,
        sortOrder: 'a0',
        taskPriority: 'none',
        dueAt: null,
        engine: null,
        runState: null,
        runStateUpdatedAt: null,
        project: { id: 'project-1', name: 'Project Manager', projectKey: 'PROJ' },
        updatedAt: '2026-04-28T16:00:00.000Z',
        archivedAt: null,
        labels: [],
      },
      focusedTask: {
        id: '1',
        taskKey: 'PROJ-187',
        title: 'Offline rename',
        branch: null,
        note: '## Offline note',
        projectId: 'project-1',
        labelIds: [],
        labels: [],
        taskPriority: 'none',
        status: 'todo' as const,
        engine: null,
        dispatchTarget: null,
        runState: null,
        runStateUpdatedAt: null,
        workLogs: [],
      },
    });
    let submitTaskUpdate: ((form: HTMLFormElement) => Promise<void>) | undefined;

    useOfflineStatusMock.mockReturnValueOnce({ online: false });
    useBoardOfflineSyncMock.mockReturnValueOnce({
      online: false,
      queueTaskCreate: vi.fn(),
      queueTaskMove: vi.fn(),
      queueTaskPatch,
    });
    useTaskOfflineDraftMock.mockReturnValueOnce({
      canRestoreDraft: false,
      autoSaveDraft: null,
      clearDraft,
      draftBaseNoteFingerprint: 'task-note:v1:42:deadbeef',
      draftBaseTitleFingerprint: 'task-title:v1:18:feedface',
      draftNote: '## Original note',
      draftRevision: 0,
      draftTitle: 'OpenClaw 기능 UI수정',
      hasNoteConflict: false,
      hasTitleConflict: false,
      markAutoSaveDraftFailed: vi.fn(),
      restoreDraft: vi.fn(),
      restoreDraftPreview: null,
      updateNoteDraft: vi.fn(),
      updateTitleDraft: vi.fn(),
    });
    useAutoSaveMock.mockImplementationOnce((_formRef, _delay, options) => {
      submitTaskUpdate = options.submit;
      return {
        markDirty: vi.fn(),
        triggerSave: vi.fn(),
        flushSave: vi.fn(),
        syncSnapshot: vi.fn(),
        status: 'idle',
        isDirty: false,
        isDirtyRef: { current: false },
      };
    });

    const onTaskUpdated = vi.fn();
    const { container } = render(
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
              dispatchTarget: null,
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

    const form = container.querySelector('form');
    if (!form || !submitTaskUpdate) {
      throw new Error('Task edit form did not render an autosave submit handler.');
    }

    const titleInput = document.createElement('input');
    titleInput.name = 'title';
    titleInput.value = 'Offline rename';
    form.appendChild(titleInput);

    const noteInput = document.createElement('textarea');
    noteInput.name = 'noteMd';
    noteInput.value = '## Offline note';
    form.appendChild(noteInput);

    const taskPriorityInput = document.createElement('input');
    taskPriorityInput.name = 'taskPriority';
    taskPriorityInput.value = 'none';
    form.appendChild(taskPriorityInput);

    await submitTaskUpdate(form);

    expect(queueTaskPatch).toHaveBeenCalledWith({
      taskKey: 'PROJ-187',
      title: 'Offline rename',
      note: '## Offline note',
      labelIds: [],
      labels: [],
      taskPriority: 'none',
      status: 'todo',
      baseNoteFingerprint: 'task-note:v1:42:deadbeef',
      baseTitleFingerprint: 'task-title:v1:18:feedface',
    });
    expect(onTaskUpdated).toHaveBeenCalledWith({
      boardTask: expect.objectContaining({ taskKey: 'PROJ-187' }),
      focusedTask: expect.objectContaining({ taskKey: 'PROJ-187' }),
    });
    expect(clearDraft).not.toHaveBeenCalled();
  });

  it('auto-saves a non-conflicting draft through the update action without showing the restore warning', async () => {
    const effects: Array<() => void | (() => void)> = [];
    useEffectMock.mockImplementation((effect: () => void | (() => void)) => {
      effects.push(effect);
    });
    const clearDraft = vi.fn();
    const updateTodoAction = vi.fn(async (_prevState: unknown, formData: FormData) => ({
      ok: true as const,
      boardTask: {
        id: '1',
        taskKey: 'PROJ-187',
        branch: null,
        title: String(formData.get('title')),
        note: String(formData.get('noteMd')),
        status: 'todo' as const,
        sortOrder: 'a0',
        taskPriority: 'none',
        dueAt: null,
        engine: null,
        runState: null,
        runStateUpdatedAt: null,
        project: { id: 'project-1', name: 'Project Manager', projectKey: 'PROJ' },
        updatedAt: '2026-04-28T16:00:00.000Z',
        archivedAt: null,
        labels: [],
      },
    }));
    useTaskOfflineDraftMock.mockReturnValueOnce({
      canRestoreDraft: false,
      autoSaveDraft: {
        title: 'Offline rename',
        note: '## Offline note',
        baseTitleFingerprint: 'task-title:v1:18:feedface',
        baseNoteFingerprint: 'task-note:v1:42:deadbeef',
        updatedAt: '2026-04-28T15:00:00.000Z',
      },
      clearDraft,
      draftBaseNoteFingerprint: 'task-note:v1:42:deadbeef',
      draftBaseTitleFingerprint: 'task-title:v1:18:feedface',
      draftNote: 'Move the actions into the form meta header.',
      draftRevision: 0,
      draftTitle: 'OpenClaw 기능 UI수정',
      hasNoteConflict: false,
      hasTitleConflict: false,
      markAutoSaveDraftFailed: vi.fn(),
      restoreDraft: vi.fn(),
      restoreDraftPreview: null,
      updateNoteDraft: vi.fn(),
      updateTitleDraft: vi.fn(),
    });

    const onTaskUpdated = vi.fn();
    const { container } = render(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <TaskEditForm
            editableTodo={{
              id: '1',
              taskKey: 'PROJ-187',
              title: 'OpenClaw 기능 UI수정',
              note: 'Move the actions into the form meta header.',
              projectId: 'project-1',
              labelIds: ['11111111-1111-4111-8111-111111111111'],
              labels: [
                {
                  id: '11111111-1111-4111-8111-111111111111',
                  name: 'Stale label',
                  color: null,
                },
              ],
              taskPriority: 'high',
              status: 'todo',
              engine: 'codex',
              dispatchTarget: null,
              runState: 'queued',
              runStateUpdatedAt: null,
              workLogs: [],
            }}
            projects={[{ id: 'project-1', name: 'Project Manager' }]}
            todoLabels={[]}
            taskPriorityOptions={[
              { value: 'none', label: 'None' },
              { value: 'high', label: 'High' },
            ]}
            updateTodoAction={updateTodoAction}
            onTaskUpdated={onTaskUpdated}
          />
        </TerminologyProvider>
      </MantineProvider>,
    );

    const form = container.querySelector('form');
    if (!form) throw new Error('Task edit form did not render.');
    const titleInput = document.createElement('input');
    titleInput.name = 'title';
    titleInput.value = 'Visible title';
    form.appendChild(titleInput);

    for (const effect of effects) {
      effect();
    }

    await waitFor(() => {
      expect(updateTodoAction).toHaveBeenCalledTimes(1);
    });
    const submittedFormData = updateTodoAction.mock.calls[0]?.[1] as FormData;
    expect(submittedFormData.get('title')).toBe('Offline rename');
    expect(submittedFormData.get('noteMd')).toBe('## Offline note');
    expect(submittedFormData.get('baseTitleFingerprint')).toBe('task-title:v1:18:feedface');
    expect(submittedFormData.get('baseNoteFingerprint')).toBe('task-note:v1:42:deadbeef');
    expect(submittedFormData.getAll('labelIds')).toEqual(['11111111-1111-4111-8111-111111111111']);
    expect(submittedFormData.get('projectId')).toBe('project-1');
    expect(submittedFormData.get('runState')).toBe('queued');
    expect(submittedFormData.get('status')).toBe('todo');
    expect(submittedFormData.get('taskPriority')).toBe('high');
    expect(clearDraft).toHaveBeenCalledTimes(1);
    expect(onTaskUpdated).toHaveBeenCalledWith({
      boardTask: expect.objectContaining({ title: 'Offline rename' }),
      focusedTask: undefined,
    });
    expect(container.textContent).not.toContain('A saved local draft is available');
  });

  it('does not replay the same auto-save draft after a successful save re-render', async () => {
    const effects: Array<() => void | (() => void)> = [];
    useEffectMock.mockImplementation((effect: () => void | (() => void)) => {
      effects.push(effect);
    });
    const clearDraft = vi.fn();
    const autoSaveDraft = {
      title: 'Offline rename',
      note: '## Offline note',
      baseTitleFingerprint: 'task-title:v1:18:feedface',
      baseNoteFingerprint: 'task-note:v1:42:deadbeef',
      updatedAt: '2026-04-28T15:00:00.000Z',
    };
    const updateTodoAction = vi.fn(async () => ({
      ok: true as const,
      boardTask: {
        id: '1',
        taskKey: 'PROJ-187',
        branch: null,
        title: autoSaveDraft.title,
        note: autoSaveDraft.note,
        status: 'todo' as const,
        sortOrder: 'a0',
        taskPriority: 'none',
        dueAt: null,
        engine: null,
        runState: null,
        runStateUpdatedAt: null,
        project: { id: 'project-1', name: 'Project Manager', projectKey: 'PROJ' },
        updatedAt: '2026-04-28T16:00:00.000Z',
        archivedAt: null,
        labels: [],
      },
    }));
    useTaskOfflineDraftMock.mockReturnValue({
      canRestoreDraft: false,
      autoSaveDraft,
      clearDraft,
      draftBaseNoteFingerprint: 'task-note:v1:42:deadbeef',
      draftBaseTitleFingerprint: 'task-title:v1:18:feedface',
      draftNote: 'Move the actions into the form meta header.',
      draftRevision: 0,
      draftTitle: 'OpenClaw 기능 UI수정',
      hasNoteConflict: false,
      hasTitleConflict: false,
      markAutoSaveDraftFailed: vi.fn(),
      restoreDraft: vi.fn(),
      restoreDraftPreview: null,
      updateNoteDraft: vi.fn(),
      updateTitleDraft: vi.fn(),
    });

    const renderForm = (onTaskUpdated: () => void) => (
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
              dispatchTarget: null,
              runState: null,
              runStateUpdatedAt: null,
              workLogs: [],
            }}
            projects={[{ id: 'project-1', name: 'Project Manager' }]}
            todoLabels={[]}
            taskPriorityOptions={[{ value: 'none', label: 'None' }]}
            updateTodoAction={updateTodoAction}
            onTaskUpdated={onTaskUpdated}
          />
        </TerminologyProvider>
      </MantineProvider>
    );

    const { rerender } = render(renderForm(vi.fn()));

    for (const effect of effects) {
      effect();
    }

    await waitFor(() => {
      expect(updateTodoAction).toHaveBeenCalledTimes(1);
    });
    expect(clearDraft).toHaveBeenCalledTimes(1);

    effects.length = 0;
    rerender(renderForm(vi.fn()));
    for (const effect of effects) {
      effect();
    }
    await Promise.resolve();

    expect(updateTodoAction).toHaveBeenCalledTimes(1);
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

  it('passes the saved task dispatch target into the dispatch actions', () => {
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
              dispatchTarget: 'hermes-telegram',
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

    expect(taskCopyActionsPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchTarget: 'hermes-telegram',
      }),
    );
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
              dispatchTarget: null,
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

  it('submits UI comments through the queued dispatch flow', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        comment: {
          id: 'comment-1',
          task_id: '1',
          project_id: 'project-1',
          parent_comment_id: null,
          author_type: 'user',
          author_name: 'Owner',
          body: 'Please check this',
          run_state: 'queued',
          run_state_updated_at: '2026-05-05T00:00:00.000Z',
          engine: 'codex',
          dispatch_target: 'hermes-telegram',
          error_message: null,
          metadata: null,
          created_at: '2026-05-05T00:00:00.000Z',
          updated_at: '2026-05-05T00:00:00.000Z',
        },
        dispatch: {
          objective: 'comment',
          task_key: 'PROJ-187',
          comment_id: 'comment-1',
          dispatch_target: 'hermes-telegram',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

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
              dispatchTarget: 'hermes-telegram',
              runState: null,
              runStateUpdatedAt: null,
              workLogs: [],
            }}
            projects={[{ id: 'project-1', name: 'Project Manager' }]}
            todoLabels={[]}
            taskPriorityOptions={[{ value: 'none', label: 'None' }]}
            updateTodoAction={vi.fn(async () => ({ ok: true as const }))}
          />
        </TerminologyProvider>
      </MantineProvider>,
    );

    fireEvent.change(screen.getByLabelText('Add task comment'), {
      target: { value: 'Please check this' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/todos/PROJ-187/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Please check this' }),
      });
    });
    expect(await screen.findByText('queued')).toBeTruthy();
  });
});
