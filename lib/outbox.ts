import { db } from '@/lib/db';
import { eventsOutbox } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';

// Event type constants
export const TASK_CREATED = 'TASK_CREATED';
export const TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED';
export const TASK_UPDATED = 'TASK_UPDATED';
export const TASK_DELETED = 'TASK_DELETED';
export const WORKLOG_CREATED = 'WORKLOG_CREATED';
export const WORKLOG_UPDATED = 'WORKLOG_UPDATED';
export const WORKLOG_DELETED = 'WORKLOG_DELETED';
export const PROJECT_CREATED = 'PROJECT_CREATED';
export const PROJECT_UPDATED = 'PROJECT_UPDATED';
export const PROJECT_DELETED = 'PROJECT_DELETED';
export const NOTIFICATION_CREATED = 'NOTIFICATION_CREATED';
export const SETTING_UPDATED = 'SETTING_UPDATED';
export const TASK_LABEL_UPDATED = 'TASK_LABEL_UPDATED';

// Entity type constants
export const ENTITY_TASK = 'task';
export const ENTITY_WORKLOG = 'worklog';
export const ENTITY_PROJECT = 'project';
export const ENTITY_NOTIFICATION = 'notification';
export const ENTITY_SETTING = 'setting';
export const ENTITY_TASK_LABEL = 'task_label';

type WriteOutboxEventParams = {
  tx: DbClientOrTx;
  ownerId: string;
  projectId?: string | null;
  eventType: string;
  entityType: string;
  entityId: string;
  payload?: unknown;
};

export async function writeOutboxEvent(params: WriteOutboxEventParams) {
  await params.tx.insert(eventsOutbox).values({
    ownerId: params.ownerId,
    projectId: params.projectId ?? null,
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId,
    payload: params.payload ?? null,
  });
}

export async function writeOutboxEventStandalone(
  params: Omit<WriteOutboxEventParams, 'tx'>,
  client: DbClientOrTx = db,
) {
  await client.insert(eventsOutbox).values({
    ownerId: params.ownerId,
    projectId: params.projectId ?? null,
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId,
    payload: params.payload ?? null,
  });
}
