import type { KanbanTask } from '@/lib/kanban-helpers';
import type { EditableBoardTask } from '@/lib/kanban-store';

type LabelUpdateResponse = {
  boardTask?: KanbanTask | null;
  focusedTask?: EditableBoardTask | null;
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
  upsertSnapshots: (tasks: KanbanTask[]) => void;
  setFocusedTask: (task: EditableBoardTask | null) => void;
  setSaveError: (message: string | null) => void;
  notifyError: (message: string) => void;
};

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

export async function updateKanbanTaskLabelsFromBoard({
  taskKey,
  labelIds,
  currentFocusedTaskKey,
  fetchImpl,
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
      setSaveError(message);
      notifyError(message);
      return false;
    }

    const payload = (await response.json()) as LabelUpdateResponse;
    if (payload.boardTask) {
      upsertSnapshots([payload.boardTask]);
    }

    if (currentFocusedTaskKey === taskKey && 'focusedTask' in payload) {
      setFocusedTask(payload.focusedTask ?? null);
    }

    return true;
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : fallbackMessage;
    setSaveError(message);
    notifyError(message);
    return false;
  }
}
