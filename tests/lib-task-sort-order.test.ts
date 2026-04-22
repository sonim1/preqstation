import { beforeEach, describe, expect, it, vi } from 'vitest';

const drizzleMocked = vi.hoisted(() => ({
  and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
  asc: vi.fn((column: unknown) => ({ type: 'asc', column })),
  desc: vi.fn((column: unknown) => ({ type: 'desc', column })),
  eq: vi.fn((column: unknown, value: unknown) => ({ type: 'eq', column, value })),
  ne: vi.fn((column: unknown, value: unknown) => ({ type: 'ne', column, value })),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: drizzleMocked.and,
    asc: drizzleMocked.asc,
    desc: drizzleMocked.desc,
    eq: drizzleMocked.eq,
    ne: drizzleMocked.ne,
  };
});

import { resolveAppendSortOrder, TASK_LANE_ORDER } from '@/lib/task-sort-order';

type LaneRow = {
  id: string;
  sortOrder: string;
  dueAt?: Date | null;
  createdAt?: Date;
};

function compareLaneRows(left: LaneRow, right: LaneRow) {
  const sortOrderDiff = left.sortOrder.localeCompare(right.sortOrder);
  if (sortOrderDiff !== 0) return sortOrderDiff;

  const leftDueAt = left.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightDueAt = right.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (leftDueAt !== rightDueAt) return leftDueAt - rightDueAt;

  const leftCreatedAt = left.createdAt?.getTime() ?? 0;
  const rightCreatedAt = right.createdAt?.getTime() ?? 0;
  if (leftCreatedAt !== rightCreatedAt) return rightCreatedAt - leftCreatedAt;

  return left.id.localeCompare(right.id);
}

function createClient(rows: LaneRow[]) {
  const updatedTaskIds: string[] = [];
  const findMany = vi
    .fn()
    .mockImplementation((args?: { orderBy?: unknown }) =>
      Promise.resolve(
        args?.orderBy === TASK_LANE_ORDER ? rows.slice().sort(compareLaneRows) : rows.slice(),
      ),
    );
  const where = vi.fn().mockImplementation(async (condition?: { value?: string }) => {
    if (typeof condition?.value === 'string') {
      updatedTaskIds.push(condition.value);
    }
    return undefined;
  });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });

  return {
    client: {
      query: {
        tasks: {
          findMany,
        },
      },
      update,
    },
    spies: {
      findMany,
      update,
      set,
      where,
      updatedTaskIds,
    },
  };
}

describe('lib/task-sort-order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a trailing key without rebalancing when the lane is already strictly ordered', async () => {
    const { client, spies } = createClient([
      {
        id: 'task-1',
        sortOrder: 'a0',
        dueAt: new Date('2026-04-01T00:00:00.000Z'),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        id: 'task-2',
        sortOrder: 'a1',
        dueAt: new Date('2026-04-02T00:00:00.000Z'),
        createdAt: new Date('2026-04-02T00:00:00.000Z'),
      },
    ]);

    const nextKey = await resolveAppendSortOrder({
      client: client as never,
      ownerId: 'owner-1',
      status: 'inbox',
    });

    expect(nextKey > 'a1').toBe(true);
    expect(spies.update).not.toHaveBeenCalled();
  });

  it('rebalances duplicate keys in deterministic board order before appending', async () => {
    const { client, spies } = createClient([
      {
        id: 'task-2',
        sortOrder: 'a0',
        dueAt: new Date('2026-04-02T00:00:00.000Z'),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        id: 'task-1',
        sortOrder: 'a0',
        dueAt: new Date('2026-04-01T00:00:00.000Z'),
        createdAt: new Date('2026-04-03T00:00:00.000Z'),
      },
    ]);

    await resolveAppendSortOrder({
      client: client as never,
      ownerId: 'owner-1',
      status: 'todo',
    });

    expect(spies.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: TASK_LANE_ORDER }),
    );
    expect(spies.updatedTaskIds).toEqual(['task-1', 'task-2']);
  });

  it('rebalances before appending when the lane contains a legacy numeric key', async () => {
    const { client, spies } = createClient([
      {
        id: 'task-1',
        sortOrder: '0000000003',
        dueAt: new Date('2026-04-01T00:00:00.000Z'),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        id: 'task-2',
        sortOrder: 'a0',
        dueAt: new Date('2026-04-02T00:00:00.000Z'),
        createdAt: new Date('2026-04-02T00:00:00.000Z'),
      },
    ]);

    const nextKey = await resolveAppendSortOrder({
      client: client as never,
      ownerId: 'owner-1',
      status: 'todo',
    });

    expect(spies.update).toHaveBeenCalledTimes(2);
    const normalizedKeys = spies.set.mock.calls.map(([value]) => value.sortOrder);
    expect(normalizedKeys[0] < normalizedKeys[1]).toBe(true);
    expect(nextKey > normalizedKeys[1]).toBe(true);
  });

  it('rebalances before appending when the lane has duplicate sort keys', async () => {
    const { client, spies } = createClient([
      {
        id: 'task-1',
        sortOrder: 'a0',
        dueAt: new Date('2026-04-01T00:00:00.000Z'),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        id: 'task-2',
        sortOrder: 'a0',
        dueAt: new Date('2026-04-02T00:00:00.000Z'),
        createdAt: new Date('2026-04-02T00:00:00.000Z'),
      },
    ]);

    const nextKey = await resolveAppendSortOrder({
      client: client as never,
      ownerId: 'owner-1',
      status: 'ready',
    });

    expect(spies.update).toHaveBeenCalledTimes(2);
    const normalizedKeys = spies.set.mock.calls.map(([value]) => value.sortOrder);
    expect(normalizedKeys[0] < normalizedKeys[1]).toBe(true);
    expect(nextKey > normalizedKeys[1]).toBe(true);
  });

  it('rebalances before appending when the tail key already exceeds the safe length budget', async () => {
    const { client, spies } = createClient([
      {
        id: 'task-1',
        sortOrder: 'a0',
        dueAt: new Date('2026-04-01T00:00:00.000Z'),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        id: 'task-2',
        sortOrder: `a${'0'.repeat(50)}`,
        dueAt: new Date('2026-04-02T00:00:00.000Z'),
        createdAt: new Date('2026-04-02T00:00:00.000Z'),
      },
    ]);

    const nextKey = await resolveAppendSortOrder({
      client: client as never,
      ownerId: 'owner-1',
      status: 'done',
    });

    expect(spies.update).toHaveBeenCalledTimes(2);
    const normalizedKeys = spies.set.mock.calls.map(([value]) => value.sortOrder);
    expect(normalizedKeys[0] < normalizedKeys[1]).toBe(true);
    expect(nextKey > normalizedKeys[1]).toBe(true);
  });
});
