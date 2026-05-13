import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  type ConnectionExpirationNotification,
  isConnectionExpirationNotificationId,
  listConnectionExpirationNotifications,
  markAllConnectionExpirationNotificationsRead,
  markConnectionExpirationNotificationsRead,
} from '@/lib/connection-expiration-notifications';
import { withOwnerDb } from '@/lib/db/rls';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';
import {
  listTaskNotifications,
  markAllTaskNotificationsRead,
  markTaskNotificationsRead,
  type TaskNotification,
} from '@/lib/task-notifications';

const DEFAULT_NOTIFICATION_LIMIT = 20;
const MAX_NOTIFICATION_LIMIT = 50;
const MAX_MERGED_FETCH_LIMIT = 500;

const markNotificationsReadSchema = z.union([
  z.object({
    markAll: z.literal(true),
  }),
  z.object({
    notificationIds: z.array(z.string().trim().min(1)),
  }),
]);

function isMissingTaskNotificationsRelation(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as {
    code?: string;
    message?: string;
    cause?: { code?: string; message?: string };
  };
  const candidates = [maybeError, maybeError.cause].filter(Boolean);

  return candidates.some(
    (candidate) =>
      candidate?.code === '42P01' && candidate.message?.includes('task_notifications') === true,
  );
}

function parseHistoryFlag(value: string | null) {
  return value === '1' || value === 'true';
}

function parseOffset(value: string | null) {
  if (!value) return 0;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.trunc(parsed);
}

function parseLimit(value: string | null) {
  if (!value) return DEFAULT_NOTIFICATION_LIMIT;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_NOTIFICATION_LIMIT;
  }

  return Math.min(Math.trunc(parsed), MAX_NOTIFICATION_LIMIT);
}

function serializeNotification(notification: TaskNotification) {
  return {
    type: 'task' as const,
    ...notification,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

function serializeConnectionNotification(notification: ConnectionExpirationNotification) {
  return {
    id: notification.id,
    type: notification.type,
    source: notification.source,
    title: notification.title,
    targetName: notification.targetName,
    targetDetail: notification.targetDetail,
    expiresAt: notification.expiresAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

type SerializedNotification =
  | ReturnType<typeof serializeNotification>
  | ReturnType<typeof serializeConnectionNotification>;

function sortNotificationsByCreatedAt(left: SerializedNotification, right: SerializedNotification) {
  const createdAtDelta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  if (createdAtDelta !== 0) return createdAtDelta;
  return right.id.localeCompare(left.id);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const history = parseHistoryFlag(searchParams.get('history'));
  const limit = parseLimit(searchParams.get('limit'));
  const offset = parseOffset(searchParams.get('offset'));
  const mergedFetchLimit = Math.min(Math.max(offset + limit, limit), MAX_MERGED_FETCH_LIMIT);

  try {
    const owner = await requireOwnerUser();

    return await withOwnerDb(owner.id, async (client) => {
      const taskResult = await listTaskNotifications(
        {
          ownerId: owner.id,
          history,
          offset: 0,
          limit: mergedFetchLimit,
          maxLimit: mergedFetchLimit,
        },
        client,
      );
      const connectionResult = await listConnectionExpirationNotifications(
        {
          ownerId: owner.id,
          history,
          offset: 0,
          limit: mergedFetchLimit,
        },
        client,
      );
      const mergedNotifications = [
        ...taskResult.notifications.map(serializeNotification),
        ...connectionResult.notifications.map(serializeConnectionNotification),
      ].sort(sortNotificationsByCreatedAt);
      const notifications = mergedNotifications.slice(offset, offset + limit);
      const total = Math.min(taskResult.total + connectionResult.total, MAX_MERGED_FETCH_LIMIT);

      return NextResponse.json({
        notifications,
        total,
        offset,
        limit,
        hasMore: offset + notifications.length < total,
      });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (isMissingTaskNotificationsRelation(error)) {
      return NextResponse.json({
        notifications: [],
        total: 0,
        offset,
        limit,
        hasMore: false,
      });
    }
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const payload = markNotificationsReadSchema.parse(await req.json());

    return await withOwnerDb(owner.id, async (client) => {
      let updatedIds: string[];

      if ('markAll' in payload) {
        updatedIds = [
          ...(await markAllTaskNotificationsRead(
            {
              ownerId: owner.id,
            },
            client,
          )),
          ...(await markAllConnectionExpirationNotificationsRead(
            {
              ownerId: owner.id,
            },
            client,
          )),
        ];
      } else {
        const taskNotificationIds = payload.notificationIds.filter(
          (id) => !isConnectionExpirationNotificationId(id),
        );
        const connectionNotificationIds = payload.notificationIds.filter(
          isConnectionExpirationNotificationId,
        );

        updatedIds = [
          ...(taskNotificationIds.length > 0
            ? await markTaskNotificationsRead(
                {
                  ownerId: owner.id,
                  notificationIds: taskNotificationIds,
                },
                client,
              )
            : []),
          ...(connectionNotificationIds.length > 0
            ? await markConnectionExpirationNotificationsRead(
                {
                  ownerId: owner.id,
                  notificationIds: connectionNotificationIds,
                },
                client,
              )
            : []),
        ];
      }

      return NextResponse.json({
        ok: true,
        updatedIds,
      });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    if (isMissingTaskNotificationsRelation(error)) {
      return NextResponse.json({
        ok: true,
        updatedIds: [],
      });
    }
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
