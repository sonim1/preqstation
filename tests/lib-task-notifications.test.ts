import { beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '33333333-3333-4333-8333-333333333333';

const mocked = vi.hoisted(() => {
  const writeOutboxEvent = vi.fn().mockResolvedValue(undefined);
  const returningFn = vi.fn();
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
  const insertFn = vi.fn().mockReturnValue({ values: valuesFn });
  const executeFn = vi.fn();

  return {
    writeOutboxEvent,
    db: {
      execute: executeFn,
      insert: insertFn,
    },
    executeFn,
    insertFn,
    valuesFn,
    returningFn,
  };
});

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/outbox', () => ({
  ENTITY_NOTIFICATION: 'notification',
  NOTIFICATION_CREATED: 'NOTIFICATION_CREATED',
  writeOutboxEvent: mocked.writeOutboxEvent,
}));

import {
  createTaskCompletionNotification,
  isMissingTaskNotificationsRelationError,
  listTaskNotifications,
  markAllTaskNotificationsRead,
  markTaskNotificationsRead,
  safeCreateTaskCompletionNotification,
  shouldCreateTaskCompletionNotification,
  taskNotificationsStorageAvailable,
} from '@/lib/task-notifications';

function flattenQueryChunks(query: unknown): unknown[] {
  if (query && typeof query === 'object') {
    if (
      'queryChunks' in query &&
      Array.isArray((query as { queryChunks: unknown[] }).queryChunks)
    ) {
      return (query as { queryChunks: unknown[] }).queryChunks.flatMap((chunk) =>
        flattenQueryChunks(chunk),
      );
    }

    if ('value' in query) {
      const value = (query as { value: unknown }).value;
      return Array.isArray(value) ? value.flatMap((chunk) => flattenQueryChunks(chunk)) : [value];
    }
  }

  return [query];
}

function queryText(query: unknown) {
  return flattenQueryChunks(query)
    .filter((chunk): chunk is string => typeof chunk === 'string')
    .join(' ');
}

