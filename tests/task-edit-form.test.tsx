// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const formAction = vi.hoisted(() => vi.fn());
const useActionStateMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
const taskCopyActionsPropsMock = vi.hoisted(() => vi.fn());
const liveMarkdownEditorPropsMock = vi.hoisted(() => vi.fn());
const useAutoSaveMock = vi.hoisted(() => vi.fn());
const useBoardOfflineSyncMock = vi.hoisted(() => vi.fn());
const useOfflineStatusMock = vi.hoisted(() => vi.fn());
const useTaskOfflineDraftMock = vi.hoisted(() => vi.fn());
const setTaskEditRefreshBlockedMock = vi.hoisted(() => vi.fn());
const taskLabelPickerPropsMock = vi.hoisted(() => vi.fn());
const taskMetadataPriorityPickerPropsMock = vi.hoisted(() => vi.fn());

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useActionState: useActionStateMock,
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
  getSendShortcutLabel: () => 'Cmd+Enter',
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

vi.mock('@/app/components/task-metadata-controls', () => ({
  TaskMetadataPriorityPicker: (props: {
    initialPriority?: string;
    label: string;
    name?: string;
    priorityOptions: Array<{ value: string; label: string }>;
    onChange?: (priority: string) => void;
  }) => {
    taskMetadataPriorityPickerPropsMock(props);
    const [selectedPriority, setSelectedPriority] = React.useState(props.initialPriority ?? 'none');

    return React.createElement(
      'div',
      { 'data-component': 'TaskMetadataPriorityPicker' },
      React.createElement('input', {
        type: 'hidden',
        name: props.name ?? 'taskPriority',
        value: selectedPriority,
        readOnly: true,
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          'aria-label': props.label,
          'data-task-priority-value': selectedPriority,
        },
        selectedPriority,
      ),
      props.priorityOptions.map((option) =>
        React.createElement(
          'button',
          {
            key: option.value,
            type: 'button',
            role: 'menuitemradio',
            'aria-checked': selectedPriority === option.value,
            'aria-label': option.label,
            'data-task-priority-value': option.value,
            onClick: () => {
              setSelectedPriority(option.value);
              props.onChange?.(option.value);
            },
          },
          option.label,
        ),
      ),
    );
  },
}));

import { TaskEditForm } from '@/app/components/task-edit-form';
import { TerminologyProvider } from '@/app/components/terminology-provider';
import { KITCHEN_TERMINOLOGY } from '@/lib/terminology';

