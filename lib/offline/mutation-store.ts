import type { KanbanStatus, KanbanTask } from '@/lib/kanban-helpers';
import { buildEditableBoardTaskPreview, type EditableBoardTask } from '@/lib/kanban-store';
import {
  type OfflineCreateMutationPayload,
  type OfflineCreateMutationRecord,
  type OfflineMutationRecord,
  type OfflinePatchMutationPayload,
  type OfflinePatchMutationRecord,
  openOfflineDb,
} from '@/lib/offline/db';

type OptimisticProject = {
  id: string;
  name: string;
  projectKey?: string | null;
};

type OptimisticLabel = {
  color: string | null;
  id: string;
  name: string;
};

export type QueueOfflineCreateInput = {
  labels: OptimisticLabel[];
  note: string;
  project: OptimisticProject;
  status?: KanbanStatus;
  taskPriority: string;
  title: string;
};

export type QueueOfflinePatchInput = {
  labelIds?: string[];
  labels?: OptimisticLabel[];
  note?: string;
  sortOrder?: string;
  status?: KanbanStatus;
  taskKey: string;
  taskPriority?: string;
  title?: string;
};

export function buildOfflineCreateMutationId(taskKey: string) {
  return `create:${taskKey}`;
}

export function buildOfflinePatchMutationId(taskKey: string) {
  return `patch:${taskKey}`;
}

function buildOfflineKeyPart() {
  const randomDigits = Math.floor(Math.random() * 1_000_000_000)
    .toString()
    .padStart(9, '0');
  return randomDigits === '000000000' ? '000000001' : randomDigits;
}

export function buildOfflineTaskKey() {
  return `OFFLINE-${buildOfflineKeyPart()}`;
}

