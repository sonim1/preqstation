'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from 'react';

import { useOfflineStatus } from '@/app/components/offline-status-provider';
import { buildBoardTaskEditHref } from '@/lib/board-task-panel-location';
import { computeSortOrder, type KanbanStatus, type KanbanTask } from '@/lib/kanban-helpers';
import type { EditableBoardTask } from '@/lib/kanban-store';
import { buildEditableBoardTaskPreview } from '@/lib/kanban-store';
import { showErrorNotification } from '@/lib/notifications';
import { deleteDraft } from '@/lib/offline/draft-store';
import {
  applyOptimisticTaskPatch,
  buildOfflineTaskId,
  buildOfflineTaskKey,
  buildOptimisticTask,
  type QueueOfflineCreateInput,
  queueOfflineCreateMutation,
  type QueueOfflinePatchInput,
  queueOfflinePatchMutation,
} from '@/lib/offline/mutation-store';
import { flushOfflineMutations } from '@/lib/offline/mutation-sync';

import {
  useFocusedTask,
  useKanbanStoreApi,
  useRemoveKanbanTask,
  useSetFocusedTask,
  useUpsertKanbanSnapshots,
} from './kanban-store-provider';

type BoardOfflineSyncContextValue = {
  online: boolean;
  queueTaskCreate: (input: QueueOfflineCreateInput) => Promise<KanbanTask>;
  queueTaskMove: (input: {
    sortOrder: string;
    status: KanbanStatus;
    taskKey: string;
  }) => Promise<void>;
  queueTaskPatch: (input: QueueOfflinePatchInput) => Promise<{
    boardTask: KanbanTask;
    focusedTask: EditableBoardTask | null;
  }>;
};

const BoardOfflineSyncContext = createContext<BoardOfflineSyncContextValue | null>(null);

function buildTaskOfflineDraftId(taskKey: string) {
  return `task:${taskKey}`;
}

function buildFallbackBoardTaskFromFocusedTask(params: {
  focusedTask: EditableBoardTask;
  patch: QueueOfflinePatchInput;
  tasksByKey: Record<string, KanbanTask>;
}): KanbanTask {
  const project =
    Object.values(params.tasksByKey).find(
      (task) => task.project?.id && task.project.id === params.focusedTask.projectId,
    )?.project ?? null;
  const nextStatus = (params.patch.status ?? params.focusedTask.status) as KanbanStatus;
  const updatedAt = new Date().toISOString();

  return {
    id: params.focusedTask.id,
    taskKey: params.focusedTask.taskKey,
    branch: params.focusedTask.branch ?? null,
    title: params.focusedTask.title,
    note: params.focusedTask.note,
    status: nextStatus,
    sortOrder: params.patch.sortOrder ?? 'a0',
    taskPriority: params.focusedTask.taskPriority,
    dueAt: null,
    engine: params.focusedTask.engine,
    dispatchTarget: params.focusedTask.dispatchTarget ?? null,
    runState: params.focusedTask.runState,
    runStateUpdatedAt: params.focusedTask.runStateUpdatedAt,
    project,
    updatedAt,
    archivedAt: nextStatus === 'archived' ? updatedAt : null,
    labels: params.focusedTask.labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color ?? 'blue',
    })),
  };
}

export function useBoardOfflineSync() {
  return useContext(BoardOfflineSyncContext);
}

