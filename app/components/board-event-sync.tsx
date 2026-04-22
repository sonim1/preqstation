'use client';

import { useCallback, useEffect, useRef } from 'react';

import {
  hydrateEditableBoardTask,
  type SerializedEditableBoardTask,
} from '@/lib/editable-board-task';
import { subscribePolledTaskEvents } from '@/lib/event-poll-subscriptions';
import type { KanbanTask } from '@/lib/kanban-helpers';
import { putSnapshot } from '@/lib/offline/snapshot-store';

import {
  useKanbanFocusedTaskKey,
  useKanbanReconciliationPaused,
  useRemoveKanbanTask,
  useSetFocusedTask,
  useUpsertKanbanSnapshots,
} from './kanban-store-provider';

type BoardEventSyncProps = {
  projectId: string | null;
  onArchivedCountRefresh?: () => Promise<void> | void;
};

async function fetchTaskSnapshots(taskKeys: string[], projectId: string | null) {
  const params = new URLSearchParams();
  for (const taskKey of taskKeys) {
    params.append('taskKey', taskKey);
  }
  if (projectId) {
    params.set('projectId', projectId);
  }

  const response = await fetch(`/api/todos/snapshots?${params.toString()}`, {
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Snapshot refresh failed: ${response.status}`);
  }

  const payload = (await response.json()) as { tasks?: KanbanTask[] };
  return payload.tasks ?? [];
}

async function fetchFocusedTaskDetail(taskKey: string) {
  const response = await fetch(`/api/todos/${encodeURIComponent(taskKey)}`, {
    credentials: 'same-origin',
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Focused task refresh failed: ${response.status}`);
  }

  const payload = (await response.json()) as { todo?: SerializedEditableBoardTask | null };
  return payload.todo ? hydrateEditableBoardTask(payload.todo) : null;
}

function appendTaskKeys(params: {
  changedTaskKeys: string[];
  deletedTaskKeys: string[];
  changedTaskKeyBuffer: Set<string>;
  deletedTaskKeyBuffer: Set<string>;
}) {
  for (const taskKey of params.deletedTaskKeys) {
    params.deletedTaskKeyBuffer.add(taskKey);
    params.changedTaskKeyBuffer.delete(taskKey);
  }

  for (const taskKey of params.changedTaskKeys) {
    if (!params.deletedTaskKeyBuffer.has(taskKey)) {
      params.changedTaskKeyBuffer.add(taskKey);
    }
  }
}

function extractTaskKeys(events: Array<Record<string, unknown>>) {
  const taskEvents = events.filter(
    (event) => event.entityType === 'task' && typeof event.entityId === 'string',
  );
  if (taskEvents.length === 0) {
    return null;
  }

  return {
    deletedTaskKeys: [
      ...new Set(
        taskEvents
          .filter((event) => event.eventType === 'TASK_DELETED')
          .map((event) => event.entityId as string),
      ),
    ],
    changedTaskKeys: [
      ...new Set(
        taskEvents
          .filter((event) => event.eventType !== 'TASK_DELETED')
          .map((event) => event.entityId as string),
      ),
    ],
  };
}

