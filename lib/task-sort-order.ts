import { and, asc, desc, eq, ne } from 'drizzle-orm';

import { tasks } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';
import {
  generateKeyBetween,
  isFractionalOrderKey,
  needsRebalancing,
  rebalanceKeys,
} from '@/lib/fractional-ordering';
import type { TaskStatus } from '@/lib/task-meta';

export type TaskSortOrderClient = Pick<DbClientOrTx, 'query' | 'update'>;

export type LaneTaskRow = {
  id: string;
  taskKey?: string;
  sortOrder: string;
  dueAt: Date | null;
  createdAt: Date;
};

export const TASK_LANE_ORDER = [
  asc(tasks.sortOrder),
  asc(tasks.dueAt),
  desc(tasks.createdAt),
  asc(tasks.id),
];

export const TASK_BOARD_ORDER = [asc(tasks.status), ...TASK_LANE_ORDER];

function laneNeedsRepair(rows: LaneTaskRow[]) {
  return rows.some((row, index) => {
    const previousSortOrder = rows[index - 1]?.sortOrder ?? null;

    return (
      !isFractionalOrderKey(row.sortOrder) ||
      needsRebalancing(row.sortOrder) ||
      (previousSortOrder !== null && previousSortOrder >= row.sortOrder)
    );
  });
}

export async function listLaneTasks(params: {
  client: TaskSortOrderClient;
  ownerId: string;
  status: TaskStatus;
  excludeTaskId?: string;
}): Promise<LaneTaskRow[]> {
  return params.client.query.tasks.findMany({
    where: and(
      eq(tasks.ownerId, params.ownerId),
      eq(tasks.status, params.status),
      params.excludeTaskId ? ne(tasks.id, params.excludeTaskId) : undefined,
    ),
    columns: { id: true, taskKey: true, sortOrder: true, dueAt: true, createdAt: true },
    orderBy: TASK_LANE_ORDER,
  });
}

export async function repairLaneIfNeeded(params: {
  client: TaskSortOrderClient;
  ownerId: string;
  status: TaskStatus;
  excludeTaskId?: string;
}): Promise<{ rows: LaneTaskRow[]; repaired: boolean }> {
  const rows = await listLaneTasks(params);
  if (!laneNeedsRepair(rows)) {
    return { rows, repaired: false };
  }

  const nextKeys = rebalanceKeys(rows.length);
  for (const [index, row] of rows.entries()) {
    await params.client
      .update(tasks)
      .set({ sortOrder: nextKeys[index] })
      .where(eq(tasks.id, row.id));
  }

  return {
    rows: rows.map((row, index) => ({ ...row, sortOrder: nextKeys[index] })),
    repaired: true,
  };
}

export async function resolveRequestedTaskSortOrder(params: {
  client: TaskSortOrderClient;
  ownerId: string;
  status: TaskStatus;
  requestedSortOrder: string | null | undefined;
  excludeTaskId?: string;
}): Promise<{ rows: LaneTaskRow[]; sortOrder: string }> {
  const { rows } = await repairLaneIfNeeded(params);
  const requestedSortOrder = params.requestedSortOrder;

  if (!requestedSortOrder || !isFractionalOrderKey(requestedSortOrder)) {
    return {
      rows,
      sortOrder: generateKeyBetween(rows.at(-1)?.sortOrder ?? null, null),
    };
  }

  if (needsRebalancing(requestedSortOrder)) {
    return {
      rows,
      sortOrder: generateKeyBetween(rows.at(-1)?.sortOrder ?? null, null),
    };
  }

  const nextIndex = rows.findIndex((row) => row.sortOrder >= requestedSortOrder);
  if (nextIndex === -1) {
    const previousSortOrder = rows.at(-1)?.sortOrder ?? null;
    return {
      rows,
      sortOrder:
        previousSortOrder === null || previousSortOrder < requestedSortOrder
          ? requestedSortOrder
          : generateKeyBetween(previousSortOrder, null),
    };
  }

  const previousSortOrder = rows[nextIndex - 1]?.sortOrder ?? null;
  const nextSortOrder = rows[nextIndex]?.sortOrder ?? null;
  const isStrictlyBetween =
    (previousSortOrder === null || previousSortOrder < requestedSortOrder) &&
    (nextSortOrder === null || requestedSortOrder < nextSortOrder);

  return {
    rows,
    sortOrder: isStrictlyBetween
      ? requestedSortOrder
      : generateKeyBetween(previousSortOrder, nextSortOrder),
  };
}

export async function resolveMoveIntentPlacement(params: {
  client: TaskSortOrderClient;
  ownerId: string;
  taskId: string;
  fromStatus: TaskStatus;
  targetStatus: TaskStatus;
  afterTaskKey: string | null;
  beforeTaskKey: string | null;
}): Promise<{ sortOrder: string; targetRows: LaneTaskRow[]; sourceRows: LaneTaskRow[] }> {
  const { rows: targetRows } = await repairLaneIfNeeded({
    client: params.client,
    ownerId: params.ownerId,
    status: params.targetStatus,
    excludeTaskId: params.taskId,
  });
  const sourceRows =
    params.fromStatus === params.targetStatus
      ? []
      : (
          await repairLaneIfNeeded({
            client: params.client,
            ownerId: params.ownerId,
            status: params.fromStatus,
            excludeTaskId: params.taskId,
          })
        ).rows;

  const afterRow =
    params.afterTaskKey !== null
      ? (targetRows.find((row) => row.taskKey === params.afterTaskKey) ?? null)
      : null;
  const beforeRow =
    params.beforeTaskKey !== null
      ? (targetRows.find((row) => row.taskKey === params.beforeTaskKey) ?? null)
      : null;

  let sortOrder: string;
  if (afterRow && beforeRow && afterRow.sortOrder < beforeRow.sortOrder) {
    sortOrder = generateKeyBetween(afterRow.sortOrder, beforeRow.sortOrder);
  } else if (afterRow) {
    sortOrder = generateKeyBetween(afterRow.sortOrder, null);
  } else if (beforeRow) {
    sortOrder = generateKeyBetween(null, beforeRow.sortOrder);
  } else {
    sortOrder = generateKeyBetween(targetRows.at(-1)?.sortOrder ?? null, null);
  }

  return { sortOrder, targetRows, sourceRows };
}

export async function resolveAppendSortOrder(params: {
  client: TaskSortOrderClient;
  ownerId: string;
  status: TaskStatus;
}): Promise<string> {
  const { rows } = await repairLaneIfNeeded(params);
  if (rows.length === 0) {
    return generateKeyBetween(null, null);
  }

  const tailSortOrder = rows.at(-1)?.sortOrder ?? null;
  return generateKeyBetween(tailSortOrder, null);
}
