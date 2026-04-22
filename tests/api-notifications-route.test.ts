import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => ({
  requireOwnerUser: vi.fn(),
  assertSameOrigin: vi.fn(),
  listTaskNotifications: vi.fn(),
  markTaskNotificationsRead: vi.fn(),
}));

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/request-security', () => ({
  assertSameOrigin: mocked.assertSameOrigin,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback({}),
}));

vi.mock('@/lib/task-notifications', () => ({
  listTaskNotifications: mocked.listTaskNotifications,
  markTaskNotificationsRead: mocked.markTaskNotificationsRead,
}));

import { GET, PATCH } from '@/app/api/notifications/route';

function getRequest(search = '') {
  return new Request(`${TEST_BASE_URL}/api/notifications${search}`, {
    method: 'GET',
  });
}

function patchRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/notifications`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

describe('app/api/notifications/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.listTaskNotifications.mockResolvedValue({
      notifications: [
        {
          id: 'notif-1',
          ownerId: 'owner-1',
          projectId: 'project-1',
          taskId: 'task-1',
          taskKey: 'PROJ-327',
          taskTitle: 'Browser Notification 추가',
          statusFrom: 'todo',
          statusTo: 'ready',
          readAt: null,
          createdAt: new Date('2026-04-08T04:50:00.000Z'),
        },
      ],
      total: 1,
      offset: 0,
      limit: 20,
      hasMore: false,
    });
    mocked.markTaskNotificationsRead.mockResolvedValue(['notif-1']);
  });

  it('GET returns unread notifications by default', async () => {
    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocked.listTaskNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
      }),
      expect.anything(),
    );
    expect(body).toEqual({
      notifications: [
        expect.objectContaining({
          id: 'notif-1',
          taskKey: 'PROJ-327',
          statusTo: 'ready',
          readAt: null,
          createdAt: '2026-04-08T04:50:00.000Z',
        }),
      ],
      total: 1,
      offset: 0,
      limit: 20,
      hasMore: false,
    });
  });

  it('GET history returns read notifications with offset and limit metadata', async () => {
    mocked.listTaskNotifications.mockResolvedValueOnce({
      notifications: [
        {
          id: 'notif-9',
          ownerId: 'owner-1',
          projectId: 'project-1',
          taskId: 'task-9',
          taskKey: 'PROJ-335',
          taskTitle: 'History item',
          statusFrom: 'ready',
          statusTo: 'done',
          readAt: new Date('2026-04-08T05:00:00.000Z'),
          createdAt: new Date('2026-04-08T04:40:00.000Z'),
        },
      ],
      total: 7,
      offset: 3,
      limit: 1,
      hasMore: true,
    });

    const response = await GET(getRequest('?history=1&offset=3&limit=1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocked.listTaskNotifications).toHaveBeenCalledWith(
      {
        ownerId: 'owner-1',
        history: true,
        offset: 3,
        limit: 1,
      },
      expect.anything(),
    );
    expect(body).toEqual({
      notifications: [
        expect.objectContaining({
          id: 'notif-9',
          readAt: '2026-04-08T05:00:00.000Z',
          createdAt: '2026-04-08T04:40:00.000Z',
        }),
      ],
      total: 7,
      offset: 3,
      limit: 1,
      hasMore: true,
    });
  });

  it('PATCH marks the supplied notification ids as read for the current owner', async () => {
    const response = await PATCH(
      patchRequest({
        notificationIds: ['notif-1'],
      }),
    );

    expect(response.status).toBe(200);
    expect(mocked.markTaskNotificationsRead).toHaveBeenCalledWith(
      {
        ownerId: 'owner-1',
        notificationIds: ['notif-1'],
      },
      expect.anything(),
    );
    expect(await response.json()).toEqual({
      ok: true,
      updatedIds: ['notif-1'],
    });
  });

  it('rejects unauthorized access', async () => {
    mocked.requireOwnerUser.mockRejectedValueOnce(
      new Response(null, {
        status: 401,
      }),
    );

    const response = await GET(getRequest());

    expect(response.status).toBe(401);
  });

  it('GET falls back to an empty unread list when the notifications table is missing', async () => {
    mocked.listTaskNotifications.mockRejectedValueOnce(
      Object.assign(new Error('Failed query'), {
        cause: Object.assign(new Error('relation "task_notifications" does not exist'), {
          code: '42P01',
        }),
      }),
    );

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      notifications: [],
      total: 0,
      offset: 0,
      limit: 20,
      hasMore: false,
    });
  });

  it('PATCH becomes a no-op when the notifications table is missing', async () => {
    mocked.markTaskNotificationsRead.mockRejectedValueOnce(
      Object.assign(new Error('Failed query'), {
        cause: Object.assign(new Error('relation "task_notifications" does not exist'), {
          code: '42P01',
        }),
      }),
    );

    const response = await PATCH(
      patchRequest({
        notificationIds: ['notif-1'],
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      updatedIds: [],
    });
  });
});
