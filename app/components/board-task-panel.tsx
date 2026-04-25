'use client';

import { useCallback, useEffect } from 'react';

import { EmptyTaskEditPanel, TaskEditPanel } from '@/app/components/task-edit-panel';
import {
  hydrateEditableBoardTask,
  type SerializedEditableBoardTask,
  serializeEditableBoardTask,
} from '@/lib/editable-board-task';
import type { KanbanTask } from '@/lib/kanban-helpers';
import type { EditableBoardTask } from '@/lib/kanban-store';
import { showErrorNotification } from '@/lib/notifications';
import { getSnapshot, putSnapshot } from '@/lib/offline/snapshot-store';

import {
  useApplyOptimisticKanbanRunState,
  useFocusedTask,
  useFocusedTaskDetailStatus,
  useKanbanFocusedTaskKey,
  useKanbanStoreApi,
  useOpenFocusedTaskFromBoardTask,
  useSetFocusedTask,
  useUpsertKanbanSnapshots,
} from './kanban-store-provider';

type BoardTaskPanelProps = {
  activePanel: 'task-edit' | null;
  activeTaskKey: string | null;
  boardHref: string;
  serverFocusedTask: EditableBoardTask | null;
  projects: { id: string; name: string }[];
  projectLabelOptionsByProjectId?: Record<
    string,
    Array<{ id: string; name: string; color: string }>
  >;
  taskPriorityOptions: { value: string; label: string }[];
  updateTodoAction: (
    prevState: unknown,
    formData: FormData,
  ) => Promise<
    | { ok: true; boardTask?: KanbanTask | null; focusedTask?: EditableBoardTask | null }
    | { ok: false; message: string }
    | null
  >;
  telegramEnabled: boolean;
  onClose: () => void;
};

export function BoardTaskPanel({
  activePanel,
  activeTaskKey,
  boardHref,
  serverFocusedTask,
  projects,
  projectLabelOptionsByProjectId = {},
  taskPriorityOptions,
  updateTodoAction,
  telegramEnabled,
  onClose,
}: BoardTaskPanelProps) {
  const focusedTask = useFocusedTask();
  const focusedTaskKey = useKanbanFocusedTaskKey();
  const focusedTaskDetailStatus = useFocusedTaskDetailStatus();
  const kanbanStore = useKanbanStoreApi();
  const applyOptimisticRunState = useApplyOptimisticKanbanRunState();
  const openFocusedTaskFromBoardTask = useOpenFocusedTaskFromBoardTask();
  const setFocusedTask = useSetFocusedTask();
  const upsertSnapshots = useUpsertKanbanSnapshots();

  useEffect(() => {
    setFocusedTask(serverFocusedTask);
  }, [serverFocusedTask, setFocusedTask]);

  useEffect(() => {
    if (activePanel !== 'task-edit' || !activeTaskKey) return;
    if (serverFocusedTask?.taskKey === activeTaskKey) return;
    if (focusedTaskKey === activeTaskKey) return;

    const snapshot = kanbanStore.getState().tasksByKey[activeTaskKey];
    if (snapshot) {
      openFocusedTaskFromBoardTask(snapshot);
      return;
    }

    setFocusedTask(null);
  }, [
    activePanel,
    activeTaskKey,
    focusedTaskKey,
    kanbanStore,
    openFocusedTaskFromBoardTask,
    serverFocusedTask,
    setFocusedTask,
  ]);

  useEffect(() => {
    if (activePanel !== 'task-edit') return;
    if (focusedTaskDetailStatus !== 'loading' || !focusedTaskKey) return;

    const controller = new AbortController();
    const previewFallback = focusedTask;

    void (async () => {
      try {
        const response = await fetch(`/api/todos/${encodeURIComponent(focusedTaskKey)}`, {
          credentials: 'same-origin',
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as {
          todo?: SerializedEditableBoardTask;
          error?: string;
        } | null;

        if (!response.ok || !payload?.todo) {
          if (response.status === 404) {
            setFocusedTask(null);
            return;
          }

          const offlineSnapshot = await getSnapshot<SerializedEditableBoardTask>(
            `task:${focusedTaskKey}`,
          );
          if (offlineSnapshot?.payload) {
            setFocusedTask(hydrateEditableBoardTask(offlineSnapshot.payload));
            return;
          }

          if (previewFallback) {
            setFocusedTask(previewFallback);
          }
          showErrorNotification(payload?.error || 'Failed to load task details.');
          return;
        }

        setFocusedTask(hydrateEditableBoardTask(payload.todo));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const offlineSnapshot = await getSnapshot<SerializedEditableBoardTask>(
          `task:${focusedTaskKey}`,
        );
        if (offlineSnapshot?.payload) {
          setFocusedTask(hydrateEditableBoardTask(offlineSnapshot.payload));
          return;
        }

        if (previewFallback) {
          setFocusedTask(previewFallback);
        }
        showErrorNotification(
          error instanceof Error && error.message ? error.message : 'Failed to load task details.',
        );
      }
    })();

    return () => controller.abort();
  }, [activePanel, focusedTask, focusedTaskDetailStatus, focusedTaskKey, setFocusedTask]);

  useEffect(() => {
    if (!focusedTask || focusedTaskDetailStatus !== 'ready') {
      return;
    }

    void putSnapshot({
      id: `task:${focusedTask.taskKey}`,
      kind: 'task',
      entityKey: focusedTask.taskKey,
      payload: serializeEditableBoardTask(focusedTask),
      updatedAt: new Date().toISOString(),
    });
  }, [focusedTask, focusedTaskDetailStatus]);

  const handleTaskQueued = useCallback(
    (taskKey: string, queuedAt: string) => {
      applyOptimisticRunState(taskKey, queuedAt);
    },
    [applyOptimisticRunState],
  );

  const handleTaskUpdated = useCallback(
    (result: { boardTask?: KanbanTask | null; focusedTask?: EditableBoardTask | null }) => {
      if (result.boardTask) {
        upsertSnapshots([result.boardTask]);
      }
      if (result.focusedTask !== undefined) {
        setFocusedTask(result.focusedTask ?? null);
      }
    },
    [setFocusedTask, upsertSnapshots],
  );

  if (activePanel !== 'task-edit') {
    return null;
  }

  if (!focusedTask) {
    return <EmptyTaskEditPanel closeHref={boardHref} onClose={onClose} size="80rem" />;
  }

  const focusedTaskLabels = focusedTask.projectId
    ? (projectLabelOptionsByProjectId[focusedTask.projectId] ?? [])
    : [];

  return (
    <TaskEditPanel
      key={focusedTask.taskKey}
      closeHref={boardHref}
      editableTodo={focusedTask}
      isLoading={focusedTaskDetailStatus === 'loading'}
      onClose={onClose}
      projects={projects}
      todoLabels={focusedTaskLabels.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color as string | null,
      }))}
      taskPriorityOptions={taskPriorityOptions}
      updateTodoAction={updateTodoAction}
      branchName={focusedTask.branch}
      telegramEnabled={telegramEnabled}
      onTaskQueued={handleTaskQueued}
      onTaskUpdated={handleTaskUpdated}
    />
  );
}
