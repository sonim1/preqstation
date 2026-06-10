'use client';

import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Kbd,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconCopy,
  IconInfoCircle,
  IconUserCircle,
  IconX,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import {
  type CSSProperties,
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
import { getSendShortcutLabel, TaskCopyActions } from '@/app/components/task-copy-actions';
import { TaskMetadataPriorityPicker } from '@/app/components/task-metadata-controls';
import { WorkLogTimeline } from '@/app/components/work-log-timeline';
import { shouldFlushAutoSaveOnBlur, useAutoSave } from '@/app/hooks/use-auto-save';
import { useTaskOfflineDraft } from '@/app/hooks/use-task-offline-draft';
import { getEngineConfig, getEngineShortLabel } from '@/lib/engine-icons';
import { type KanbanStatus, type KanbanTask } from '@/lib/kanban-helpers';
import type { EditableBoardTask } from '@/lib/kanban-store';
import { showErrorNotification } from '@/lib/notifications';
import type { TaskArtifact } from '@/lib/task-artifacts';
import { setTaskEditRefreshBlocked } from '@/lib/task-edit-refresh-guard';
import {
  buildTaskEditFieldRevisions,
  buildTaskEditRevision,
  shouldHydrateTaskEditRevision,
  type TaskEditFieldRevisions,
} from '@/lib/task-edit-sync';
import { parseTaskPriority } from '@/lib/task-meta';
import { buildTaskNoteFingerprint } from '@/lib/task-note-fingerprint';

import classes from './task-edit-form.module.css';
import { TaskLabelPicker } from './task-label-picker';
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
    artifacts?: TaskArtifact[] | null;
    projectId: string | null;
    labelIds: string[];
    labels: Array<{ id: string; name: string; color: string | null }>;
    taskPriority: string;
    status: string;
    engine?: string | null;
    dispatchTarget?: EditableBoardTask['dispatchTarget'];
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
  hermesBotUsername?: string | null;
  onTaskQueued?: (
    taskKey: string,
    queuedAt: string,
    dispatchTarget: KanbanTask['dispatchTarget'],
  ) => void;
  onDispatchQueued?: () => void;
  onTaskUpdated?: (result: {
    boardTask?: KanbanTask | null;
    focusedTask?: EditableBoardTask | null;
  }) => void;
  onProjectLabelOptionsChange?: (
    projectId: string,
    labelOptions: Array<{ id: string; name: string; color: string | null }>,
  ) => void;
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

type TaskComment = {
  id: string;
  body: string;
  author_type: 'user' | 'agent' | 'system';
  author_name?: string | null;
  run_state?: 'queued' | 'working' | 'done' | 'failed' | null;
  run_state_updated_at?: string | null;
  dispatch_target?: KanbanTask['dispatchTarget'];
  error_message?: string | null;
  engine?: string | null;
  parent_comment_id?: string | null;
  created_at: string;
};

type TaskCommentDispatchPayload = {
  status?: string | null;
  error?: string | null;
  dispatch_target?: KanbanTask['dispatchTarget'];
  engine?: string | null;
};

function formatTaskCommentTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

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
    autoSaveDraft,
    canRestoreDraft,
    clearDraft,
    draftBaseNoteFingerprint,
    draftBaseTitleFingerprint,
    draftNote,
    draftRevision,
    draftTitle,
    hasNoteConflict,
    hasTitleConflict,
    markAutoSaveDraftFailed,
    restoreDraft,
    restoreDraftPreview,
    updateNoteDraft,
    updateTitleDraft,
  } = useTaskOfflineDraft(editableTodo.taskKey, editableTodo.title, editableTodo.note, online);
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
        baseNoteFingerprint: draftBaseNoteFingerprint,
        baseTitleFingerprint: draftBaseTitleFingerprint,
      });

      onTaskUpdated?.(result);
    },
    [
      boardOfflineSync,
      draftBaseNoteFingerprint,
      draftBaseTitleFingerprint,
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
  const autoSavingDraftKeyRef = useRef<string | null | 'completed'>(null);

  useEffect(() => {
    setTaskEditRefreshBlocked(isDirty || saveStatus === 'saving');
  }, [isDirty, saveStatus]);

  useEffect(() => {
    return () => {
      setTaskEditRefreshBlocked(false);
    };
  }, []);

  useEffect(() => {
    if (!autoSaveDraft) {
      autoSavingDraftKeyRef.current = null;
      return;
    }

    if (!online || saveStatus === 'saving' || isDirtyRef.current) {
      return;
    }

    const autoSaveDraftKey = `${editableTodo.taskKey}:${autoSaveDraft.baseTitleFingerprint}:${autoSaveDraft.baseNoteFingerprint}:${autoSaveDraft.title}:${buildTaskNoteFingerprint(autoSaveDraft.note)}`;
    if (
      autoSavingDraftKeyRef.current === autoSaveDraftKey ||
      autoSavingDraftKeyRef.current === 'completed'
    ) {
      return;
    }

    const form = formRef.current;
    if (!form) {
      return;
    }

    autoSavingDraftKeyRef.current = autoSaveDraftKey;
    void Promise.resolve()
      .then(async () => {
        const formData = new FormData();
        formData.set('id', editableTodo.taskKey);
        formData.set('title', autoSaveDraft.title);
        formData.set('noteMd', autoSaveDraft.note);
        formData.set('baseTitleFingerprint', autoSaveDraft.baseTitleFingerprint);
        formData.set('baseNoteFingerprint', autoSaveDraft.baseNoteFingerprint);
        formData.set('taskPriority', editableTodo.taskPriority ?? 'none');
        formData.set('runState', editableTodo.runState ?? '');
        formData.set('status', editableTodo.status);
        formData.set('projectId', editableTodo.projectId ?? '');
        for (const labelId of editableTodo.labelIds ?? []) {
          formData.append('labelIds', labelId);
        }

        const result = await updateTodoAction(null, formData);
        if (!result?.ok) {
          markAutoSaveDraftFailed();
          showErrorNotification(result?.message ?? 'Failed to save local draft.');
          return;
        }

        await clearDraft();
        if (result.boardTask || result.focusedTask) {
          onTaskUpdated?.({
            boardTask: result.boardTask,
            focusedTask: result.focusedTask,
          });
        } else {
          router.refresh();
        }
      })
      .catch(() => {
        markAutoSaveDraftFailed();
      })
      .finally(() => {
        if (autoSavingDraftKeyRef.current === autoSaveDraftKey) {
          autoSavingDraftKeyRef.current = 'completed';
        }
      });
  }, [
    autoSaveDraft,
    clearDraft,
    editableTodo.labelIds,
    editableTodo.projectId,
    editableTodo.runState,
    editableTodo.status,
    editableTodo.taskKey,
    editableTodo.taskPriority,
    isDirtyRef,
    markAutoSaveDraftFailed,
    onTaskUpdated,
    online,
    router,
    saveStatus,
    updateTodoAction,
  ]);

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
    autoSaveDraft,
    canRestoreNoteDraft: canRestoreDraft,
    clearOfflineDraft: clearDraft,
    draftBaseNoteFingerprint,
    draftBaseTitleFingerprint,
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
    restoreNoteDraft: restoreDraft,
    restoreDraftPreview,
    projectName,
    priorityRenderKey: fieldRevisions.taskPriority,
    saveStatus,
    isOffline: !online,
    selectedLabelIds,
    selectedLabels,
    setSelectedLabelIds,
    titleConflict: hasTitleConflict,
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

function getTaskCommentAuthorLabel(comment: TaskComment) {
  const authorName = comment.author_name?.trim();
  if (authorName) return authorName;
  if (comment.author_type === 'agent') {
    const engineConfig = getEngineConfig(comment.engine);
    return engineConfig ? getEngineShortLabel(engineConfig) : 'Agent';
  }
  if (comment.author_type === 'system') return 'System';
  return 'User';
}

function TaskCommentIdentity({ comment }: { comment: TaskComment }) {
  const isUserComment = comment.author_type === 'user';
  const engineConfig = getEngineConfig(comment.engine);
  const authorLabel = getTaskCommentAuthorLabel(comment);

  if (isUserComment) {
    return (
      <Group gap="xs" className={classes.commentIdentity} data-comment-author="user">
        <Text size="xs" fw={700} className={classes.commentAuthorName}>
          {authorLabel}
        </Text>
        <span
          className={`${classes.commentIcon} ${classes.commentUserIcon}`}
          aria-label="User comment"
        >
          <IconUserCircle size={16} aria-hidden="true" />
        </span>
      </Group>
    );
  }

  return (
    <Group gap="xs" className={classes.commentIdentity} data-comment-author={comment.author_type}>
      {engineConfig ? (
        <span
          className={`${classes.commentIcon} ${classes.commentEngineIcon}`}
          aria-label={`${engineConfig.label} comment`}
          data-engine-icon={engineConfig.key}
          style={
            {
              '--engine-color': engineConfig.iconColor,
              '--engine-icon': `url(${engineConfig.icon})`,
            } as CSSProperties
          }
        />
      ) : (
        <span
          className={`${classes.commentIcon} ${classes.commentSystemIcon}`}
          aria-label={`${authorLabel} comment`}
        />
      )}
      <Text size="xs" fw={700} className={classes.commentAuthorName}>
        {authorLabel}
      </Text>
    </Group>
  );
}

function TaskCommentsSection({
  taskKey,
  engine,
  dispatchTarget,
  onTaskQueued,
  onShortcutActiveChange,
}: {
  taskKey: string;
  engine?: string | null;
  dispatchTarget?: KanbanTask['dispatchTarget'];
  onTaskQueued?: TaskEditFormProps['onTaskQueued'];
  onShortcutActiveChange?: (active: boolean) => void;
}) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [draft, setDraft] = useState('');
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Loading comments.');
  const canSubmitComment = Boolean(draft.trim());
  const commentShortcutActive = isComposerFocused;
  const [sendShortcutLabel, setSendShortcutLabel] = useState<string | null>(null);
  const showCommentShortcut = commentShortcutActive && Boolean(sendShortcutLabel);

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setStatusMessage('Loading comments.');
    try {
      const response = await fetch(`/api/todos/${encodeURIComponent(taskKey)}/comments`, {
        cache: 'no-store',
      });
      const body = (await response.json().catch(() => null)) as {
        comments?: TaskComment[];
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? 'Failed to load comments.');
      }
      const nextComments = body?.comments ?? [];
      setComments(nextComments);
      setStatusMessage(
        nextComments.length === 0
          ? 'No comments yet.'
          : `Loaded ${nextComments.length} ${nextComments.length === 1 ? 'comment' : 'comments'}.`,
      );
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load comments.';
      setError(message);
      setStatusMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [taskKey]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    setSendShortcutLabel(getSendShortcutLabel());
  }, []);

  useEffect(() => {
    onShortcutActiveChange?.(commentShortcutActive);
  }, [commentShortcutActive, onShortcutActiveChange]);

  useEffect(() => {
    return () => {
      onShortcutActiveChange?.(false);
    };
  }, [onShortcutActiveChange]);

  async function handleSubmit() {
    const body = draft.trim();
    if (!body) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/todos/${encodeURIComponent(taskKey)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body,
          ...(engine ? { engine } : null),
          ...(dispatchTarget ? { dispatchTarget } : null),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        comment?: TaskComment;
        dispatch?: TaskCommentDispatchPayload | null;
        error?: string;
      } | null;
      if (!response.ok || !payload?.comment) {
        throw new Error(payload?.error ?? 'Failed to add comment.');
      }
      setDraft('');
      setComments((current) => [...current, payload.comment as TaskComment]);
      if (payload.dispatch?.status === 'failed' || payload.comment.run_state === 'failed') {
        const message =
          payload.dispatch?.error ||
          payload.comment.error_message ||
          'Failed to send Telegram message.';
        setError(message);
        setStatusMessage(message);
        showErrorNotification(message);
        return;
      }
      if (payload.comment.run_state === 'queued') {
        onTaskQueued?.(
          taskKey,
          payload.comment.run_state_updated_at ?? new Date().toISOString(),
          payload.comment.dispatch_target ?? dispatchTarget ?? null,
        );
      }
      setStatusMessage(
        payload.comment.run_state === 'queued' ? 'Comment queued.' : 'Comment added.',
      );
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to add comment.';
      setError(message);
      setStatusMessage(message);
      showErrorNotification(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className={`${classes.activityCard} ${classes.mainSectionSurface}`}
      data-panel="task-edit-comments"
    >
      <Stack gap="md">
        <SectionHeading
          title="Comments"
          helpText="Ask follow-up questions or queue extra agent requests without rewriting canonical notes."
          aside={
            <Button
              type="button"
              size="xs"
              variant="light"
              onClick={() => void loadComments()}
              loading={isLoading}
            >
              Refresh
            </Button>
          }
        />

        <Text className={classes.commentStatusMessage} role="status" aria-live="polite">
          {statusMessage}
        </Text>

        <Stack gap="xs">
          <Textarea
            aria-label="Add task comment"
            placeholder="Ask a follow-up or request a small note update..."
            minRows={3}
            value={draft}
            onFocus={() => setIsComposerFocused(true)}
            onBlur={() => setIsComposerFocused(false)}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              const isCommentSubmitShortcut =
                (event.metaKey || event.ctrlKey) && event.key === 'Enter';
              if (!isCommentSubmitShortcut || !canSubmitComment) return;

              event.preventDefault();
              event.stopPropagation();
              if (!isSubmitting) {
                void handleSubmit();
              }
            }}
          />
          <Group justify="space-between" gap="sm" wrap="wrap">
            <Text size="xs" c="dimmed">
              New comments queue an agent follow-up; task status stays unchanged.
            </Text>
            <Button
              type="button"
              size="xs"
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={!canSubmitComment}
            >
              <span className={classes.commentSubmitContent}>
                <span>Add comment</span>
                <span
                  className={classes.commentShortcutSlot}
                  data-visible={showCommentShortcut ? 'true' : 'false'}
                  aria-hidden={!showCommentShortcut}
                >
                  {sendShortcutLabel ? (
                    <Kbd size="xs" className="task-dispatch-send-shortcut">
                      {sendShortcutLabel}
                    </Kbd>
                  ) : null}
                </span>
              </span>
            </Button>
          </Group>
        </Stack>

        {error ? (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        ) : null}

        {isLoading && comments.length === 0 ? (
          <Group gap="xs">
            <Loader size={16} />
            <Text size="sm" c="dimmed">
              Loading comments…
            </Text>
          </Group>
        ) : comments.length > 0 ? (
          <Stack gap="sm">
            {comments.map((comment) => (
              <Stack key={comment.id} gap="xs" className={classes.commentCard}>
                <Group
                  justify="space-between"
                  gap="xs"
                  align="center"
                  className={classes.commentHeader}
                >
                  {comment.author_type === 'user' ? (
                    <>
                      <Text size="xs" c="dimmed" className={classes.commentTimestamp}>
                        {formatTaskCommentTimestamp(comment.created_at)}
                      </Text>
                      <TaskCommentIdentity comment={comment} />
                    </>
                  ) : (
                    <>
                      <TaskCommentIdentity comment={comment} />
                      <Text size="xs" c="dimmed" className={classes.commentTimestamp}>
                        {formatTaskCommentTimestamp(comment.created_at)}
                      </Text>
                    </>
                  )}
                </Group>
                <MarkdownViewer
                  markdown={comment.body}
                  className={`markdown-output ${classes.commentBodyMarkdown}`}
                />
              </Stack>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No comments yet.
          </Text>
        )}
      </Stack>
    </section>
  );
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

function formatRestoreDraftUpdatedAt(updatedAt: string | null) {
  if (!updatedAt) return 'Saved in this browser';

  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return 'Saved in this browser';
  }

  return `Saved ${parsed.toLocaleString()}`;
}

export function resolveTaskEditNotesMode(
  currentState: TaskEditNotesModeState,
  activeTaskKey: string,
): EditorMode {
  return currentState.taskKey === activeTaskKey ? currentState.mode : 'live';
}

export function resolveTaskEditNotesEditorKey(taskKey: string, draftRevision: number): string {
  return `note:${taskKey}:${draftRevision}`;
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
  hermesBotUsername,
  onTaskQueued,
  onDispatchQueued,
  onTaskUpdated: _onTaskUpdated,
  onProjectLabelOptionsChange,
  controller,
}: TaskEditFormContentProps) {
  const terminology = useTerminology();
  const { status, projectId, taskKey, taskPriority, engine, runState } = editableTodo;
  const {
    autoSaveDraft,
    canRestoreNoteDraft,
    clearOfflineDraft: _clearOfflineDraft,
    draftBaseNoteFingerprint,
    draftBaseTitleFingerprint,
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
    markDirty,
    noteRenderKey,
    noteConflict,
    restoreNoteDraft,
    restoreDraftPreview,
    projectName,
    priorityRenderKey,
    saveStatus,
    isOffline,
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
  const notesEditorKey = resolveTaskEditNotesEditorKey(taskKey, draftRevision);
  const [notesModeState, setNotesModeState] = useState<TaskEditNotesModeState>({
    mode: 'live',
    revision: activeNotesRevision,
    taskKey,
  });
  const [noteMarkdown, setNoteMarkdown] = useState(draftNote);
  const [commentShortcutActive, setCommentShortcutActive] = useState(false);
  const [commentDispatchSelection, setCommentDispatchSelection] = useState<{
    taskKey: string;
    engine: string | null;
    dispatchTarget: KanbanTask['dispatchTarget'];
  }>(() => ({
    taskKey,
    engine: engine ?? null,
    dispatchTarget: editableTodo.dispatchTarget ?? null,
  }));
  const effectiveCommentDispatchSelection =
    commentDispatchSelection.taskKey === taskKey
      ? commentDispatchSelection
      : {
          taskKey,
          engine: engine ?? null,
          dispatchTarget: editableTodo.dispatchTarget ?? null,
        };
  const draftWarningKey =
    noteConflict || (canRestoreNoteDraft && !autoSaveDraft)
      ? `${taskKey}:${noteConflict ? 'conflict' : 'restore'}:${canRestoreNoteDraft ? 'restorable' : 'no-restore'}:${activeNotesRevision}`
      : null;
  const [dismissedDraftWarningKey, setDismissedDraftWarningKey] = useState<string | null>(null);
  const showDraftWarning = draftWarningKey !== null && dismissedDraftWarningKey !== draftWarningKey;
  const notesMode = resolveTaskEditNotesMode(notesModeState, taskKey);
  const showDispatchPanel = !isOffline && status !== 'archived';
  const setNotesMode = (nextMode: EditorMode) => {
    setNotesModeState((currentState) =>
      applyTaskEditNotesModeChange(currentState, nextMode, activeNotesRevision, taskKey),
    );
  };
  const handleDispatchQueued = (
    taskKey: string,
    queuedAt: string,
    dispatchTarget: KanbanTask['dispatchTarget'],
  ) => {
    onTaskQueued?.(taskKey, queuedAt, dispatchTarget);
    onDispatchQueued?.();
  };
  const handleDispatchSelectionChange = useCallback(
    (selection: { engine: string | null; dispatchTarget: KanbanTask['dispatchTarget'] }) => {
      setCommentDispatchSelection((current) => {
        if (
          current.taskKey === taskKey &&
          current.engine === selection.engine &&
          current.dispatchTarget === selection.dispatchTarget
        ) {
          return current;
        }

        return { taskKey, ...selection };
      });
    },
    [taskKey],
  );
  const handleRestoreDraft = () => {
    restoreNoteDraft();
    markDirty();
  };
  const showLatestPreqResult = shouldSurfaceLatestPreqResult(status, latestPreqResultLog?.detail);
  const restorePreviewMarkdown = restoreDraftPreview?.note.trim()
    ? restoreDraftPreview.note
    : '_Empty_';
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setNoteMarkdown(draftNote);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [draftNote, noteRenderKey]);

  return (
    <div
      className={
        showDispatchPanel ? `${classes.root} ${classes.rootWithBottomDispatch}` : classes.root
      }
    >
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
        <input type="hidden" name="baseTitleFingerprint" value={draftBaseTitleFingerprint} />
        {selectedLabelIds.map((selectedLabelId) => (
          <input key={selectedLabelId} type="hidden" name="labelIds" value={selectedLabelId} />
        ))}

        <div className={classes.shell} data-layout="task-edit-shell">
          <div className={classes.mainColumn} data-panel="task-edit-main-column">
            <section
              className={classes.commandStrip}
              data-panel="task-edit-command-strip"
              aria-label={`${terminology.task.singular} controls`}
            >
              <div className={classes.metadataSection} data-panel="task-edit-metadata">
                <Stack gap="sm" className={`${classes.metaHeader} task-edit-meta-header`}>
                  <Group gap="sm" wrap="wrap" className={classes.taskIdentityRow}>
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
              </div>

              <div className={classes.settingsControls}>
                <TaskLabelPicker
                  disabled={isOffline}
                  key={`labels:${labelRenderKey ?? fieldRenderKey}`}
                  labelOptions={labelOptions}
                  selectedLabelIds={selectedLabelIds}
                  selectedLabels={selectedLabels}
                  projectId={projectId}
                  triggerAriaLabel={`Edit labels for ${editableTodo.title}`}
                  triggerLabel="Labels"
                  emptyStateLabel="Select labels"
                  searchPlaceholder="Search labels"
                  onChange={(value) => {
                    setSelectedLabelIds(value);
                    triggerSave(0);
                  }}
                  onOptionsChange={(nextLabelOptions) => {
                    if (projectId) {
                      onProjectLabelOptionsChange?.(projectId, nextLabelOptions);
                    }
                  }}
                />
              </div>

              <div className={classes.settingsControls}>
                <TaskMetadataPriorityPicker
                  disabled={isOffline}
                  key={`priority:${priorityRenderKey ?? fieldRenderKey}`}
                  initialPriority={taskPriority}
                  priorityOptions={taskPriorityOptions}
                  label={`${terminology.task.singular} priority`}
                  onChange={() => triggerSave(0)}
                />
              </div>
            </section>

            <section
              className={`${classes.notesCard} ${classes.mainSectionSurface}`}
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
                  {showDraftWarning ? (
                    <Alert
                      color={noteConflict ? 'yellow' : 'blue'}
                      variant="light"
                      icon={
                        noteConflict ? <IconAlertCircle size={16} /> : <IconInfoCircle size={16} />
                      }
                    >
                      <Stack gap="xs">
                        <Group justify="space-between" align="center" gap="sm" wrap="wrap">
                          <Text size="sm">
                            {noteConflict
                              ? 'Server notes changed while this draft was open. Review the latest task notes before restoring so PREQ updates do not get overwritten.'
                              : 'A saved local draft is available. Restore it if you want to continue from your browser draft instead of the latest server notes.'}
                          </Text>
                          <Group gap="xs" align="center">
                            {canRestoreNoteDraft ? (
                              <Button size="xs" variant="light" onClick={handleRestoreDraft}>
                                Restore draft
                              </Button>
                            ) : null}
                            <ActionIcon
                              aria-label="Dismiss draft warning"
                              size="sm"
                              variant="subtle"
                              color="gray"
                              onClick={() => {
                                setDismissedDraftWarningKey(draftWarningKey);
                              }}
                            >
                              <IconX size={14} />
                            </ActionIcon>
                          </Group>
                        </Group>

                        {restoreDraftPreview ? (
                          <details className={classes.restoreDraftDetails}>
                            <summary className={classes.restoreDraftSummary}>
                              Restore preview · {taskKey}
                            </summary>
                            <Stack gap="xs" className={classes.restoreDraftPreviewBody}>
                              <Text size="xs" c="dimmed">
                                {formatRestoreDraftUpdatedAt(restoreDraftPreview.updatedAt)}
                              </Text>
                              {restoreDraftPreview.title.trim() ? (
                                <Text size="sm" fw={600}>
                                  {restoreDraftPreview.title}
                                </Text>
                              ) : null}
                              <MarkdownViewer
                                markdown={restorePreviewMarkdown}
                                className={`markdown-output ${classes.restoreDraftPreviewMarkdown}`}
                                mode="body"
                              />
                            </Stack>
                          </details>
                        ) : null}
                      </Stack>
                    </Alert>
                  ) : null}
                  <LiveMarkdownEditor
                    key={notesEditorKey}
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
                    autoFocus={false}
                    mode={notesMode}
                    onModeChange={setNotesMode}
                  />
                </div>

                <MarkdownViewer
                  markdown={noteMarkdown}
                  artifacts={editableTodo.artifacts}
                  mode="artifacts"
                />
              </Stack>
            </section>

            {!isOffline ? (
              <TaskCommentsSection
                taskKey={taskKey}
                engine={effectiveCommentDispatchSelection.engine}
                dispatchTarget={effectiveCommentDispatchSelection.dispatchTarget}
                onTaskQueued={onTaskQueued}
                onShortcutActiveChange={setCommentShortcutActive}
              />
            ) : null}

            <section
              className={`${classes.activityCard} ${classes.mainSectionSurface}`}
              data-panel="task-edit-activity"
            >
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
        </div>
      </form>

      {showDispatchPanel ? (
        <div className={classes.bottomDispatch} data-panel="task-edit-bottom-dispatch">
          <TaskCopyActions
            placement="bottom"
            taskKey={taskKey}
            branchName={branchName}
            status={status}
            engine={engine}
            dispatchTarget={editableTodo.dispatchTarget ?? null}
            telegramEnabled={telegramEnabled ?? false}
            hermesTelegramEnabled={hermesTelegramEnabled}
            hermesBotUsername={hermesBotUsername}
            suppressShortcut={commentShortcutActive}
            onTaskQueued={handleDispatchQueued}
            onDispatchSelectionChange={handleDispatchSelectionChange}
          />
        </div>
      ) : null}
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
