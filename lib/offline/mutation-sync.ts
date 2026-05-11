import {
  hydrateEditableBoardTask,
  type SerializedEditableBoardTask,
} from '@/lib/editable-board-task';
import type { KanbanTask } from '@/lib/kanban-helpers';
import type { EditableBoardTask } from '@/lib/kanban-store';
import type { OfflineCreateMutationPayload } from '@/lib/offline/db';
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

export type HandledOfflinePatchConflict = {
  boardTask: KanbanTask;
  error: string;
  focusedTask: EditableBoardTask | null;
  kind: 'patch';
  taskKey: string;
};

export type AppliedOfflineMutation =
  | {
      boardTask: KanbanTask;
      kind: 'create';
      previousTaskKey: string;
    }
  | {
      kind: 'delete';
      taskKey: string;
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

function isPermanentOfflineMutationFailure(status: number) {
  return status === 400 || status === 404 || status === 409 || status === 410 || status === 422;
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    return typeof payload.error === 'string' && payload.error.trim() ? payload.error : null;
  } catch {
    return null;
  }
}

function readStructuredErrorMessage(
  payload: { error?: unknown } | null,
  status: number,
  action: string,
) {
  if (typeof payload?.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  return `Failed to sync offline task ${action} (${status}).`;
}

function buildCreateReplayPayload(payload: OfflineCreateMutationPayload) {
  const { sortOrder: _sortOrder, ...replayPayload } = payload;
  return replayPayload;
}

export async function flushOfflineMutations(
  params: {
    fetchImpl?: typeof fetch;
    onApplied?: (mutation: AppliedOfflineMutation) => Promise<void> | void;
    onConflict?: (conflict: HandledOfflinePatchConflict) => Promise<void> | void;
  } = {},
): Promise<FlushOfflineMutationsResult> {
  const fetchImpl = params.fetchImpl ?? fetch;
  let appliedCount = 0;
  let skippedError: string | null = null;

  for (;;) {
    const mutation = (await listQueuedOfflineMutations())[0];
    if (!mutation) break;

    try {
      if (mutation.kind === 'create') {
        const response = await fetchImpl('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(buildCreateReplayPayload(mutation.payload)),
        });

        if (!response.ok) {
          const message = await readErrorMessage(response);
          const syncError = message ?? `Failed to sync offline task creation (${response.status}).`;
          if (isPermanentOfflineMutationFailure(response.status)) {
            await deleteOfflineMutation(mutation.id);
            skippedError ??= syncError;
            continue;
          }

          return {
            appliedCount,
            error: syncError,
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

      if (mutation.kind === 'delete') {
        const response = await fetchImpl(`/api/todos/${encodeURIComponent(mutation.taskKey)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        });

        if (!response.ok) {
          const message = await readErrorMessage(response);
          const syncError = message ?? `Failed to sync offline task delete (${response.status}).`;
          if (isPermanentOfflineMutationFailure(response.status)) {
            await deleteOfflineMutation(mutation.id);
            skippedError ??= syncError;
            continue;
          }

          return {
            appliedCount,
            error: syncError,
            halted: true,
          };
        }

        await deleteOfflineMutation(mutation.id);
        await params.onApplied?.({
          kind: 'delete',
          taskKey: mutation.taskKey,
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
        let structuredPayload: OfflinePatchResponse | null = null;
        try {
          structuredPayload = (await response.json()) as OfflinePatchResponse;
        } catch {
          structuredPayload = null;
        }

        const syncError = readStructuredErrorMessage(structuredPayload, response.status, 'update');
        if (response.status === 409 && structuredPayload?.boardTask) {
          await deleteOfflineMutation(mutation.id);
          await params.onConflict?.({
            kind: 'patch',
            taskKey: mutation.taskKey,
            error: syncError,
            boardTask: structuredPayload.boardTask,
            focusedTask: structuredPayload.focusedTask
              ? hydrateEditableBoardTask(structuredPayload.focusedTask)
              : null,
          });
          continue;
        }

        if (isPermanentOfflineMutationFailure(response.status)) {
          await deleteOfflineMutation(mutation.id);
          skippedError ??= syncError;
          continue;
        }

        return {
          appliedCount,
          error: syncError,
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

  return { appliedCount, error: skippedError, halted: false };
}
