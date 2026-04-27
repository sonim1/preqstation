import { NextResponse } from 'next/server';
import { z } from 'zod';

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
    ...notification,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const history = parseHistoryFlag(searchParams.get('history'));
  const offset = parseOffset(searchParams.get('offset'));
  const limit = parseLimit(searchParams.get('limit'));

  try {
    const owner = await requireOwnerUser();

    return await withOwnerDb(owner.id, async (client) => {
      const result = await listTaskNotifications(
        {
          ownerId: owner.id,
          history,
          offset,
          limit,
        },
        client,
      );

      return NextResponse.json({
        notifications: result.notifications.map(serializeNotification),
        total: result.total,
        offset: result.offset,
        limit: result.limit,
        hasMore: result.hasMore,
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
      const updatedIds =
        'markAll' in payload
          ? await markAllTaskNotificationsRead(
              {
                ownerId: owner.id,
              },
              client,
            )
          : await markTaskNotificationsRead(
              {
                ownerId: owner.id,
                notificationIds: payload.notificationIds,
              },
              client,
            );

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