describe('lib/task-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.writeOutboxEvent.mockResolvedValue(undefined);
    mocked.executeFn.mockResolvedValue({
      rows: [{ relation_name: 'task_notifications' }],
    });
    mocked.returningFn.mockResolvedValue([
      {
        id: 'notif-1',
        ownerId: OWNER_ID,
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        taskKey: 'PROJ-327',
        taskTitle: 'Ship PREQ completion fix',
        statusFrom: 'todo',
        statusTo: 'ready',
        readAt: null,
        createdAt: new Date('2026-04-08T04:25:00.000Z'),
      },
    ]);
  });

  it('creates completion notifications only for qualifying task-finish transitions', () => {
    expect(
      shouldCreateTaskCompletionNotification({
        fromStatus: 'todo',
        toStatus: 'ready',
        previousRunState: 'running',
      }),
    ).toBe(true);

    expect(
      shouldCreateTaskCompletionNotification({
        fromStatus: 'ready',
        toStatus: 'done',
        lifecycleAction: 'review',
      }),
    ).toBe(true);

    expect(
      shouldCreateTaskCompletionNotification({
        fromStatus: 'todo',
        toStatus: 'hold',
        previousRunState: 'running',
      }),
    ).toBe(false);

    expect(
      shouldCreateTaskCompletionNotification({
        fromStatus: 'todo',
        toStatus: 'ready',
        previousRunState: null,
      }),
    ).toBe(false);

    expect(
      shouldCreateTaskCompletionNotification({
        fromStatus: 'ready',
        toStatus: 'ready',
        previousRunState: 'running',
      }),
    ).toBe(false);
  });

  it('writes one durable notification row and one outbox event for a qualifying transition', async () => {
    const notification = await createTaskCompletionNotification({
      tx: { insert: mocked.insertFn } as never,
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      taskKey: 'PROJ-327',
      taskTitle: 'Ship PREQ completion fix',
      fromStatus: 'todo',
      toStatus: 'ready',
      previousRunState: 'running',
      lifecycleAction: 'complete',
      now: new Date('2026-04-08T04:25:00.000Z'),
    });

    expect(notification).toEqual(
      expect.objectContaining({
        id: 'notif-1',
        taskKey: 'PROJ-327',
        statusTo: 'ready',
      }),
    );
    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: OWNER_ID,
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        taskKey: 'PROJ-327',
        taskTitle: 'Ship PREQ completion fix',
        statusFrom: 'todo',
        statusTo: 'ready',
        readAt: null,
        createdAt: new Date('2026-04-08T04:25:00.000Z'),
      }),
    );
    expect(mocked.writeOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: OWNER_ID,
        projectId: PROJECT_ID,
        eventType: 'NOTIFICATION_CREATED',
        entityType: 'notification',
        entityId: 'notif-1',
        payload: expect.objectContaining({
          id: 'notif-1',
          taskKey: 'PROJ-327',
          statusTo: 'ready',
        }),
      }),
    );
  });

  it('returns unread rows newest-first and history rows with offset + limit metadata', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'notif-2',
            owner_id: OWNER_ID,
            project_id: PROJECT_ID,
            task_id: 'task-2',
            task_key: 'PROJ-328',
            task_title: 'Second notification',
            status_from: 'todo',
            status_to: 'done',
            read_at: null,
            created_at: new Date('2026-04-08T04:30:00.000Z'),
          },
          {
            id: 'notif-1',
            owner_id: OWNER_ID,
            project_id: PROJECT_ID,
            task_id: 'task-1',
            task_key: 'PROJ-327',
            task_title: 'First notification',
            status_from: 'todo',
            status_to: 'ready',
            read_at: null,
            created_at: new Date('2026-04-08T04:20:00.000Z'),
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: 5 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'notif-5',
            owner_id: OWNER_ID,
            project_id: PROJECT_ID,
            task_id: 'task-5',
            task_key: 'PROJ-331',
            task_title: 'History notification',
            status_from: 'ready',
            status_to: 'done',
            read_at: new Date('2026-04-08T04:40:00.000Z'),
            created_at: new Date('2026-04-08T04:35:00.000Z'),
          },
        ],
      });
    const client = { execute };

    const unread = await listTaskNotifications(
      {
        ownerId: OWNER_ID,
      },
      client as never,
    );
    const history = await listTaskNotifications(
      {
        ownerId: OWNER_ID,
        history: true,
        offset: 2,
        limit: 1,
      },
      client as never,
    );

    expect(unread.notifications.map((notification) => notification.id)).toEqual([
      'notif-2',
      'notif-1',
    ]);
    expect(unread.total).toBe(2);
    expect(unread.offset).toBe(0);
    expect(unread.limit).toBe(20);
    expect(unread.hasMore).toBe(false);

    expect(history.notifications.map((notification) => notification.id)).toEqual(['notif-5']);
    expect(history.total).toBe(5);
    expect(history.offset).toBe(2);
    expect(history.limit).toBe(1);
    expect(history.hasMore).toBe(true);

    const unreadCountQueryText = queryText(execute.mock.calls[0]?.[0]);
    const unreadPageQueryText = queryText(execute.mock.calls[1]?.[0]);
    const historyCountQueryText = queryText(execute.mock.calls[2]?.[0]);
    const historyPageQueryText = queryText(execute.mock.calls[3]?.[0]);

    expect(unreadCountQueryText).toContain('read_at is null');
    expect(unreadPageQueryText).toContain('order by created_at desc, id desc');
    expect(historyCountQueryText).toContain('read_at is not null');
    expect(historyPageQueryText).toContain('limit');
    expect(flattenQueryChunks(execute.mock.calls[3]?.[0])).toContain(1);
    expect(flattenQueryChunks(execute.mock.calls[3]?.[0])).toContain(2);
  });

  it('marks only the requested notification ids as read for the owner', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [{ id: 'notif-1' }, { id: 'notif-3' }],
    });

    const result = await markTaskNotificationsRead(
      {
        ownerId: OWNER_ID,
        notificationIds: ['notif-1', 'notif-3'],
      },
      { execute } as never,
    );

    expect(result).toEqual(['notif-1', 'notif-3']);
    expect(flattenQueryChunks(execute.mock.calls[0]?.[0])).toEqual(
      expect.arrayContaining([OWNER_ID, 'notif-1', 'notif-3']),
    );
    expect(queryText(execute.mock.calls[0]?.[0])).toContain('update task_notifications');
  });

  it('marks all unread notifications for an owner', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [{ id: 'notif-1' }, { id: 'notif-2' }],
    });

    const updatedIds = await markAllTaskNotificationsRead({ ownerId: OWNER_ID }, {
      execute,
    } as never);

    expect(updatedIds).toEqual(['notif-1', 'notif-2']);
    expect(queryText(execute.mock.calls[0]?.[0])).toContain('update task_notifications');
    expect(queryText(execute.mock.calls[0]?.[0])).toContain('where owner_id =');
    expect(queryText(execute.mock.calls[0]?.[0])).toContain('read_at is null');
  });

  it('detects missing task_notifications relation errors', () => {
    expect(
      isMissingTaskNotificationsRelationError(
        new Error('relation "task_notifications" does not exist'),
      ),
    ).toBe(true);

    expect(isMissingTaskNotificationsRelationError(new Error('different failure'))).toBe(false);
  });

  it('reports notification storage as unavailable when to_regclass returns null', async () => {
    mocked.executeFn.mockResolvedValueOnce({
      rows: [{ relation_name: null }],
    });

    await expect(taskNotificationsStorageAvailable(mocked.db as never)).resolves.toBe(false);
  });

  it('safeCreateTaskCompletionNotification skips inserts when storage is unavailable', async () => {
    mocked.executeFn.mockResolvedValueOnce({
      rows: [{ relation_name: null }],
    });

    const notification = await safeCreateTaskCompletionNotification({
      tx: mocked.db as never,
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      taskKey: 'PROJ-327',
      taskTitle: 'Ship PREQ completion fix',
      fromStatus: 'todo',
      toStatus: 'ready',
      previousRunState: 'running',
      lifecycleAction: 'complete',
    });

    expect(notification).toBeNull();
    expect(mocked.insertFn).not.toHaveBeenCalled();
  });

  it('safeCreateTaskCompletionNotification checks storage using the provided transaction', async () => {
    const txExecute = vi.fn().mockResolvedValue({
      rows: [{ relation_name: null }],
    });
    const txInsert = vi.fn();

    const notification = await safeCreateTaskCompletionNotification({
      tx: {
        execute: txExecute,
        insert: txInsert,
      } as never,
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      taskKey: 'PROJ-327',
      taskTitle: 'Ship PREQ completion fix',
      fromStatus: 'todo',
      toStatus: 'ready',
      previousRunState: 'running',
      lifecycleAction: 'complete',
    });

    expect(notification).toBeNull();
    expect(txExecute).toHaveBeenCalledTimes(1);
    expect(mocked.executeFn).not.toHaveBeenCalled();
    expect(txInsert).not.toHaveBeenCalled();
  });

  it('safeCreateTaskCompletionNotification swallows missing relation errors', async () => {
    mocked.returningFn.mockRejectedValueOnce(
      new Error('relation "task_notifications" does not exist'),
    );

    const notification = await safeCreateTaskCompletionNotification({
      tx: mocked.db as never,
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      taskKey: 'PROJ-327',
      taskTitle: 'Ship PREQ completion fix',
      fromStatus: 'todo',
      toStatus: 'ready',
      previousRunState: 'running',
      lifecycleAction: 'complete',
    });

    expect(notification).toBeNull();
  });
});
