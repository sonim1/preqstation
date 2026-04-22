import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const limitFn = vi.fn().mockResolvedValue([]);
  const orderByFn = vi.fn().mockReturnValue({ limit: limitFn });
  const selectWhereFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
  const fromFn = vi.fn().mockReturnValue({ where: selectWhereFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  return {
    cleanupEventOutboxIfDue: vi.fn(),
    getOwnerUserOrNull: vi.fn(),
    db: {
      select: selectFn,
    },
    limitFn,
    orderByFn,
    selectWhereFn,
    fromFn,
    selectFn,
  };
});

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  asc: vi.fn((arg: unknown) => ({ type: 'asc', arg })),
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  gt: vi.fn((...args: unknown[]) => ({ type: 'gt', args })),
}));

vi.mock('@/lib/owner', () => ({
  getOwnerUserOrNull: mocked.getOwnerUserOrNull,
}));

vi.mock('@/lib/event-outbox-cleanup', () => ({
  cleanupEventOutboxIfDue: mocked.cleanupEventOutboxIfDue,
}));

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback(mocked.db),
}));

vi.mock('@/lib/db/schema', () => ({
  eventsOutbox: {
    id: 'id',
    projectId: 'projectId',
    eventType: 'eventType',
    entityType: 'entityType',
    entityId: 'entityId',
    payload: 'payload',
    createdAt: 'createdAt',
  },
}));

import { GET } from '@/app/api/events/route';

describe('app/api/events/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.cleanupEventOutboxIfDue.mockResolvedValue({ didRun: false, deleted: 0 });
    mocked.getOwnerUserOrNull.mockResolvedValue({ id: 'owner-1' });
    mocked.limitFn.mockResolvedValue([]);
    mocked.db.select.mockReturnValue({ from: mocked.fromFn });
    mocked.fromFn.mockReturnValue({ where: mocked.selectWhereFn });
    mocked.selectWhereFn.mockReturnValue({ orderBy: mocked.orderByFn });
    mocked.orderByFn.mockReturnValue({ limit: mocked.limitFn });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('GET returns owner-scoped events using after, limit, and project filters', async () => {
    mocked.limitFn.mockResolvedValueOnce([
      {
        id: 11n,
        eventType: 'TASK_UPDATED',
        entityType: 'task',
        entityId: 'PROJ-11',
        payload: { status: 'todo' },
        createdAt: new Date('2026-04-08T16:00:00.000Z'),
      },
      {
        id: 12n,
        eventType: 'PROJECT_UPDATED',
        entityType: 'project',
        entityId: 'PROJ',
        payload: { fields: ['name'] },
        createdAt: new Date('2026-04-08T16:01:00.000Z'),
      },
    ]);

    const response = await GET(
      new Request('https://example.com/api/events?after=10&limit=2&projectId=project-1'),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      events: [
        {
          id: '11',
          eventType: 'TASK_UPDATED',
          entityType: 'task',
          entityId: 'PROJ-11',
          payload: { status: 'todo' },
          createdAt: '2026-04-08T16:00:00.000Z',
        },
        {
          id: '12',
          eventType: 'PROJECT_UPDATED',
          entityType: 'project',
          entityId: 'PROJ',
          payload: { fields: ['name'] },
          createdAt: '2026-04-08T16:01:00.000Z',
        },
      ],
      nextCursor: '12',
    });
    expect(mocked.getOwnerUserOrNull).toHaveBeenCalledTimes(1);
    expect(mocked.cleanupEventOutboxIfDue).toHaveBeenCalledWith({ ownerId: 'owner-1' }, mocked.db);
    expect(mocked.db.select).toHaveBeenCalledTimes(1);
    expect(mocked.limitFn).toHaveBeenCalledWith(2);
  });

  it('GET returns 401 when no owner session exists', async () => {
    mocked.getOwnerUserOrNull.mockResolvedValueOnce(null);

    const response = await GET(new Request('https://example.com/api/events'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(mocked.getOwnerUserOrNull).toHaveBeenCalledTimes(1);
    expect(mocked.cleanupEventOutboxIfDue).not.toHaveBeenCalled();
    expect(mocked.db.select).not.toHaveBeenCalled();
  });
});
