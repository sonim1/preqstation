import { beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '33333333-3333-4333-8333-333333333333';
const NOTIFICATION_ID_1 = '44444444-4444-4444-8444-444444444444';
const NOTIFICATION_ID_2 = '55555555-5555-4555-8555-555555555555';
const NOTIFICATION_ID_3 = '66666666-6666-4666-8666-666666666666';

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
  enrichTasksWithUnreadStatus,
  isMissingTaskNotificationsRelationError,
  listTaskNotifications,
  listUnreadTaskNotificationTaskKeys,
  markAllTaskNotificationsRead,
  markTaskNotificationsRead,
  safeCreateTaskCompletionNotification,
  shouldCreateTaskCompletionNotification,
  taskNotificationsStorageAvailable,
} from '@/lib/task-notifications';

function flattenQueryChunks(query: unknown): unknown[] {
  if (Array.isArray(query)) {
    return query.flatMap((chunk) => flattenQueryChunks(chunk));
  }

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

function makeUpdateClient(rows: Array<{ id: string }>) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  const execute = vi.fn();

  return {
    client: {
      update,
      execute,
    },
    update,
    set,
    where,
    returning,
    execute,
  };
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

  it('returns unread task keys scoped by owner, project, and requested task keys', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [{ task_key: 'PROJ-327' }, { taskKey: 'PROJ-328' }],
    });

    const result = await listUnreadTaskNotificationTaskKeys(
      {
        ownerId: OWNER_ID,
        projectId: PROJECT_ID,
        taskKeys: ['PROJ-327', 'PROJ-328', 'PROJ-327'],
      },
      { execute } as never,
    );

    expect(result).toEqual(new Set(['PROJ-327', 'PROJ-328']));
    expect(execute).toHaveBeenCalledTimes(1);
    expect(queryText(execute.mock.calls[0]?.[0])).toContain('select distinct task_key');
    expect(queryText(execute.mock.calls[0]?.[0])).toContain('where owner_id =');
    expect(queryText(execute.mock.calls[0]?.[0])).toContain('read_at is null');
    expect(queryText(execute.mock.calls[0]?.[0])).toContain('project_id =');
    expect(queryText(execute.mock.calls[0]?.[0])).toContain('task_key in');
    expect(flattenQueryChunks(execute.mock.calls[0]?.[0])).toEqual(
      expect.arrayContaining([OWNER_ID, PROJECT_ID, 'PROJ-327', 'PROJ-328']),
    );
  });

  it('skips the unread task-key query when the requested task key list is empty', async () => {
    const execute = vi.fn();

    const result = await listUnreadTaskNotificationTaskKeys(
      {
        ownerId: OWNER_ID,
        taskKeys: [],
      },
      { execute } as never,
    );

    expect(result).toEqual(new Set());
    expect(execute).not.toHaveBeenCalled();
  });

  it('skips the unread task-key query when task keys are omitted', async () => {
    const execute = vi.fn();
    const params = {
      ownerId: OWNER_ID,
    };

    const result = await listUnreadTaskNotificationTaskKeys(
      // @ts-expect-error taskKeys is required for typed callers; this covers runtime defense.
      params,
      { execute } as never,
    );

    expect(result).toEqual(new Set());
    expect(execute).not.toHaveBeenCalled();
  });

  it('returns an empty unread task-key set when the notifications relation is missing', async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new Error('relation "task_notifications" does not exist'));

    const result = await listUnreadTaskNotificationTaskKeys(
      {
        ownerId: OWNER_ID,
        taskKeys: ['PROJ-327'],
      },
      { execute } as never,
    );

    expect(result).toEqual(new Set());
  });

  it('enriches task rows with unread notification status through the shared helper', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [{ task_key: 'PROJ-328' }],
    });

    const result = await enrichTasksWithUnreadStatus(
      {
        ownerId: OWNER_ID,
        projectId: PROJECT_ID,
      },
      [
        { taskKey: 'PROJ-327', title: 'Read task' },
        { taskKey: 'PROJ-328', title: 'Unread task' },
      ],
      { execute } as never,
    );

    expect(result).toEqual([
      { taskKey: 'PROJ-327', title: 'Read task', hasUnreadNotification: false },
      { taskKey: 'PROJ-328', title: 'Unread task', hasUnreadNotification: true },
    ]);
    expect(queryText(execute.mock.calls[0]?.[0])).toContain('task_key in');
    expect(flattenQueryChunks(execute.mock.calls[0]?.[0])).toEqual(
      expect.arrayContaining([OWNER_ID, PROJECT_ID, 'PROJ-327', 'PROJ-328']),
    );
  });

  it('marks only the requested notification ids as read for the owner', async () => {
    const now = new Date('2026-04-08T05:10:00.000Z');
    const updateClient = makeUpdateClient([{ id: NOTIFICATION_ID_1 }, { id: NOTIFICATION_ID_3 }]);

    const result = await markTaskNotificationsRead(
      {
        ownerId: OWNER_ID,
        notificationIds: [
          ` ${NOTIFICATION_ID_1} `,
          NOTIFICATION_ID_3,
          NOTIFICATION_ID_1,
          '',
          '   ',
        ],
        now,
      },
      updateClient.client as never,
    );

    expect(result).toEqual([NOTIFICATION_ID_1, NOTIFICATION_ID_3]);
    expect(updateClient.update).toHaveBeenCalledTimes(1);
    expect(updateClient.set).toHaveBeenCalledWith({ readAt: now });
    expect(updateClient.where).toHaveBeenCalledTimes(1);
    expect(updateClient.returning).toHaveBeenCalledTimes(1);
    expect(updateClient.execute).not.toHaveBeenCalled();

    const whereChunks = flattenQueryChunks(updateClient.where.mock.calls[0]?.[0]);
    expect(whereChunks).toContain(OWNER_ID);
    expect(whereChunks).toContain(NOTIFICATION_ID_3);
    expect(whereChunks.filter((chunk) => chunk === NOTIFICATION_ID_1)).toHaveLength(1);
    expect(whereChunks).not.toContain(` ${NOTIFICATION_ID_1} `);
  });

  it('marks all unread notifications for an owner', async () => {
    const now = new Date('2026-04-08T05:15:00.000Z');
    const updateClient = makeUpdateClient([{ id: NOTIFICATION_ID_1 }, { id: NOTIFICATION_ID_2 }]);

    const updatedIds = await markAllTaskNotificationsRead(
      { ownerId: OWNER_ID, now },
      updateClient.client as never,
    );

    expect(updatedIds).toEqual([NOTIFICATION_ID_1, NOTIFICATION_ID_2]);
    expect(updateClient.update).toHaveBeenCalledTimes(1);
    expect(updateClient.set).toHaveBeenCalledWith({ readAt: now });
    expect(updateClient.where).toHaveBeenCalledTimes(1);
    expect(updateClient.returning).toHaveBeenCalledTimes(1);
    expect(updateClient.execute).not.toHaveBeenCalled();

    expect(flattenQueryChunks(updateClient.where.mock.calls[0]?.[0])).toContain(OWNER_ID);
    expect(queryText(updateClient.where.mock.calls[0]?.[0])).toContain('is null');
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
