export type PolledTaskEvent = {
  id: string;
  eventType?: string;
  entityType?: string;
  entityId?: string;
  payload?: unknown;
  createdAt?: string;
};

export type PolledNotification = {
  id: string;
  projectId: string | null;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  statusFrom: string;
  statusTo: string;
  readAt: string | null;
  createdAt: string;
};

type PolledTaskEventSubscriber = (events: PolledTaskEvent[]) => boolean | Promise<boolean>;

const subscribers = new Set<PolledTaskEventSubscriber>();

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

export function extractCreatedNotificationsFromPolledEvents(events: PolledTaskEvent[]) {
  const notifications: PolledNotification[] = [];

  for (const event of events) {
    if (event.entityType !== 'notification' || event.eventType !== 'NOTIFICATION_CREATED') {
      continue;
    }

    const payload = isObject(event.payload) ? event.payload : null;
    if (!payload) {
      continue;
    }

    const id = readString(payload.id) ?? event.entityId ?? null;
    const taskId = readString(payload.taskId);
    const taskKey = readString(payload.taskKey);
    const taskTitle = readString(payload.taskTitle);
    const statusFrom = readString(payload.statusFrom);
    const statusTo = readString(payload.statusTo);
    const createdAt = readString(payload.createdAt) ?? event.createdAt ?? null;

    if (!id || !taskId || !taskKey || !taskTitle || !statusFrom || !statusTo || !createdAt) {
      continue;
    }

    notifications.push({
      id,
      projectId: readString(payload.projectId),
      taskId,
      taskKey,
      taskTitle,
      statusFrom,
      statusTo,
      readAt: readString(payload.readAt),
      createdAt,
    });
  }

  return notifications;
}

export function subscribePolledTaskEvents(subscriber: PolledTaskEventSubscriber) {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export async function publishPolledTaskEvents(events: PolledTaskEvent[]) {
  let handled = false;

  for (const subscriber of subscribers) {
    try {
      handled = (await subscriber(events)) || handled;
    } catch (error) {
      console.error('[event-poll-subscriptions] subscriber failed:', error);
    }
  }

  return handled;
}
