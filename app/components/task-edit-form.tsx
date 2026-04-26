'use client';

import {
  ActionIcon,
  Alert,
  Group,
  Loader,
  Menu,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import {
  type ReactNode,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useBoardOfflineSync } from '@/app/components/board-offline-sync-provider';
import { type EditorMode, LiveMarkdownEditor } from '@/app/components/live-markdown-editor';
import { MarkdownViewer } from '@/app/components/markdown-viewer';
import { useOfflineStatus } from '@/app/components/offline-status-provider';
import { StatusHistoryBreadcrumb } from '@/app/components/status-history-breadcrumb';
import { TaskCopyActions } from '@/app/components/task-copy-actions';
import { TaskPriorityIcon } from '@/app/components/task-priority-icon';
import { WorkLogTimeline } from '@/app/components/work-log-timeline';
import { shouldFlushAutoSaveOnBlur, useAutoSave } from '@/app/hooks/use-auto-save';
import { useTaskOfflineDraft } from '@/app/hooks/use-task-offline-draft';
import { type KanbanStatus, type KanbanTask } from '@/lib/kanban-helpers';
import type { EditableBoardTask } from '@/lib/kanban-store';
import { showErrorNotification } from '@/lib/notifications';
import { setTaskEditRefreshBlocked } from '@/lib/task-edit-refresh-guard';
import {
  buildTaskEditFieldRevisions,
  buildTaskEditRevision,
  shouldHydrateTaskEditRevision,
  type TaskEditFieldRevisions,
} from '@/lib/task-edit-sync';
import {
  parseTaskPriority,
  resolveTaskLabelSwatchColor,
  TASK_PRIORITY_LABEL,
  type TaskPriority,
} from '@/lib/task-meta';

import cardStyles from './cards.module.css';
import classes from './task-edit-form.module.css';
import { useTerminology } from './terminology-provider';

type ActionState =
  | { ok: true; boardTask?: KanbanTask | null; focusedTask?: EditableBoardTask | null }
  | { ok: false; message: string }
  | null;

export type TaskEditFormProps = {
  editableTodo: {
    id: string;
    taskKey: string;
    title: string;
    note: string | null;
    projectId: string | null;
    labelIds: string[];
    labels: Array<{ id: string; name: string; color: string | null }>;
    taskPriority: string;
    status: string;
    engine?: string | null;
    runState?: 'queued' | 'running' | null;
    runStateUpdatedAt?: string | null;
    workLogs?: Array<{
      id: string;
      title: string;
      detail?: string | null;
      engine?: string | null;
      workedAt: Date;
      createdAt: Date;
      todo?: { engine: string | null } | null;
    }>;
  };
  projects: Array<{ id: string; name: string }>;
  todoLabels: Array<{ id: string; name: string; color: string | null }>;
  taskPriorityOptions: Array<{ value: string; label: string }>;
  updateTodoAction: (prevState: unknown, formData: FormData) => Promise<ActionState>;
  branchName?: string | null;
  telegramEnabled?: boolean;
  hermesTelegramEnabled?: boolean;
  onTaskQueued?: (taskKey: string, queuedAt: string) => void;
  onDispatchQueued?: () => void;
  onTaskUpdated?: (result: {
    boardTask?: KanbanTask | null;
    focusedTask?: EditableBoardTask | null;
  }) => void;
};

type SectionHeadingProps = {
  title: string;
  helpText: string;
  aside?: ReactNode;
};

type TaskEditLabelOption = {
  id: string;
  name: string;
  color: string | null;
};

const TASK_PRIORITY_DETAIL: Record<TaskPriority, string> = {
  highest: 'Escalated, unblock first',
  high: 'Important, visible on card',
  medium: 'Useful, not urgent',
  none: 'No marker on card',
  low: 'Defer if needed',
  lowest: 'Parking lot',
};

function SectionHeading({ title, helpText, aside }: SectionHeadingProps) {
  return (
    <div className={classes.sectionHeaderRow}>
      <div className={classes.sectionHeader}>
        <div className={classes.sectionHeading}>
          <Text component="h2" fw={700} size="sm" className={classes.sectionTitle}>
            {title}
          </Text>
          <Tooltip label={helpText} withArrow multiline w={220}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              radius="xl"
              aria-label={`${title} help`}
              className={classes.sectionHelpTrigger}
            >
              <IconInfoCircle size={16} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>
      {aside}
    </div>
  );
}

type TaskEditLabelShortcutProps = {
  labelOptions: TaskEditLabelOption[];
  selectedLabelIds: string[];
  selectedLabels: TaskEditLabelOption[];
  taskTitle: string;
  onChange: (labelIds: string[]) => void;
};

function TaskEditLabelShortcut({
  labelOptions,
  selectedLabelIds,
  selectedLabels,
  taskTitle,
  onChange,
}: TaskEditLabelShortcutProps) {
  const hasSelectedLabels = selectedLabels.length > 0;

  const renderLabelInline = (label: TaskEditLabelOption) => (
    <>
      <span
        className={cardStyles.kanbanLabelHash}
        aria-hidden="true"
        style={{ color: resolveTaskLabelSwatchColor(label.color) }}
      >
        #
      </span>
      <span className={cardStyles.kanbanLabelName}>{label.name}</span>
    </>
  );

  const toggleLabel = (labelId: string) => {
    const nextLabelIds = selectedLabelIds.includes(labelId)
      ? selectedLabelIds.filter((currentLabelId) => currentLabelId !== labelId)
      : [...selectedLabelIds, labelId];

    onChange(nextLabelIds);
  };

  return (
    <div className={classes.labelShortcutField} data-task-edit-label-shortcut="true">
      <Text component="div" size="sm" fw={500} className={classes.labelShortcutLabel}>
        Labels
      </Text>
      <Menu position="bottom-start" shadow="md" withinPortal closeOnItemClick={false}>
        <Menu.Target>
          <UnstyledButton
            type="button"
            className={`${cardStyles.kanbanLabelShortcutButton} ${classes.labelShortcutButton}`}
            data-kanban-label-shortcut={hasSelectedLabels ? 'labels' : 'empty'}
            aria-label={`Edit labels for ${taskTitle}`}
          >
            {hasSelectedLabels ? (
              <span
                className={`${cardStyles.kanbanLabelShortcutSurface} ${classes.labelShortcutInlineList}`}
              >
                {selectedLabels.map((label) => (
                  <span
                    key={label.id}
                    className={cardStyles.kanbanLabelText}
                    data-task-edit-label="true"
                  >
                    {renderLabelInline(label)}
                  </span>
                ))}
              </span>
            ) : (
              <span
                className={`${cardStyles.kanbanLabelShortcutEmpty} ${classes.labelShortcutPlus}`}
                data-task-edit-empty-label-trigger="true"
              >
                +
              </span>
            )}
          </UnstyledButton>
        </Menu.Target>

        <Menu.Dropdown>
          {labelOptions.map((label) => {
            const isSelected = selectedLabelIds.includes(label.id);

            return (
              <Menu.Item
                key={label.id}
                role="menuitemcheckbox"
                aria-checked={isSelected}
                leftSection={
                  <span
                    className={cardStyles.kanbanLabelShortcutMenuHash}
                    aria-hidden="true"
                    style={{ color: resolveTaskLabelSwatchColor(label.color) }}
                  >
                    #
                  </span>
                }
                rightSection={isSelected ? <IconCheck size={14} /> : null}
                onClick={() => {
                  toggleLabel(label.id);
                }}
              >
                {label.name}
              </Menu.Item>
            );
          })}
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}

type TaskEditPriorityShortcutProps = {
  initialPriority: string;
  priorityOptions: Array<{ value: string; label: string }>;
  renderKey: string;
  taskTitle: string;
  onChange: () => void;
};

function TaskEditPriorityMark({ priority }: { priority: TaskPriority }) {
  if (priority === 'none') {
    return (
      <span
        className={classes.priorityShortcutNoneDot}
        data-task-edit-priority-none-dot="true"
        aria-hidden="true"
      />
    );
  }

  return <TaskPriorityIcon priority={priority} size={14} />;
}

function TaskEditPriorityShortcut({
  initialPriority,
  priorityOptions,
  renderKey,
  taskTitle,
  onChange,
}: TaskEditPriorityShortcutProps) {
  const [selectedPriority, setSelectedPriority] = useState(parseTaskPriority(initialPriority));
  const parsedPriorityOptions = priorityOptions.reduce<TaskPriority[]>((options, option) => {
    const priority = parseTaskPriority(option.value);

    return options.includes(priority) ? options : [...options, priority];
  }, []);
  const menuPriorities =
    parsedPriorityOptions.length > 0 ? parsedPriorityOptions : [parseTaskPriority(initialPriority)];
  const selectedLabel = TASK_PRIORITY_LABEL[selectedPriority];

  const selectPriority = (priority: TaskPriority) => {
    setSelectedPriority(priority);
    onChange();
  };

  return (
    <div className={classes.priorityShortcutField} data-task-edit-priority-shortcut="true">
      <Text component="div" size="sm" fw={500} className={classes.priorityShortcutLabel}>
        Task priority
      </Text>
      <input type="hidden" name="taskPriority" value={selectedPriority} />
      <Menu position="bottom-start" shadow="md" withinPortal>
        <Menu.Target>
          <UnstyledButton
            key={`priority-trigger:${renderKey}`}
            type="button"
            className={classes.priorityShortcutButton}
            aria-label={`Edit priority for ${taskTitle}`}
            data-task-edit-priority-trigger="true"
            data-task-edit-priority-value={selectedPriority}
          >
            <span className={classes.priorityShortcutValue}>
              <TaskEditPriorityMark priority={selectedPriority} />
              <span>{selectedLabel}</span>
            </span>
            <IconChevronDown
              size={13}
              aria-hidden="true"
              className={classes.priorityShortcutChevron}
            />
          </UnstyledButton>
        </Menu.Target>

        <Menu.Dropdown>
          {menuPriorities.map((priority) => {
            const isSelected = priority === selectedPriority;

            return (
              <Menu.Item
                key={priority}
                role="menuitemradio"
                aria-checked={isSelected}
                data-task-priority-value={priority}
                leftSection={
                  <span className={classes.priorityShortcutMenuIcon}>
                    <TaskEditPriorityMark priority={priority} />
                  </span>
                }
                rightSection={isSelected ? <IconCheck size={14} /> : null}
                onClick={() => {
                  selectPriority(priority);
                }}
              >
                <span className={classes.priorityShortcutMenuText}>
                  <span className={classes.priorityShortcutMenuLabel}>
                    {TASK_PRIORITY_LABEL[priority]}
                  </span>
                  <span className={classes.priorityShortcutMenuDetail}>
                    {TASK_PRIORITY_DETAIL[priority]}
                  </span>
                </span>
              </Menu.Item>
            );
          })}
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}

export function useTaskEditFormController({
  editableTodo,
  projects,
  todoLabels,
  updateTodoAction,
  onTaskUpdated,
}: TaskEditFormProps) {
  const { projectId, labelIds } = editableTodo;
  const router = useRouter();
  const incomingRevision = buildTaskEditRevision(editableTodo);
  const incomingFieldRevisions = buildTaskEditFieldRevisions(editableTodo);
  const boardOfflineSync = useBoardOfflineSync();
  const { online } = useOfflineStatus();
  const [idCopied, setIdCopied] = useState(false);
  const [fieldRenderKey, setFieldRenderKey] = useState(incomingRevision);
  const [fieldRevisions, setFieldRevisions] = useState(incomingFieldRevisions);
  const [selectedLabelIds, setSelectedLabelIds] = useState(labelIds);
  const {
    clearDraft,
    draftBaseNoteFingerprint,
    draftNote,
    draftRevision,
    draftTitle,
    hasNoteConflict,
    updateNoteDraft,
    updateTitleDraft,
  } = useTaskOfflineDraft(editableTodo.taskKey, editableTodo.title, editableTodo.note);
  const formId = `task-edit-form-${editableTodo.id}`;

  const copyTaskId = async () => {
    await navigator.clipboard.writeText(editableTodo.taskKey);
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 1500);
  };

  const formRef = useRef<HTMLFormElement>(null);
  const pendingHydrationRef = useRef<{
    revision: string;
    fieldRevisions: TaskEditFieldRevisions;
    labelIds: string[];
  } | null>(null);
  const [updateState, updateFormAction] = useActionState(updateTodoAction, null);
  const labelById = useMemo(
    () => new Map([...editableTodo.labels, ...todoLabels].map((label) => [label.id, label])),
    [editableTodo.labels, todoLabels],
  );
  const submitTaskUpdate = useCallback(
    async (form: HTMLFormElement) => {
      if (online || !boardOfflineSync) {
        form.requestSubmit();
        return;
      }

      const formData = new FormData(form);
      const title = String(formData.get('title') || '').trim();
      if (!title) {
        showErrorNotification('Title is required.');
        throw new Error('Title is required.');
      }

      const nextLabelIds = formData
        .getAll('labelIds')
        .map((value) => String(value))
        .filter(Boolean);
      const nextLabels = nextLabelIds
        .map((labelId) => labelById.get(labelId) ?? null)
        .filter((label): label is TaskEditLabelOption => label !== null);
      const result = await boardOfflineSync.queueTaskPatch({
        taskKey: editableTodo.taskKey,
        title,
        note: String(formData.get('noteMd') || ''),
        labelIds: nextLabelIds,
        labels: nextLabels,
        taskPriority: parseTaskPriority(String(formData.get('taskPriority') || 'none')),
        status: editableTodo.status as KanbanStatus,
      });

      onTaskUpdated?.(result);
      await clearDraft();
    },
    [
      boardOfflineSync,
      clearDraft,
      editableTodo.status,
      editableTodo.taskKey,
      labelById,
      onTaskUpdated,
      online,
    ],
  );
  const {
    markDirty,
    triggerSave,
    flushSave,
    syncSnapshot,
    status: saveStatus,
    isDirty,
    isDirtyRef,
  } = useAutoSave(formRef, 800, { submit: submitTaskUpdate });

  useEffect(() => {
    setTaskEditRefreshBlocked(isDirty || saveStatus === 'saving');
  }, [isDirty, saveStatus]);

  useEffect(() => {
    return () => {
      setTaskEditRefreshBlocked(false);
    };
  }, []);

  useEffect(() => {
    if (updateState && !updateState.ok) {
      showErrorNotification(updateState.message);
    }
  }, [updateState]);

  useEffect(() => {
    if (!updateState?.ok) return;
    if (onTaskUpdated) return;
    router.refresh();
  }, [onTaskUpdated, router, updateState]);

  useEffect(() => {
    if (updateState?.ok) {
      onTaskUpdated?.({
        boardTask: updateState.boardTask,
        focusedTask: updateState.focusedTask,
      });
    }
  }, [onTaskUpdated, updateState]);

  useEffect(() => {
    if (incomingRevision === fieldRenderKey) {
      pendingHydrationRef.current = null;
      return;
    }

    if (
      saveStatus === 'saving' ||
      !shouldHydrateTaskEditRevision({
        previousRevision: fieldRenderKey,
        nextRevision: incomingRevision,
        isDirty: isDirtyRef.current,
      })
    ) {
      pendingHydrationRef.current = {
        revision: incomingRevision,
        fieldRevisions: incomingFieldRevisions,
        labelIds,
      };
      return;
    }

    pendingHydrationRef.current = null;
    setFieldRenderKey(incomingRevision);
    setFieldRevisions(incomingFieldRevisions);
    setSelectedLabelIds(labelIds);
  }, [fieldRenderKey, incomingFieldRevisions, incomingRevision, isDirtyRef, labelIds, saveStatus]);

  useEffect(() => {
    const pendingHydration = pendingHydrationRef.current;
    if (!pendingHydration || saveStatus === 'saving') return;
    if (
      !shouldHydrateTaskEditRevision({
        previousRevision: fieldRenderKey,
        nextRevision: pendingHydration.revision,
        isDirty: isDirtyRef.current,
      })
    ) {
      return;
    }

    pendingHydrationRef.current = null;
    setFieldRenderKey(pendingHydration.revision);
    setFieldRevisions(pendingHydration.fieldRevisions);
    setSelectedLabelIds(pendingHydration.labelIds);
  }, [fieldRenderKey, isDirtyRef, saveStatus]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      syncSnapshot();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [fieldRenderKey, syncSnapshot]);

  // Flush unsaved changes on unmount (client-side navigation)
  useEffect(() => {
    return () => {
      flushSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const projectName = projectId ? (projects.find((p) => p.id === projectId)?.name ?? null) : null;

  const selectedLabels = selectedLabelIds
    .map((labelId) => labelById.get(labelId) ?? null)
    .filter((label): label is TaskEditLabelOption => label !== null);
  const latestPreqResultLog = selectLatestPreqResultLog(editableTodo.workLogs);

  const flushOnBlur = () => {
    if (!shouldFlushAutoSaveOnBlur(isDirtyRef.current)) return;
    flushSave();
  };

  const handleNoteContentChange = () => {
    markDirty();
  };

  return {
    clearOfflineDraft: clearDraft,
    draftBaseNoteFingerprint,
    draftNote,
    draftRevision,
    draftTitle,
    copyTaskId,
    fieldRenderKey,
    flushSave,
    labelRenderKey: fieldRevisions.labels,
    flushOnBlur,
    formId,
    formRef,
    handleNoteContentChange,
    idCopied,
    labelOptions: todoLabels,
    latestPreqResultLog,
    markDirty,
    noteRenderKey: fieldRevisions.note,
    noteConflict: hasNoteConflict,
    projectName,
    priorityRenderKey: fieldRevisions.taskPriority,
    saveStatus,
    selectedLabelIds,
    selectedLabels,
    setSelectedLabelIds,
    titleRenderKey: fieldRevisions.title,
    triggerSave,
    updateFormAction,
    updateNoteDraft,
    updateState,
    updateTitleDraft,
  };
}

export type TaskEditFormController = ReturnType<typeof useTaskEditFormController>;

export type TaskEditNotesModeState = {
  mode: EditorMode;
  revision: string;
  taskKey: string;
};

export function applyTaskEditNotesModeChange(
  currentState: TaskEditNotesModeState,
  nextMode: EditorMode,
  nextRevision: string,
  nextTaskKey: string,
) {
  if (
    currentState.mode === nextMode &&
    currentState.revision === nextRevision &&
    currentState.taskKey === nextTaskKey
  ) {
    return currentState;
  }

  return {
    mode: nextMode,
    revision: nextRevision,
    taskKey: nextTaskKey,
  };
}

function selectLatestPreqResultLog(
  workLogs: NonNullable<TaskEditFormProps['editableTodo']['workLogs']> | undefined,
) {
  return (
    workLogs
      ?.filter((log) => log.title.startsWith('PREQSTATION Result') && Boolean(log.detail))
      .sort((left, right) => right.workedAt.getTime() - left.workedAt.getTime())[0] ?? null
  );
}

function shouldSurfaceLatestPreqResult(status: string, detail: string | null | undefined) {
  if (!detail) return false;
  if (status === 'hold') return true;
  return status === 'ready' && detail.includes('**PR:**');
}

export function resolveTaskEditNotesMode(
  currentState: TaskEditNotesModeState,
  activeTaskKey: string,
): EditorMode {
  return currentState.taskKey === activeTaskKey ? currentState.mode : 'live';
}

type TaskEditFormContentProps = TaskEditFormProps & {
  controller: TaskEditFormController;
};

function TaskEditFormContent({
  editableTodo,
  projects: _projects,
  todoLabels: _todoLabels,
  taskPriorityOptions,
  updateTodoAction: _updateTodoAction,
  branchName,
  telegramEnabled,
  hermesTelegramEnabled,
  onTaskQueued,
  onDispatchQueued,
  onTaskUpdated: _onTaskUpdated,
  controller,
}: TaskEditFormContentProps) {
  const terminology = useTerminology();
  const { status, projectId, taskKey, taskPriority, engine, runState } = editableTodo;
  const {
    clearOfflineDraft: _clearOfflineDraft,
    draftBaseNoteFingerprint,
    draftNote,
    draftRevision,
    draftTitle: _draftTitle,
    copyTaskId,
    fieldRenderKey,
    flushSave,
    labelRenderKey,
    flushOnBlur,
    formId,
    formRef,
    handleNoteContentChange,
    idCopied,
    labelOptions,
    latestPreqResultLog,
    noteRenderKey,
    noteConflict,
    projectName,
    priorityRenderKey,
    saveStatus,
    selectedLabelIds,
    selectedLabels,
    setSelectedLabelIds,
    titleRenderKey: _titleRenderKey,
    triggerSave,
    updateFormAction,
    updateNoteDraft,
    updateState: _updateState,
    updateTitleDraft: _updateTitleDraft,
  } = controller;
  const activeNotesRevision = `${noteRenderKey ?? fieldRenderKey}:${draftRevision}`;
  const [notesModeState, setNotesModeState] = useState<TaskEditNotesModeState>({
    mode: 'live',
    revision: activeNotesRevision,
    taskKey,
  });
  const [noteMarkdown, setNoteMarkdown] = useState(draftNote);
  const notesMode = resolveTaskEditNotesMode(notesModeState, taskKey);
  const setNotesMode = (nextMode: EditorMode) => {
    setNotesModeState((currentState) =>
      applyTaskEditNotesModeChange(currentState, nextMode, activeNotesRevision, taskKey),
    );
  };
  const handleDispatchQueued = (taskKey: string, queuedAt: string) => {
    onTaskQueued?.(taskKey, queuedAt);
    onDispatchQueued?.();
  };
  const showLatestPreqResult = shouldSurfaceLatestPreqResult(status, latestPreqResultLog?.detail);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setNoteMarkdown(draftNote);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [draftNote, noteRenderKey]);

  return (
    <div className={classes.root}>
      {saveStatus === 'saving' ? (
        <div
          className={classes.mobileSavingOverlay}
          data-slot="task-edit-mobile-saving-overlay"
          role="status"
          aria-live="polite"
        >
          <div className={classes.mobileSavingOverlayCard}>
            <Loader size={18} />
            <Text size="sm" fw={600}>
              Saving
            </Text>
          </div>
        </div>
      ) : null}
      <form id={formId} ref={formRef} action={updateFormAction}>
        <input type="hidden" name="id" value={taskKey} />
        <input type="hidden" name="projectId" value={projectId ?? ''} />
        <input type="hidden" name="runState" value={runState ?? ''} />
        <input type="hidden" name="baseNoteFingerprint" value={draftBaseNoteFingerprint} />
        {selectedLabelIds.map((selectedLabelId) => (
          <input key={selectedLabelId} type="hidden" name="labelIds" value={selectedLabelId} />
        ))}

        <div className={classes.shell} data-layout="task-edit-shell">
          <div className={classes.mainColumn} data-panel="task-edit-main-column">
            <section
              className={`${classes.notesCard} ${classes.sectionSurface}`}
              data-panel="task-edit-notes-primary"
            >
              <Stack gap="md" className={classes.notesContent}>
                <SectionHeading
                  title="Notes"
                  helpText={`Markdown notes stay front and center while you edit the ${terminology.task.singularLower}.`}
                  aside={
                    <Group gap="xs" align="center" wrap="wrap">
                      <SegmentedControl
                        aria-label="Notes mode"
                        value={notesMode}
                        onChange={(value) => {
                          if (value === 'live' || value === 'markdown') {
                            setNotesMode(value);
                          }
                        }}
                        size="xs"
                        data={[
                          { value: 'live', label: 'Live' },
                          { value: 'markdown', label: 'Markdown' },
                        ]}
                      />
                    </Group>
                  }
                />

                <div className={classes.notesEditor}>
                  {noteConflict ? (
                    <Alert color="yellow" variant="light" icon={<IconAlertCircle size={16} />}>
                      Server notes changed while this draft was open. Review the latest task notes
                      before saving so PREQ updates do not get overwritten.
                    </Alert>
                  ) : null}
                  <LiveMarkdownEditor
                    key={`note:${activeNotesRevision}`}
                    name="noteMd"
                    label="Notes"
                    defaultValue={draftNote}
                    placeholder={'## Context\nDescribe details here...'}
                    onContentChange={(markdown) => {
                      setNoteMarkdown(markdown);
                      void updateNoteDraft(markdown);
                      handleNoteContentChange();
                    }}
                    onExternalUpdateApplied={(markdown) => {
                      setNoteMarkdown(markdown);
                    }}
                    onBlur={flushOnBlur}
                    onSaveShortcut={flushSave}
                    showHeader={false}
                    mode={notesMode}
                    onModeChange={setNotesMode}
                  />
                </div>

                <MarkdownViewer markdown={noteMarkdown} mode="artifacts" />
              </Stack>
            </section>

            <section className={classes.activityCard} data-panel="task-edit-activity">
              <Stack gap="md">
                <SectionHeading
                  title="Activity"
                  helpText="Status context, PREQ results, and recent work logs stay together."
                />

                {editableTodo.workLogs && editableTodo.workLogs.length > 0 ? (
                  <StatusHistoryBreadcrumb
                    workLogs={editableTodo.workLogs}
                    currentStatus={status}
                  />
                ) : null}

                {showLatestPreqResult ? (
                  <Alert
                    color={status === 'hold' ? 'yellow' : 'blue'}
                    variant="light"
                    icon={
                      status === 'hold' ? (
                        <IconAlertCircle size={16} />
                      ) : (
                        <IconInfoCircle size={16} />
                      )
                    }
                  >
                    <MarkdownViewer
                      markdown={latestPreqResultLog?.detail}
                      className="markdown-output"
                    />
                  </Alert>
                ) : null}

                {editableTodo.workLogs && editableTodo.workLogs.length > 0 ? (
                  <Stack gap="xs">
                    <Text fw={600} size="sm">
                      Work Logs
                    </Text>
                    <WorkLogTimeline
                      logs={editableTodo.workLogs}
                      emptyText="No work logs."
                      variant="activity"
                    />
                  </Stack>
                ) : null}
              </Stack>
            </section>
          </div>

          <aside className={classes.sidebar} data-panel="task-edit-sidebar">
            {status !== 'archived' ? (
              <section
                className={`${classes.dispatchRail} ${classes.sectionSurface}`}
                data-panel="task-edit-dispatch"
              >
                <TaskCopyActions
                  taskKey={taskKey}
                  branchName={branchName}
                  status={status}
                  engine={engine}
                  noteMarkdown={noteMarkdown}
                  telegramEnabled={telegramEnabled ?? false}
                  hermesTelegramEnabled={hermesTelegramEnabled}
                  onTaskQueued={handleDispatchQueued}
                />
              </section>
            ) : null}

            <section
              className={`${classes.metadataSection} ${classes.sectionSurface}`}
              data-panel="task-edit-metadata"
            >
              <Stack gap="md">
                <SectionHeading
                  title={`${terminology.task.singular} settings`}
                  helpText={`${terminology.task.singular} identity, labels, and priority stay together in one compact rail.`}
                />

                <div className={classes.settingsPanel} data-panel="task-edit-settings-card">
                  <Stack gap="sm" className={`${classes.metaHeader} task-edit-meta-header`}>
                    <Group gap="sm" wrap="nowrap" className={classes.taskIdentityRow}>
                      <Tooltip
                        label={idCopied ? 'Copied!' : `Copy ${terminology.task.singular} ID`}
                        withArrow
                      >
                        <UnstyledButton
                          type="button"
                          onClick={copyTaskId}
                          className={classes.taskKeyButton}
                          data-slot="task-edit-key-copy"
                          aria-label={`Copy ${terminology.task.singular} ID ${taskKey}`}
                        >
                          <span className={classes.taskKeyText}>{taskKey}</span>
                          {idCopied ? (
                            <IconCheck size={15} className={classes.taskKeyIcon} />
                          ) : (
                            <IconCopy size={15} className={classes.taskKeyIcon} />
                          )}
                        </UnstyledButton>
                      </Tooltip>
                      {projectName && (
                        <Text size="sm" fw={700} className={classes.projectName}>
                          {projectName}
                        </Text>
                      )}
                    </Group>
                  </Stack>

                  <div className={classes.settingsDivider} />

                  <Stack gap="lg" className={classes.settingsControls}>
                    <TaskEditLabelShortcut
                      key={`labels:${labelRenderKey ?? fieldRenderKey}`}
                      labelOptions={labelOptions}
                      selectedLabelIds={selectedLabelIds}
                      selectedLabels={selectedLabels}
                      taskTitle={editableTodo.title}
                      onChange={(value) => {
                        setSelectedLabelIds(value);
                        triggerSave(0);
                      }}
                    />
                    <TaskEditPriorityShortcut
                      key={`priority:${priorityRenderKey ?? fieldRenderKey}`}
                      initialPriority={taskPriority}
                      priorityOptions={taskPriorityOptions}
                      renderKey={priorityRenderKey ?? fieldRenderKey}
                      taskTitle={editableTodo.title}
                      onChange={() => triggerSave(0)}
                    />
                  </Stack>
                </div>
              </Stack>
            </section>
          </aside>
        </div>
      </form>
    </div>
  );
}

function TaskEditFormWithController(props: TaskEditFormProps) {
  const controller = useTaskEditFormController(props);

  return <TaskEditFormContent {...props} controller={controller} />;
}

export function TaskEditForm(
  props: TaskEditFormProps & {
    controller?: TaskEditFormController;
  },
) {
  if (props.controller) {
    const { controller, ...rest } = props;
    return <TaskEditFormContent {...rest} controller={controller} />;
  }

  return <TaskEditFormWithController {...props} />;
}