function taskEditFormElement(
  overrides: Partial<{
    onTaskQueued: (taskKey: string, queuedAt: string) => void;
    onDispatchQueued: () => void;
    onTaskUpdated: (tasks: { boardTask?: unknown; focusedTask?: unknown }) => void;
  }> = {},
) {
  return (
    <MantineProvider>
      <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
        <TaskEditForm
          editableTodo={{
            id: '1',
            taskKey: 'PROJ-187',
            title: 'Update OpenClaw feature UI',
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
    </MantineProvider>
  );
}

function renderTaskEditForm(
  overrides: Partial<{
    onTaskQueued: (taskKey: string, queuedAt: string) => void;
    onDispatchQueued: () => void;
    onTaskUpdated: (tasks: { boardTask?: unknown; focusedTask?: unknown }) => void;
  }> = {},
) {
  return renderToStaticMarkup(taskEditFormElement(overrides));
}

function renderTaskEditFormClient(
  overrides: Partial<{
    onTaskQueued: (taskKey: string, queuedAt: string) => void;
    onDispatchQueued: () => void;
    onTaskUpdated: (tasks: { boardTask?: unknown; focusedTask?: unknown }) => void;
  }> = {},
) {
  return render(taskEditFormElement(overrides));
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
    useActionStateMock.mockReset();
    setTaskEditRefreshBlockedMock.mockReset();
    taskLabelPickerPropsMock.mockReset();
    taskMetadataPriorityPickerPropsMock.mockReset();

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
      draftTitle: 'Update OpenClaw feature UI',
      hasNoteConflict: false,
      hasTitleConflict: false,
      markAutoSaveDraftFailed: vi.fn(),
      restoreDraft: vi.fn(),
      restoreDraftPreview: null,
      updateNoteDraft: vi.fn(),
      updateTitleDraft: vi.fn(),
    });
    vi.stubGlobal('requestAnimationFrame', ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('renders dispatch controls in the bottom bar when branch context is available', () => {
    const html = renderTaskEditForm();

    expect(html).toContain('task-edit-meta-header');
    expect(html).toContain('data-panel="task-edit-sidebar"');
    expect(html).not.toContain('data-layout="with-dispatch"');
    expect(html).toContain('data-panel="task-edit-bottom-dispatch"');
    expect(html).not.toContain('data-panel="task-edit-dispatch"');
    expect(html).not.toContain('task-edit-meta-actions');
    expect(html).toContain('Dispatch');
    expect(html).toContain('Notes');
    expect(html).toContain('data-panel="task-edit-activity"');
    expect(html).toContain('Ticket settings');
    expect(html).not.toContain('Ticket title');
    expect(taskCopyActionsPropsMock.mock.calls[0]?.[0]).toMatchObject({
      placement: 'bottom',
      suppressShortcut: false,
    });
    expect(taskCopyActionsPropsMock.mock.calls[0]?.[0]).not.toHaveProperty('onAskRequested');
    expect(taskCopyActionsPropsMock.mock.calls[0]?.[0]).not.toHaveProperty('noteMarkdown');
  });

  it('renders the Notes mode switch on the Notes header row instead of the editor header', () => {
    const html = renderTaskEditForm();

    expect(html).toContain('Notes');
    expect(html).toContain('aria-label="Notes mode"');
    expect(html).not.toContain('Ticket content (Markdown)');
  });

  it('omits the comment shortcut label from static markup until client mount', () => {
    const html = renderTaskEditForm();

    expect(html).toContain('data-panel="task-edit-comments"');
    expect(html).not.toContain('Cmd+Enter');
    expect(html).not.toContain('Ctrl+Enter');
  });

  it('wires the shared task label picker with the default trigger metadata', () => {
    renderTaskEditForm();

    const labelPickerProps = taskLabelPickerPropsMock.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;

    expect(labelPickerProps).toEqual(
      expect.objectContaining({
        projectId: 'project-1',
        selectedLabelIds: [],
        labelOptions: [],
        triggerAriaLabel: 'Edit labels for Update OpenClaw feature UI',
        triggerLabel: 'Labels',
        emptyStateLabel: 'Select labels',
        searchPlaceholder: 'Search labels',
      }),
    );
    expect(labelPickerProps).not.toHaveProperty('renderTrigger');
  });

  it('updates task priority through the shared picker and triggers immediate autosave', async () => {
    const triggerSave = vi.fn();
    useAutoSaveMock.mockReturnValueOnce({
      markDirty: vi.fn(),
      triggerSave,
      flushSave: vi.fn(),
      syncSnapshot: vi.fn(),
      status: 'idle',
      isDirty: false,
      isDirtyRef: { current: false },
    });

    render(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <TaskEditForm
            editableTodo={{
              id: '1',
              taskKey: 'PROJ-187',
              title: 'Update OpenClaw feature UI',
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
            taskPriorityOptions={[
              { value: 'none', label: 'None' },
              { value: 'high', label: 'High' },
            ]}
            updateTodoAction={vi.fn(async () => ({ ok: true as const }))}
            branchName="task/proj-187/openclaw-gineung-uisujeong"
            telegramEnabled
          />
        </TerminologyProvider>
      </MantineProvider>,
    );

    const priorityInput = document.querySelector<HTMLInputElement>('input[name="taskPriority"]');

    expect(priorityInput?.value).toBe('none');
    expect(taskMetadataPriorityPickerPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialPriority: 'none',
        label: 'Ticket priority',
        priorityOptions: [
          { value: 'none', label: 'None' },
          { value: 'high', label: 'High' },
        ],
      }),
    );

    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'High' }));

    await waitFor(() => {
      expect(priorityInput?.value).toBe('high');
    });
    expect(triggerSave).toHaveBeenCalledWith(0);
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
    expect(html).not.toContain('data-panel="task-edit-bottom-dispatch"');
    expect(html).toContain('data-panel="task-edit-sidebar"');
    expect(html).not.toContain('data-layout="single"');
    expect(html).not.toContain('data-layout="with-dispatch"');
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
      draftTitle: 'Update OpenClaw feature UI',
      hasNoteConflict: true,
      markAutoSaveDraftFailed: vi.fn(),
      restoreDraft: vi.fn(),
      restoreDraftPreview: {
        title: 'Browser draft to restore',
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
    expect(html).toContain('Browser draft to restore');
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
      draftTitle: 'Update OpenClaw feature UI',
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
              title: 'Update OpenClaw feature UI',
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
      draftTitle: 'Update OpenClaw feature UI',
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
              title: 'Update OpenClaw feature UI',
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
      draftTitle: 'Update OpenClaw feature UI',
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
              title: 'Update OpenClaw feature UI',
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
      draftTitle: 'Update OpenClaw feature UI',
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
              title: 'Update OpenClaw feature UI',
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
      draftTitle: 'Update OpenClaw feature UI',
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
              title: 'Update OpenClaw feature UI',
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

    await waitFor(() => {
      expect(updateTodoAction).toHaveBeenCalledTimes(1);
    });
    expect(clearDraft).toHaveBeenCalledTimes(1);

    rerender(renderForm(vi.fn()));
    await waitFor(() => {
      expect(updateTodoAction).toHaveBeenCalledTimes(1);
    });

    expect(updateTodoAction).toHaveBeenCalledTimes(1);
  });

  it('blocks polling while the task form has unsaved edits', async () => {
    useAutoSaveMock.mockReturnValueOnce({
      markDirty: vi.fn(),
      triggerSave: vi.fn(),
      flushSave: vi.fn(),
      syncSnapshot: vi.fn(),
      status: 'idle',
      isDirty: true,
      isDirtyRef: { current: true },
    });

    renderTaskEditFormClient();

    await waitFor(() => {
      expect(setTaskEditRefreshBlockedMock).toHaveBeenCalledWith(true);
    });

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

    renderTaskEditFormClient();

    await waitFor(() => {
      expect(setTaskEditRefreshBlockedMock).toHaveBeenCalledWith(false);
    });
  });

  it('keeps polling blocked while autosave transitions from dirty to saving', async () => {
    useAutoSaveMock.mockReturnValueOnce({
      markDirty: vi.fn(),
      triggerSave: vi.fn(),
      flushSave: vi.fn(),
      syncSnapshot: vi.fn(),
      status: 'idle',
      isDirty: true,
      isDirtyRef: { current: true },
    });

    const { rerender } = renderTaskEditFormClient();
    await waitFor(() => {
      expect(setTaskEditRefreshBlockedMock).toHaveBeenLastCalledWith(true);
    });

    useAutoSaveMock.mockReturnValueOnce({
      markDirty: vi.fn(),
      triggerSave: vi.fn(),
      flushSave: vi.fn(),
      syncSnapshot: vi.fn(),
      status: 'saving',
      isDirty: false,
      isDirtyRef: { current: false },
    });

    rerender(taskEditFormElement());

    expect(setTaskEditRefreshBlockedMock.mock.calls).not.toContainEqual([false]);
    await waitFor(() => {
      expect(setTaskEditRefreshBlockedMock).toHaveBeenLastCalledWith(true);
    });
  });

  it('applies queued state before closing the modal after a successful dispatch send', () => {
    const onTaskQueued = vi.fn();
    const onDispatchQueued = vi.fn();

    renderTaskEditForm({ onTaskQueued, onDispatchQueued });

    expect(taskCopyActionsPropsMock.mock.calls[0]?.[0]).toMatchObject({
      telegramEnabled: true,
    });

    const taskCopyActionsProps = taskCopyActionsPropsMock.mock.calls[0]?.[0] as {
      onTaskQueued?: (taskKey: string, queuedAt: string, dispatchTarget: 'hermes-telegram') => void;
    };

    taskCopyActionsProps.onTaskQueued?.('PROJ-187', '2026-03-30T13:10:00.000Z', 'hermes-telegram');

    expect(onTaskQueued).toHaveBeenCalledWith(
      'PROJ-187',
      '2026-03-30T13:10:00.000Z',
      'hermes-telegram',
    );
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
              title: 'Update OpenClaw feature UI',
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

  it('refreshes the current route after a successful save when board reconciliation is unavailable', async () => {
    useActionStateMock.mockReturnValue([{ ok: true }, formAction]);

    renderTaskEditFormClient();

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it('does not refresh the route when a board-level task update callback is present', async () => {
    const onTaskUpdated = vi.fn();
    useActionStateMock.mockReturnValue([{ ok: true }, formAction]);

    renderTaskEditFormClient({ onTaskUpdated });

    await waitFor(() => {
      expect(onTaskUpdated).toHaveBeenCalledWith({
        boardTask: undefined,
        focusedTask: undefined,
      });
    });

    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('submits UI comments through the queued dispatch flow', async () => {
    const onTaskQueued = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 'comment-agent-1',
              author_type: 'agent',
              author_name: 'Codex',
              body: 'I checked this.',
              run_state: 'done',
              engine: 'codex',
              created_at: '2026-05-05T00:00:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
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
              title: 'Update OpenClaw feature UI',
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
            onTaskQueued={onTaskQueued}
          />
        </TerminologyProvider>
      </MantineProvider>,
    );

    expect(await screen.findByLabelText('Codex CLI comment')).toBeTruthy();
    expect(screen.queryByText('done')).toBeNull();
    const commentInput = screen.getByLabelText('Add task comment');
    expect(commentInput.classList.contains('mantine-Textarea-input')).toBe(true);
    expect(commentInput.closest('[data-panel="task-edit-comments"]')).not.toBeNull();
    expect((await screen.findByText('I checked this.')).closest('.markdown-output')).not.toBeNull();

    fireEvent.change(commentInput, {
      target: { value: 'Please check this' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/todos/PROJ-187/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'Please check this',
          engine: 'codex',
          dispatchTarget: 'hermes-telegram',
        }),
      });
    });
    expect(onTaskQueued).toHaveBeenCalledWith(
      'PROJ-187',
      '2026-05-05T00:00:00.000Z',
      'hermes-telegram',
    );
    expect(await screen.findByText('Owner')).toBeTruthy();
    expect(await screen.findByText('Comment queued.')).toBeTruthy();
    expect(screen.queryByText('queued')).toBeNull();
    expect(screen.getByLabelText('User comment')).toBeTruthy();
  });

  it('submits comments with the current dispatch selection from the shared send controls', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'comment-1',
            task_id: '1',
            project_id: 'project-1',
            parent_comment_id: null,
            author_type: 'user',
            author_name: 'Owner',
            body: 'Use the selected target',
            run_state: 'queued',
            run_state_updated_at: '2026-05-05T00:00:00.000Z',
            engine: 'gemini-cli',
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
            engine: 'gemini-cli',
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
              title: 'Update OpenClaw feature UI',
              note: 'Move the actions into the form meta header.',
              projectId: 'project-1',
              labelIds: [],
              labels: [],
              taskPriority: 'none',
              status: 'todo',
              engine: 'codex',
              dispatchTarget: 'telegram',
              runState: null,
              runStateUpdatedAt: null,
              workLogs: [],
            }}
            projects={[{ id: 'project-1', name: 'Project Manager' }]}
            todoLabels={[]}
            taskPriorityOptions={[{ value: 'none', label: 'None' }]}
            updateTodoAction={vi.fn(async () => ({ ok: true as const }))}
            telegramEnabled
          />
        </TerminologyProvider>
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(taskCopyActionsPropsMock).toHaveBeenCalled();
    });
    const taskCopyActionsProps = taskCopyActionsPropsMock.mock.calls[0]?.[0] as {
      onDispatchSelectionChange?: (selection: {
        engine: string | null;
        dispatchTarget: 'telegram' | 'hermes-telegram' | null;
      }) => void;
    };
    await act(async () => {
      taskCopyActionsProps.onDispatchSelectionChange?.({
        engine: 'gemini-cli',
        dispatchTarget: 'hermes-telegram',
      });
    });

    const commentInput = screen.getByLabelText('Add task comment');
    fireEvent.change(commentInput, {
      target: { value: 'Use the selected target' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/todos/PROJ-187/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'Use the selected target',
          engine: 'gemini-cli',
          dispatchTarget: 'hermes-telegram',
        }),
      });
    });
  });

  it('shows comment dispatch failures instead of announcing a queued comment', async () => {
    const onTaskQueued = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      })
      .mockResolvedValueOnce({
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
            run_state: 'failed',
            run_state_updated_at: '2026-05-05T00:00:00.000Z',
            engine: 'codex',
            dispatch_target: 'hermes-telegram',
            error_message: 'Telegram bot token is invalid. Save Telegram settings again.',
            metadata: null,
            created_at: '2026-05-05T00:00:00.000Z',
            updated_at: '2026-05-05T00:00:00.000Z',
          },
          dispatch: {
            objective: 'comment',
            task_key: 'PROJ-187',
            comment_id: 'comment-1',
            dispatch_target: 'hermes-telegram',
            status: 'failed',
            error: 'Telegram bot token is invalid. Save Telegram settings again.',
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
              title: 'Update OpenClaw feature UI',
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
            onTaskQueued={onTaskQueued}
          />
        </TerminologyProvider>
      </MantineProvider>,
    );

    await screen.findAllByText('No comments yet.');
    const commentInput = screen.getByLabelText('Add task comment');
    fireEvent.change(commentInput, {
      target: { value: 'Please check this' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));

    expect(
      await screen.findAllByText('Telegram bot token is invalid. Save Telegram settings again.'),
    ).toHaveLength(2);
    expect(screen.queryByText('Comment queued.')).toBeNull();
    expect(onTaskQueued).not.toHaveBeenCalled();
  });

  it('moves the Mod+Enter shortcut to Add comment as soon as the comment composer is focused', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'comment-keyboard',
            task_id: '1',
            project_id: 'project-1',
            parent_comment_id: null,
            author_type: 'user',
            author_name: 'Owner',
            body: 'Keyboard follow-up',
            run_state: null,
            run_state_updated_at: null,
            engine: 'codex',
            dispatch_target: null,
            error_message: null,
            metadata: null,
            created_at: '2026-05-05T00:00:00.000Z',
            updated_at: '2026-05-05T00:00:00.000Z',
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    renderTaskEditFormClient();

    const submitButton = screen.getByRole('button', { name: 'Add comment' });
    const shortcutSlot = submitButton.querySelector('[data-visible]');
    expect(shortcutSlot?.getAttribute('data-visible')).toBe('false');
    expect(shortcutSlot?.getAttribute('aria-hidden')).toBe('true');

    const commentInput = screen.getByLabelText('Add task comment');
    fireEvent.focus(commentInput);

    await waitFor(() => {
      const focusedShortcutSlot = screen
        .getByRole('button', { name: /Add comment/ })
        .querySelector('[data-visible]');

      expect(focusedShortcutSlot?.getAttribute('data-visible')).toBe('true');
      expect(focusedShortcutSlot?.getAttribute('aria-hidden')).toBe('false');
      expect(screen.getByText('Cmd+Enter').classList.contains('task-dispatch-send-shortcut')).toBe(
        true,
      );
    });
    await waitFor(() => {
      expect(taskCopyActionsPropsMock.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({
          suppressShortcut: true,
        }),
      );
    });

    fireEvent.keyDown(commentInput, { key: 'Enter', metaKey: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.change(commentInput, {
      target: { value: 'Keyboard follow-up' },
    });
    fireEvent.keyDown(commentInput, { key: 'Enter', metaKey: true });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/todos/PROJ-187/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Keyboard follow-up', engine: 'codex' }),
      });
    });

    fireEvent.blur(commentInput);

    await waitFor(() => {
      expect(taskCopyActionsPropsMock.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({
          suppressShortcut: false,
        }),
      );
      const blurredShortcutSlot = screen
        .getByRole('button', { name: 'Add comment' })
        .querySelector('[data-visible]');

      expect(blurredShortcutSlot?.getAttribute('data-visible')).toBe('false');
      expect(blurredShortcutSlot?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('announces the empty comments state through a polite status', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        comments: [],
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
              title: 'Update OpenClaw feature UI',
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

    expect(await screen.findAllByText('No comments yet.')).toHaveLength(2);
    expect(screen.getByRole('status').textContent).toBe('No comments yet.');
  });

  it('labels fallback comment icons and author metadata by author type', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        comments: [
          {
            id: 'comment-agent-1',
            author_type: 'agent',
            author_name: null,
            body: 'Agent comment body.',
            run_state: null,
            engine: null,
            created_at: '2026-05-05T00:00:00.000Z',
          },
          {
            id: 'comment-system-1',
            author_type: 'system',
            author_name: null,
            body: 'System comment body.',
            run_state: null,
            engine: 'future-engine',
            created_at: '2026-05-05T00:00:00.000Z',
          },
        ],
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
              title: 'Update OpenClaw feature UI',
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

    expect(await screen.findByLabelText('Agent comment')).toBeTruthy();
    expect(await screen.findByLabelText('System comment')).toBeTruthy();
    expect(
      screen
        .getByText('Agent')
        .closest('[data-comment-author]')
        ?.getAttribute('data-comment-author'),
    ).toBe('agent');
    expect(
      screen
        .getByText('System')
        .closest('[data-comment-author]')
        ?.getAttribute('data-comment-author'),
    ).toBe('system');
  });

  it('announces when a comment refresh starts', async () => {
    let finishRefresh:
      | ((value: { ok: boolean; json: () => Promise<{ comments: unknown[] }> }) => void)
      | undefined;
    const refreshPromise = new Promise<{
      ok: boolean;
      json: () => Promise<{ comments: unknown[] }>;
    }>((resolve) => {
      finishRefresh = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 'comment-agent-1',
              author_type: 'agent',
              author_name: 'Codex',
              body: 'I checked this.',
              run_state: null,
              engine: 'codex',
              created_at: '2026-05-05T00:00:00.000Z',
            },
          ],
        }),
      })
      .mockReturnValueOnce(refreshPromise);
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <TaskEditForm
            editableTodo={{
              id: '1',
              taskKey: 'PROJ-187',
              title: 'Update OpenClaw feature UI',
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

    expect((await screen.findByRole('status')).textContent).toBe('Loaded 1 comment.');

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('Loading comments.');
    });

    finishRefresh?.({
      ok: true,
      json: async () => ({ comments: [] }),
    });
  });
});
