import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { taskNotifications } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';
import { ENTITY_NOTIFICATION, NOTIFICATION_CREATED, writeOutboxEvent } from '@/lib/outbox';

const DEFAULT_NOTIFICATION_LIMIT = 20;
const MAX_NOTIFICATION_LIMIT = 50;

export type TaskNotification = typeof taskNotifications.$inferSelect;

type TaskNotificationRow = {
  id: unknown;
  owner_id?: unknown;
  ownerId?: unknown;
  project_id?: unknown;
  projectId?: unknown;
  task_id?: unknown;
  taskId?: unknown;
  task_key?: unknown;
  taskKey?: unknown;
  task_title?: unknown;
  taskTitle?: unknown;
  status_from?: unknown;
  statusFrom?: unknown;
  status_to?: unknown;
  statusTo?: unknown;
  read_at?: unknown;
  readAt?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
};

type TaskNotificationFilter = {
  fromStatus?: string | null;
  toStatus?: string | null;
  previousRunState?: string | null;
  nextRunState?: string | null;
  lifecycleAction?: string | null;
};

type CreateTaskCompletionNotificationParams = TaskNotificationFilter & {
  tx: DbClientOrTx;
  ownerId: string;
  projectId?: string | null;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  now?: Date;
};

type ListTaskNotificationsParams = {
  ownerId: string;
  history?: boolean;
  offset?: number;
  limit?: number;
};

type MarkTaskNotificationsReadParams = {
  ownerId: string;
  notificationIds: string[];
  now?: Date;
};

function normalizeStatus(value: string | null | undefined) {
  return (value || '').trim();
}

function clampLimit(limit?: number) {
  if (!Number.isFinite(limit) || !limit || limit < 1) {
    return DEFAULT_NOTIFICATION_LIMIT;
  }

  return Math.min(Math.trunc(limit), MAX_NOTIFICATION_LIMIT);
}

function normalizeOffset(offset?: number) {
  if (!Number.isFinite(offset) || !offset || offset < 0) {
    return 0;
  }

  return Math.trunc(offset);
}

function toDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resultRows(result: unknown) {
  if (
    result &&
    typeof result === 'object' &&
    'rows' in result &&
    Array.isArray((result as { rows: unknown[] }).rows)
  ) {
    return (result as { rows: TaskNotificationRow[] }).rows;
  }

  return [] as TaskNotificationRow[];
}

function mapTaskNotificationRow(row: TaskNotificationRow): TaskNotification {
  return {
    id: String(row.id),
    ownerId: String(row.ownerId ?? row.owner_id ?? ''),
    projectId: (row.projectId ?? row.project_id ?? null) as string | null,
    taskId: String(row.taskId ?? row.task_id ?? ''),
    taskKey: String(row.taskKey ?? row.task_key ?? ''),
    taskTitle: String(row.taskTitle ?? row.task_title ?? ''),
    statusFrom: String(row.statusFrom ?? row.status_from ?? ''),
    statusTo: String(row.statusTo ?? row.status_to ?? ''),
    readAt: toDate(row.readAt ?? row.read_at),
    createdAt: toDate(row.createdAt ?? row.created_at) ?? new Date(0),
  };
}

