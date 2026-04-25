import {
  hydrateEditableBoardTask,
  type SerializedEditableBoardTask,
} from '@/lib/editable-board-task';
import type { KanbanTask } from '@/lib/kanban-helpers';
import type { EditableBoardTask } from '@/lib/kanban-store';
import {
  deleteOfflineMutation,
  listQueuedOfflineMutations,
  rekeyOfflinePatchMutation,
} from '@/lib/offline/mutation-store';

type OfflineCreateResponse = {
  boardTask?: KanbanTask;
  error?: string;
};

type OfflinePatchResponse = {
  boardTask?: KanbanTask;
  error?: string;
  focusedTask?: SerializedEditableBoardTask;
};

export type AppliedOfflineMutation =
  | {
      boardTask: KanbanTask;
      kind: 'create';
      previousTaskKey: string;
    }
  | {
      boardTask: KanbanTask;
      focusedTask: EditableBoardTask | null;
      kind: 'patch';
      taskKey: string;
    };

export type FlushOfflineMutationsResult = {
  appliedCount: number;
  error: string | null;
  halted: boolean;
};

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    return typeof payload.error === 'string' && payload.error.trim() ? payload.error : null;
  } catch {
    return null;
  }
}

export async function flushOfflineMutations(
  params: {
    fetchImpl?: typeof fetch;
    onApplied?: (mutation: AppliedOfflineMutation) => Promise<void> | void;
  } = {},
): Promise<FlushOfflineMutationsResult> {
  const fetchImpl = params.fetchImpl ?? fetch;
  let appliedCount = 0;
  const queuedMutations = await listQueuedOfflineMutations();

  for (const mutation of queuedMutations) {
    try {
      if (mutation.kind === 'create') {
        const response = await fetchImpl('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(mutation.payload),
        });

        if (!response.ok) {
          const message = await readErrorMessage(response);
          return {
            appliedCount,
            error: message ?? `Failed to sync offline task creation (${response.status}).`,
            halted: true,
          };
        }

        const payload = (await response.json()) as OfflineCreateResponse;
        if (!payload.boardTask) {
          return {
            appliedCount,
            error: 'Offline task creation synced without a board task payload.',
            halted: true,
          };
        }

        await deleteOfflineMutation(mutation.id);
        await rekeyOfflinePatchMutation({
          previousTaskKey: mutation.clientTaskKey,
          nextTaskKey: payload.boardTask.taskKey,
        });
        await params.onApplied?.({
          kind: 'create',
          previousTaskKey: mutation.clientTaskKey,
          boardTask: payload.boardTask,
        });
        appliedCount += 1;
        continue;
      }

      const response = await fetchImpl(`/api/todos/${encodeURIComponent(mutation.taskKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(mutation.payload),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response);
        return {
          appliedCount,
          error: message ?? `Failed to sync offline task update (${response.status}).`,
          halted: true,
        };
      }

      const payload = (await response.json()) as OfflinePatchResponse;
      if (!payload.boardTask) {
        return {
          appliedCount,
          error: 'Offline task update synced without a board task payload.',
          halted: true,
        };
      }

      await deleteOfflineMutation(mutation.id);
      await params.onApplied?.({
        kind: 'patch',
        taskKey: mutation.taskKey,
        boardTask: payload.boardTask,
        focusedTask: payload.focusedTask ? hydrateEditableBoardTask(payload.focusedTask) : null,
      });
      appliedCount += 1;
    } catch (error) {
      if (error instanceof TypeError) {
        return { appliedCount, error: null, halted: true };
      }

      return {
        appliedCount,
        error:
          error instanceof Error && error.message
            ? error.message
            : 'Failed to sync queued offline task changes.',
        halted: true,
      };
    }
  }

  return { appliedCount, error: null, halted: false };
}
