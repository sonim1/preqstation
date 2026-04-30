import {
  hydrateEditableBoardTask,
  type SerializedEditableBoardTask,
} from '@/lib/editable-board-task';
import type { KanbanTask } from '@/lib/kanban-helpers';
import type { EditableBoardTask } from '@/lib/kanban-store';

type LabelUpdateResponse = {
  boardTask?: KanbanTask | null;
  focusedTask?: SerializedEditableBoardTask | null;
  error?: unknown;
};

type FetchLike = (
  input: string,
  init: {
    method: 'PATCH';
    headers: { 'Content-Type': 'application/json' };
    credentials: 'same-origin';
    body: string;
  },
) => Promise<{
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}>;

type UpdateKanbanTaskLabelsFromBoardParams = {
  taskKey: string;
  labelIds: string[];
  currentFocusedTaskKey: string | null;
  fetchImpl: FetchLike;
  queueOfflineUpdate?: () => Promise<{
    boardTask: KanbanTask;
    focusedTask: EditableBoardTask | null;
  }>;
  upsertSnapshots: (tasks: KanbanTask[]) => void;
  setFocusedTask: (task: EditableBoardTask | null) => void;
  setSaveError: (message: string | null) => void;
  notifyError: (message: string) => void;
};

function normalizeFocusedTask(
  task: EditableBoardTask | SerializedEditableBoardTask | null | undefined,
) {
  if (!task) {
    return null;
  }

  const firstWorkLog = task.workLogs[0];
  return typeof firstWorkLog?.workedAt === 'string'
    ? hydrateEditableBoardTask(task as SerializedEditableBoardTask)
    : (task as EditableBoardTask);
}

async function readLabelUpdateError(
  response: Awaited<ReturnType<FetchLike>>,
  fallbackMessage: string,
) {
  try {
    const payload = (await response.json()) as LabelUpdateResponse;
    if (typeof payload.error === 'string' && payload.error) {
      return payload.error;
    }
  } catch {
    /* ignore */
  }

  return response.status ? `Failed to save labels (${response.status}).` : fallbackMessage;
}

function applyLabelUpdateResult(params: {
  taskKey: string;
  currentFocusedTaskKey: string | null;
  boardTask: KanbanTask | null | undefined;
  focusedTask?: EditableBoardTask | SerializedEditableBoardTask | null;
  upsertSnapshots: (tasks: KanbanTask[]) => void;
  setFocusedTask: (task: EditableBoardTask | null) => void;
}) {
  if (params.boardTask) {
    params.upsertSnapshots([params.boardTask]);
  }

  if (params.currentFocusedTaskKey === params.taskKey && params.focusedTask !== undefined) {
    params.setFocusedTask(normalizeFocusedTask(params.focusedTask));
  }
}

async function tryQueueOfflineLabelUpdate(params: {
  taskKey: string;
  currentFocusedTaskKey: string | null;
  queueOfflineUpdate?: () => Promise<{
    boardTask: KanbanTask;
    focusedTask: EditableBoardTask | null;
  }>;
  upsertSnapshots: (tasks: KanbanTask[]) => void;
  setFocusedTask: (task: EditableBoardTask | null) => void;
}) {
  if (!params.queueOfflineUpdate) {
    return false;
  }

  try {
    const payload = await params.queueOfflineUpdate();
    applyLabelUpdateResult({
      taskKey: params.taskKey,
      currentFocusedTaskKey: params.currentFocusedTaskKey,
      boardTask: payload.boardTask,
      focusedTask: payload.focusedTask,
      upsertSnapshots: params.upsertSnapshots,
      setFocusedTask: params.setFocusedTask,
    });
    return true;
  } catch {
    return false;
  }
}

export async function updateKanbanTaskLabelsFromBoard({
  taskKey,
  labelIds,
  currentFocusedTaskKey,
  fetchImpl,
  queueOfflineUpdate,
  upsertSnapshots,
  setFocusedTask,
  setSaveError,
  notifyError,
}: UpdateKanbanTaskLabelsFromBoardParams) {
  const fallbackMessage = 'Failed to save labels.';
  setSaveError(null);

  try {
    const response = await fetchImpl(`/api/todos/${encodeURIComponent(taskKey)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ labelIds }),
    });

    if (!response.ok) {
      const message = await readLabelUpdateError(response, fallbackMessage);
      if (
        await tryQueueOfflineLabelUpdate({
          taskKey,
          currentFocusedTaskKey,
          queueOfflineUpdate,
          upsertSnapshots,
          setFocusedTask,
        })
      ) {
        return true;
      }
      setSaveError(message);
      notifyError(message);
      return false;
    }

    const payload = (await response.json()) as LabelUpdateResponse;
    applyLabelUpdateResult({
      taskKey,
      currentFocusedTaskKey,
      boardTask: payload.boardTask,
      focusedTask: payload.focusedTask,
      upsertSnapshots,
      setFocusedTask,
    });

    return true;
  } catch (error) {
    if (
      await tryQueueOfflineLabelUpdate({
        taskKey,
        currentFocusedTaskKey,
        queueOfflineUpdate,
        upsertSnapshots,
        setFocusedTask,
      })
    ) {
      return true;
    }

    const message = error instanceof Error && error.message ? error.message : fallbackMessage;
    setSaveError(message);
    notifyError(message);
    return false;
  }
}