export function buildOfflineTaskId() {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) {
    return `offline-task:${randomId}`;
  }

  return `offline-task:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

export function listMutationRecords(records: OfflineMutationRecord[]) {
  return [...records].sort((left, right) => {
    const createdAtDiff = left.createdAt.localeCompare(right.createdAt);
    if (createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

export function buildOptimisticTask(params: {
  id: string;
  labels: OptimisticLabel[];
  note: string;
  project: OptimisticProject;
  sortOrder: string;
  status: KanbanStatus;
  taskKey: string;
  taskPriority: string;
  title: string;
}): KanbanTask {
  const updatedAt = new Date().toISOString();

  return {
    id: params.id,
    taskKey: params.taskKey,
    branch: null,
    title: params.title,
    note: params.note,
    status: params.status,
    sortOrder: params.sortOrder,
    taskPriority: params.taskPriority,
    dueAt: null,
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    project: {
      id: params.project.id,
      name: params.project.name,
      projectKey: params.project.projectKey ?? 'LOCAL',
    },
    updatedAt,
    archivedAt: params.status === 'archived' ? updatedAt : null,
    labels: params.labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color ?? 'blue',
    })),
  };
}

export function applyOptimisticTaskPatch(params: {
  boardTask: KanbanTask;
  focusedTask: EditableBoardTask | null;
  patch: QueueOfflinePatchInput;
}) {
  const nextBoardTask: KanbanTask = {
    ...params.boardTask,
    title: params.patch.title ?? params.boardTask.title,
    note: params.patch.note ?? params.boardTask.note,
    status: params.patch.status ?? params.boardTask.status,
    sortOrder: params.patch.sortOrder ?? params.boardTask.sortOrder,
    taskPriority: params.patch.taskPriority ?? params.boardTask.taskPriority,
    updatedAt: new Date().toISOString(),
    archivedAt:
      (params.patch.status ?? params.boardTask.status) === 'archived'
        ? new Date().toISOString()
        : null,
    labels:
      params.patch.labels?.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color ?? 'blue',
      })) ?? params.boardTask.labels,
  };

  const nextFocusedTask =
    params.focusedTask && params.focusedTask.taskKey === params.patch.taskKey
      ? {
          ...params.focusedTask,
          title: params.patch.title ?? params.focusedTask.title,
          note: params.patch.note ?? params.focusedTask.note,
          status: params.patch.status ?? params.focusedTask.status,
          taskPriority: params.patch.taskPriority ?? params.focusedTask.taskPriority,
          labelIds: params.patch.labelIds ?? params.focusedTask.labelIds,
          labels:
            params.patch.labels?.map((label) => ({
              id: label.id,
              name: label.name,
              color: label.color,
            })) ?? params.focusedTask.labels,
        }
      : null;

  return { boardTask: nextBoardTask, focusedTask: nextFocusedTask };
}

export async function listQueuedOfflineMutations() {
  const db = await openOfflineDb();
  return listMutationRecords(await db.getAll('mutations'));
}

export async function queueOfflineCreateMutation(params: {
  payload: OfflineCreateMutationPayload;
  taskKey: string;
}) {
  const db = await openOfflineDb();
  const existingRecord = await db.get('mutations', buildOfflineCreateMutationId(params.taskKey));
  const record: OfflineCreateMutationRecord = {
    id: buildOfflineCreateMutationId(params.taskKey),
    kind: 'create',
    clientTaskKey: params.taskKey,
    createdAt:
      existingRecord?.kind === 'create' ? existingRecord.createdAt : new Date().toISOString(),
    payload:
      existingRecord?.kind === 'create'
        ? { ...existingRecord.payload, ...params.payload }
        : params.payload,
  };

  await db.put('mutations', record);
  return record;
}

export async function queueOfflinePatchMutation(params: {
  payload: OfflinePatchMutationPayload;
  taskKey: string;
}) {
  const db = await openOfflineDb();
  const createId = buildOfflineCreateMutationId(params.taskKey);
  const existingCreateRecord = await db.get('mutations', createId);
  if (existingCreateRecord?.kind === 'create') {
    const nextCreateRecord: OfflineCreateMutationRecord = {
      ...existingCreateRecord,
      payload: {
        ...existingCreateRecord.payload,
        ...params.payload,
      },
    };

    await db.put('mutations', nextCreateRecord);
    return nextCreateRecord;
  }

  const patchId = buildOfflinePatchMutationId(params.taskKey);
  const existingPatchRecord = await db.get('mutations', patchId);
  const record: OfflinePatchMutationRecord = {
    id: patchId,
    kind: 'patch',
    createdAt:
      existingPatchRecord?.kind === 'patch'
        ? existingPatchRecord.createdAt
        : new Date().toISOString(),
    payload:
      existingPatchRecord?.kind === 'patch'
        ? { ...existingPatchRecord.payload, ...params.payload }
        : params.payload,
    taskKey: params.taskKey,
  };

  await db.put('mutations', record);
  return record;
}

export async function deleteOfflineMutation(id: string) {
  const db = await openOfflineDb();
  await db.delete('mutations', id);
}

export async function rekeyOfflinePatchMutation(params: {
  nextTaskKey: string;
  previousTaskKey: string;
}) {
  const db = await openOfflineDb();
  const previousRecord = await db.get(
    'mutations',
    buildOfflinePatchMutationId(params.previousTaskKey),
  );
  if (previousRecord?.kind !== 'patch') {
    return null;
  }

  const nextId = buildOfflinePatchMutationId(params.nextTaskKey);
  const nextRecord = await db.get('mutations', nextId);
  const rekeyedRecord: OfflinePatchMutationRecord = {
    id: nextId,
    kind: 'patch',
    createdAt:
      nextRecord?.kind === 'patch' && nextRecord.createdAt < previousRecord.createdAt
        ? nextRecord.createdAt
        : previousRecord.createdAt,
    payload:
      nextRecord?.kind === 'patch'
        ? { ...nextRecord.payload, ...previousRecord.payload }
        : previousRecord.payload,
    taskKey: params.nextTaskKey,
  };

  await db.put('mutations', rekeyedRecord);
  await db.delete('mutations', previousRecord.id);
  return rekeyedRecord;
}

export function buildOptimisticFocusedTask(task: KanbanTask) {
  return buildEditableBoardTaskPreview(task);
}