function buildTaskNotificationPayload(notification: TaskNotification) {
  return {
    id: notification.id,
    projectId: notification.projectId,
    taskId: notification.taskId,
    taskKey: notification.taskKey,
    taskTitle: notification.taskTitle,
    statusFrom: notification.statusFrom,
    statusTo: notification.statusTo,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export function shouldCreateTaskCompletionNotification(params: TaskNotificationFilter) {
  const fromStatus = normalizeStatus(params.fromStatus);
  const toStatus = normalizeStatus(params.toStatus);

  if (!fromStatus || !toStatus || fromStatus === toStatus) {
    return false;
  }

  if (toStatus !== 'ready' && toStatus !== 'done') {
    return false;
  }

  return (
    params.previousRunState === 'running' ||
    params.lifecycleAction === 'complete' ||
    params.lifecycleAction === 'review'
  );
}

export async function createTaskCompletionNotification(
  params: CreateTaskCompletionNotificationParams,
) {
  if (!shouldCreateTaskCompletionNotification(params)) {
    return null;
  }

  const [notification] = await params.tx
    .insert(taskNotifications)
    .values({
      ownerId: params.ownerId,
      projectId: params.projectId ?? null,
      taskId: params.taskId,
      taskKey: params.taskKey,
      taskTitle: params.taskTitle,
      statusFrom: normalizeStatus(params.fromStatus),
      statusTo: normalizeStatus(params.toStatus),
      readAt: null,
      createdAt: params.now ?? new Date(),
    })
    .returning();

  await writeOutboxEvent({
    tx: params.tx,
    ownerId: params.ownerId,
    projectId: params.projectId ?? null,
    eventType: NOTIFICATION_CREATED,
    entityType: ENTITY_NOTIFICATION,
    entityId: notification.id,
    payload: buildTaskNotificationPayload(notification),
  });

  return notification;
}

export function isMissingTaskNotificationsRelationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('task_notifications') && message.includes('does not exist');
}

export async function taskNotificationsStorageAvailable(client: DbClientOrTx = db) {
  try {
    const result = await client.execute(
      sql`select to_regclass('public.task_notifications') as relation_name`,
    );
    const rows = Array.isArray(result)
      ? result
      : Array.isArray((result as { rows?: unknown[] }).rows)
        ? (result as { rows: unknown[] }).rows
        : [];
    const firstRow = rows[0] ?? null;
    if (!firstRow || typeof firstRow !== 'object') return true;

    const relationName =
      (firstRow as Record<string, unknown>).relation_name ??
      (firstRow as Record<string, unknown>).relationName;

    return relationName === 'task_notifications' || relationName === 'public.task_notifications';
  } catch (error) {
    console.error('[task-notifications] failed to inspect task_notifications relation:', error);
    return true;
  }
}

export async function safeCreateTaskCompletionNotification(
  params: CreateTaskCompletionNotificationParams,
) {
  if (!(await taskNotificationsStorageAvailable(params.tx))) {
    return null;
  }

  try {
    return await createTaskCompletionNotification(params);
  } catch (error) {
    if (isMissingTaskNotificationsRelationError(error)) {
      console.error(
        '[task-notifications] storage unavailable, skipping notification write:',
        error,
      );
      return null;
    }
    throw error;
  }
}

export async function listTaskNotifications(
  params: ListTaskNotificationsParams,
  client: DbClientOrTx = db,
) {
  const offset = normalizeOffset(params.offset);
  const limit = clampLimit(params.limit);
  const readFilter = params.history ? sql`read_at is not null` : sql`read_at is null`;

  const countResult = await client.execute(sql`
    select count(*)::integer as count
    from task_notifications
    where owner_id = ${params.ownerId}
      and ${readFilter}
  `);
  const pageResult = await client.execute(sql`
    select
      id,
      owner_id,
      project_id,
      task_id,
      task_key,
      task_title,
      status_from,
      status_to,
      read_at,
      created_at
    from task_notifications
    where owner_id = ${params.ownerId}
      and ${readFilter}
    order by created_at desc, id desc
    limit ${limit}
    offset ${offset}
  `);

  const countRows = resultRows(countResult) as Array<{ count?: unknown }>;
  const total = Number(countRows[0]?.count ?? 0);
  const notifications = resultRows(pageResult).map(mapTaskNotificationRow);

  return {
    notifications,
    total,
    offset,
    limit,
    hasMore: offset + notifications.length < total,
  };
}

export async function markTaskNotificationsRead(
  params: MarkTaskNotificationsReadParams,
  client: DbClientOrTx = db,
) {
  const notificationIds = [
    ...new Set(params.notificationIds.map((id) => id.trim()).filter(Boolean)),
  ];

  if (notificationIds.length === 0) {
    return [];
  }

  const notificationIdList = sql.join(
    notificationIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const result = await client.execute(sql`
    update task_notifications
    set read_at = ${params.now ?? new Date()}
    where owner_id = ${params.ownerId}
      and read_at is null
      and id in (${notificationIdList})
    returning id
  `);

  return resultRows(result).map((row) => String(row.id));
}
