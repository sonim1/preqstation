import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const groupBy = vi.fn().mockResolvedValue([{ labelId: 'label-1', usageCount: 2 }]);
  const where = vi.fn().mockReturnValue({ groupBy });
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ innerJoin });
  const select = vi.fn().mockReturnValue({ from });

  return {
    and: vi.fn((...conditions: unknown[]) => conditions),
    asc: vi.fn(),
    eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
    groupBy,
    inArray: vi.fn(),
    innerJoin,
    from,
    isNull: vi.fn((column: unknown) => ({ column })),
    select,
    sql: vi.fn(() => 'count(*)::int'),
    where,
  };
});

vi.mock('drizzle-orm', () => ({
  and: mocked.and,
  asc: mocked.asc,
  eq: mocked.eq,
  inArray: mocked.inArray,
  isNull: mocked.isNull,
  sql: mocked.sql,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: mocked.select,
  },
}));

import { listProjectTaskLabelUsageCounts } from '@/lib/task-labels';

describe('lib/task-labels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.select.mockReturnValue({ from: mocked.from });
    mocked.from.mockReturnValue({ innerJoin: mocked.innerJoin });
    mocked.innerJoin.mockReturnValue({ where: mocked.where });
    mocked.where.mockReturnValue({ groupBy: mocked.groupBy });
    mocked.groupBy.mockResolvedValue([{ labelId: 'label-1', usageCount: 2 }]);
  });

  it('includes archived task assignments in project label usage counts', async () => {
    const client = { select: mocked.select };

    const result = await listProjectTaskLabelUsageCounts('owner-1', 'project-1', client as never);

    expect(result).toEqual([{ labelId: 'label-1', usageCount: 2 }]);
    expect(mocked.isNull).not.toHaveBeenCalled();
  });
});