export function BoardEventSync({ projectId, onArchivedCountRefresh }: BoardEventSyncProps) {
  const focusedTaskKey = useKanbanFocusedTaskKey();
  const isReconciliationPaused = useKanbanReconciliationPaused();
  const removeTask = useRemoveKanbanTask();
  const setFocusedTask = useSetFocusedTask();
  const upsertSnapshots = useUpsertKanbanSnapshots();
  const projectScopeRef = useRef(projectId);
  const bufferedChangedTaskKeysRef = useRef(new Set<string>());
  const bufferedDeletedTaskKeysRef = useRef(new Set<string>());
  const isReconcilingRef = useRef(false);

  const flushBufferedTaskKeys = useCallback(
    async function flushBufferedTaskKeys() {
      if (isReconciliationPaused || isReconcilingRef.current) {
        return true;
      }

      const deletedTaskKeys = [...bufferedDeletedTaskKeysRef.current];
      const changedTaskKeys = [...bufferedChangedTaskKeysRef.current];

      if (deletedTaskKeys.length === 0 && changedTaskKeys.length === 0) {
        return true;
      }

      isReconcilingRef.current = true;
      bufferedDeletedTaskKeysRef.current.clear();
      bufferedChangedTaskKeysRef.current.clear();
      const reconciliationProjectId = projectScopeRef.current;

      try {
        for (const taskKey of deletedTaskKeys) {
          removeTask(taskKey);
        }

        if (changedTaskKeys.length > 0) {
          const snapshots = await fetchTaskSnapshots(changedTaskKeys, reconciliationProjectId);
          if (projectScopeRef.current !== reconciliationProjectId) {
            return true;
          }

          const returnedTaskKeys = new Set(snapshots.map((task) => task.taskKey));
          if (snapshots.length > 0) {
            await Promise.all(
              snapshots.map((task) =>
                putSnapshot({
                  id: `task:${task.taskKey}`,
                  kind: 'task',
                  entityKey: task.taskKey,
                  payload: task,
                  updatedAt: new Date().toISOString(),
                }),
              ),
            );
            upsertSnapshots(snapshots);
          }

          for (const taskKey of changedTaskKeys) {
            if (!returnedTaskKeys.has(taskKey)) {
              removeTask(taskKey);
            }
          }
        }

        if (focusedTaskKey) {
          if (deletedTaskKeys.includes(focusedTaskKey)) {
            setFocusedTask(null);
          } else if (changedTaskKeys.includes(focusedTaskKey)) {
            const nextFocusedTask = await fetchFocusedTaskDetail(focusedTaskKey);
            if (projectScopeRef.current !== reconciliationProjectId) {
              return true;
            }

            setFocusedTask(nextFocusedTask);
          }
        }

        if (onArchivedCountRefresh) {
          try {
            await onArchivedCountRefresh();
          } catch (error) {
            console.error('[board-event-sync] archived count refresh failed:', error);
          }
        }

        return true;
      } catch (error) {
        appendTaskKeys({
          changedTaskKeys,
          deletedTaskKeys,
          changedTaskKeyBuffer: bufferedChangedTaskKeysRef.current,
          deletedTaskKeyBuffer: bufferedDeletedTaskKeysRef.current,
        });
        console.error('[board-event-sync] targeted reconciliation failed:', error);
        return false;
      } finally {
        isReconcilingRef.current = false;
        if (
          !isReconciliationPaused &&
          (bufferedDeletedTaskKeysRef.current.size > 0 ||
            bufferedChangedTaskKeysRef.current.size > 0)
        ) {
          void flushBufferedTaskKeys();
        }
      }
    },
    [
      focusedTaskKey,
      isReconciliationPaused,
      onArchivedCountRefresh,
      removeTask,
      setFocusedTask,
      upsertSnapshots,
    ],
  );

  useEffect(() => {
    if (projectScopeRef.current === projectId) {
      return;
    }

    projectScopeRef.current = projectId;
    bufferedChangedTaskKeysRef.current.clear();
    bufferedDeletedTaskKeysRef.current.clear();
  }, [projectId]);

  useEffect(() => {
    return subscribePolledTaskEvents(async (events) => {
      const taskKeys = extractTaskKeys(events);
      if (!taskKeys) {
        return false;
      }

      appendTaskKeys({
        ...taskKeys,
        changedTaskKeyBuffer: bufferedChangedTaskKeysRef.current,
        deletedTaskKeyBuffer: bufferedDeletedTaskKeysRef.current,
      });

      if (isReconciliationPaused) {
        return true;
      }

      return flushBufferedTaskKeys();
    });
  }, [flushBufferedTaskKeys, isReconciliationPaused]);

  useEffect(() => {
    if (isReconciliationPaused) {
      return;
    }

    void flushBufferedTaskKeys();
  }, [flushBufferedTaskKeys, isReconciliationPaused]);

  return null;
}