export function BoardOfflineSyncProvider({
  children,
  editHrefBase,
  activeProjectId = null,
}: {
  children: ReactNode;
  editHrefBase: string;
  activeProjectId?: string | null;
}) {
  const { online } = useOfflineStatus();
  const focusedTask = useFocusedTask();
  const kanbanStore = useKanbanStoreApi();
  const removeTask = useRemoveKanbanTask();
  const setFocusedTask = useSetFocusedTask();
  const upsertSnapshots = useUpsertKanbanSnapshots();
  const isFlushingRef = useRef(false);

  const flushPendingMutations = useCallback(async () => {
    if (!online || isFlushingRef.current) {
      return;
    }

    isFlushingRef.current = true;
    try {
      const result = await flushOfflineMutations({
        onApplied: async (mutation) => {
          if (mutation.kind === 'create') {
            await deleteDraft(buildTaskOfflineDraftId(mutation.previousTaskKey));
            await deleteDraft(buildTaskOfflineDraftId(mutation.boardTask.taskKey));
          } else {
            await deleteDraft(buildTaskOfflineDraftId(mutation.taskKey));
          }

          if (activeProjectId && mutation.boardTask.project?.id !== activeProjectId) {
            return;
          }

          if (mutation.kind === 'create') {
            removeTask(mutation.previousTaskKey);
            upsertSnapshots([mutation.boardTask]);

            if (kanbanStore.getState().focusedTask?.taskKey === mutation.previousTaskKey) {
              setFocusedTask(buildEditableBoardTaskPreview(mutation.boardTask));
            }

            if (typeof window !== 'undefined') {
              const currentUrl = new URL(window.location.href);
              if (currentUrl.searchParams.get('taskId') === mutation.previousTaskKey) {
                window.history.replaceState(
                  null,
                  '',
                  buildBoardTaskEditHref(editHrefBase, mutation.boardTask.taskKey),
                );
              }
            }

            return;
          }

          upsertSnapshots([mutation.boardTask]);
          if (kanbanStore.getState().focusedTask?.taskKey === mutation.taskKey) {
            setFocusedTask(
              mutation.focusedTask ?? buildEditableBoardTaskPreview(mutation.boardTask),
            );
          }
        },
        onConflict: async (conflict) => {
          if (activeProjectId && conflict.boardTask.project?.id !== activeProjectId) {
            return;
          }

          upsertSnapshots([conflict.boardTask]);
          if (kanbanStore.getState().focusedTask?.taskKey === conflict.taskKey) {
            setFocusedTask(
              conflict.focusedTask ?? buildEditableBoardTaskPreview(conflict.boardTask),
            );
          }
          showErrorNotification(conflict.error);
        },
      });

      if (result.error) {
        showErrorNotification(result.error);
      }
    } finally {
      isFlushingRef.current = false;
    }
  }, [
    activeProjectId,
    editHrefBase,
    kanbanStore,
    online,
    removeTask,
    setFocusedTask,
    upsertSnapshots,
  ]);

  useEffect(() => {
    void flushPendingMutations();
  }, [flushPendingMutations]);

  const queueTaskCreate = useCallback(
    async (input: QueueOfflineCreateInput) => {
      const taskKey = buildOfflineTaskKey();
      const status = input.status ?? 'inbox';
      const currentState = kanbanStore.getState();
      const laneTaskKeys = currentState.columnTaskKeys[status];
      const laneTasks = laneTaskKeys
        .map((queuedTaskKey) => currentState.tasksByKey[queuedTaskKey])
        .filter((task): task is KanbanTask => Boolean(task));
      const sortOrder = computeSortOrder(laneTasks, laneTasks.length);
      const optimisticTask = buildOptimisticTask({
        id: buildOfflineTaskId(),
        taskKey,
        title: input.title.trim(),
        note: input.note,
        project: input.project,
        labels: input.labels,
        taskPriority: input.taskPriority,
        status,
        sortOrder,
      });

      await queueOfflineCreateMutation({
        taskKey,
        payload: {
          title: optimisticTask.title,
          note: optimisticTask.note ?? '',
          projectId: input.project.id,
          labelIds: optimisticTask.labels.map((label) => label.id),
          taskPriority: optimisticTask.taskPriority,
          status,
          sortOrder,
        },
      });

      return optimisticTask;
    },
    [kanbanStore],
  );

  const queueTaskPatch = useCallback(
    async (input: QueueOfflinePatchInput) => {
      const currentState = kanbanStore.getState();
      const boardTask =
        currentState.tasksByKey[input.taskKey] ??
        (focusedTask?.taskKey === input.taskKey
          ? buildFallbackBoardTaskFromFocusedTask({
              focusedTask,
              patch: input,
              tasksByKey: currentState.tasksByKey,
            })
          : null);
      if (!boardTask) {
        throw new Error('Task snapshot is unavailable for offline editing.');
      }

      const optimistic = applyOptimisticTaskPatch({
        boardTask,
        focusedTask,
        patch: input,
      });

      await queueOfflinePatchMutation({
        taskKey: input.taskKey,
        payload: {
          title: input.title,
          note: input.note,
          labelIds: input.labelIds,
          taskPriority: input.taskPriority,
          status: input.status,
          sortOrder: input.sortOrder,
          baseNoteFingerprint: input.baseNoteFingerprint,
        },
      });

      return optimistic;
    },
    [focusedTask, kanbanStore],
  );

  const queueTaskMove = useCallback(
    async (input: { sortOrder: string; status: KanbanStatus; taskKey: string }) => {
      await queueOfflinePatchMutation({
        taskKey: input.taskKey,
        payload: {
          status: input.status,
          sortOrder: input.sortOrder,
        },
      });
    },
    [],
  );

  return (
    <BoardOfflineSyncContext.Provider
      value={{
        online,
        queueTaskCreate,
        queueTaskMove,
        queueTaskPatch,
      }}
    >
      {children}
    </BoardOfflineSyncContext.Provider>
  );
}
