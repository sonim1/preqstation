import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const drizzleMocked = vi.hoisted(() => ({
  and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
  asc: vi.fn((column: unknown) => ({ type: 'asc', column })),
  eq: vi.fn((column: unknown, value: unknown) => ({ type: 'eq', column, value })),
  inArray: vi.fn((column: unknown, values: unknown[]) => ({ type: 'inArray', column, values })),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: drizzleMocked.and,
    asc: drizzleMocked.asc,
    eq: drizzleMocked.eq,
    inArray: drizzleMocked.inArray,
  };
});

const mocked = vi.hoisted(() => {
  const txWhereFn = vi.fn().mockImplementation(async (_condition?: unknown) => undefined);
  const txSetFn = vi.fn().mockReturnValue({ where: txWhereFn });
  const txUpdate = vi.fn().mockReturnValue({ set: txSetFn });
  const txOrderBy = vi.fn();
  const txWhere = vi.fn().mockReturnValue({ orderBy: txOrderBy });
  const txFrom = vi.fn().mockReturnValue({ where: txWhere });
  const txSelect = vi.fn().mockReturnValue({ from: txFrom });

  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    db: {
      query: {
        tasks: { findMany: vi.fn() },
      },
      transaction: vi.fn(),
    },
    txSelect,
    txFrom,
    txWhere,
    txOrderBy,
    txUpdate,
    txSetFn,
    txWhereFn,
  };
});

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/request-security', () => ({
  assertSameOrigin: mocked.assertSameOrigin,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    mocked.db.transaction(async (tx: Record<string, unknown>) =>
      callback({ ...mocked.db, ...tx, query: mocked.db.query }),
    ),
}));

import { POST } from '@/app/api/todos/rebalance/route';
import { TASK_LANE_ORDER } from '@/lib/task-sort-order';

function request(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/todos/rebalance`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

function updatedTaskIds() {
  return mocked.txWhereFn.mock.calls
    .map(([condition]) => condition)
    .filter((condition): condition is { value: string } =>
      Boolean(condition && typeof condition.value === 'string'),
    )
    .map((condition) => condition.value);
}

describe('app/api/todos/rebalance/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.db.transaction.mockImplementation(async (fn: Function) =>
      fn({
        select: mocked.txSelect,
        update: mocked.txUpdate,
      }),
    );
    mocked.txOrderBy.mockResolvedValue([
      {
        id: 'task-2',
        status: 'todo',
        sortOrder: 'a0',
        dueAt: new Date('2026-04-02T00:00:00.000Z'),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        id: 'task-1',
        status: 'todo',
        sortOrder: 'a0',
        dueAt: new Date('2026-04-01T00:00:00.000Z'),
        createdAt: new Date('2026-04-03T00:00:00.000Z'),
      },
      {
        id: 'task-3',
        status: 'todo',
        sortOrder: 'a0',
        dueAt: new Date('2026-04-03T00:00:00.000Z'),
        createdAt: new Date('2026-04-02T00:00:00.000Z'),
      },
    ]);
    mocked.db.query.tasks.findMany.mockImplementation(async (args?: { orderBy?: unknown }) => {
      if (args?.orderBy === TASK_LANE_ORDER) {
        return [
          {
            id: 'task-1',
            sortOrder: 'a0',
            dueAt: new Date('2026-04-01T00:00:00.000Z'),
            createdAt: new Date('2026-04-03T00:00:00.000Z'),
          },
          {
            id: 'task-2',
            sortOrder: 'a0',
            dueAt: new Date('2026-04-02T00:00:00.000Z'),
            createdAt: new Date('2026-04-01T00:00:00.000Z'),
          },
          {
            id: 'task-3',
            sortOrder: 'a0',
            dueAt: new Date('2026-04-03T00:00:00.000Z'),
            createdAt: new Date('2026-04-02T00:00:00.000Z'),
          },
        ];
      }
      return [];
    });
  });

  it('POST /api/todos/rebalance preserves dueAt/createdAt/id order inside duplicate lanes', async () => {
    const response = await POST(request({ status: 'todo' }));

    expect(response.status).toBe(200);
    expect(mocked.txSetFn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sortOrder: expect.any(String) }),
    );
    expect(updatedTaskIds()).toEqual(['task-1', 'task-2', 'task-3']);
  });
});
