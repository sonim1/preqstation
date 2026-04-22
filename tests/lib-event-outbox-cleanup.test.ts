import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dialect = new PgDialect();

function sqlSnapshot(value: Parameters<PgDialect['sqlToQuery']>[0]) {
  const { sql, params } = dialect.sqlToQuery(value);
  return { sql, params };
}

const mocked = vi.hoisted(() => {
  const findFirst = vi.fn();
  const onConflictDoUpdate = vi.fn();
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });
  const execute = vi.fn();

  return {
    findFirst,
    onConflictDoUpdate,
    values,
    insert,
    execute,
    db: {
      query: {
        userSettings: {
          findFirst,
        },
      },
      insert,
      execute,
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

describe('lib/event-outbox-cleanup', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocked.findFirst.mockResolvedValue(null);
    mocked.execute.mockResolvedValue({ count: 0 });
  });

  it('skips cleanup when the last-cleaned timestamp is less than 24 hours old', async () => {
    mocked.findFirst.mockResolvedValueOnce({ value: '2026-03-10T18:00:00.000Z' });

    const { cleanupEventOutboxIfDue } = await import('@/lib/event-outbox-cleanup');
    const result = await cleanupEventOutboxIfDue({
      ownerId: 'owner-1',
      now: new Date('2026-03-11T00:00:00.000Z'),
    });

    expect(result).toEqual(expect.objectContaining({ didRun: false, deleted: 0 }));
    expect(mocked.execute).not.toHaveBeenCalled();
    expect(mocked.insert).not.toHaveBeenCalled();
  });

  it('runs cleanup when the stored timestamp is missing', async () => {
    const { cleanupEventOutboxIfDue } = await import('@/lib/event-outbox-cleanup');
    const now = new Date('2026-03-11T00:00:00.000Z');

    const result = await cleanupEventOutboxIfDue({ ownerId: 'owner-1', now });

    expect(result).toEqual(expect.objectContaining({ didRun: true, deleted: 0 }));
    expect(mocked.execute).toHaveBeenCalledTimes(1);
    expect(mocked.values).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      key: 'events_outbox_last_cleaned_at',
      value: now.toISOString(),
    });
    expect(mocked.onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it('runs cleanup when the stored timestamp is invalid', async () => {
    mocked.findFirst.mockResolvedValueOnce({ value: 'not-a-date' });

    const { cleanupEventOutboxIfDue } = await import('@/lib/event-outbox-cleanup');
    const result = await cleanupEventOutboxIfDue({
      ownerId: 'owner-1',
      now: new Date('2026-03-11T00:00:00.000Z'),
    });

    expect(result).toEqual(expect.objectContaining({ didRun: true }));
    expect(mocked.execute).toHaveBeenCalledTimes(1);
  });

  it('runs cleanup when the stored timestamp is older than 24 hours', async () => {
    mocked.findFirst.mockResolvedValueOnce({ value: '2026-03-09T23:59:59.000Z' });

    const { cleanupEventOutboxIfDue } = await import('@/lib/event-outbox-cleanup');
    const result = await cleanupEventOutboxIfDue({
      ownerId: 'owner-1',
      now: new Date('2026-03-11T00:00:00.000Z'),
    });

    expect(result).toEqual(expect.objectContaining({ didRun: true }));
    expect(mocked.execute).toHaveBeenCalledTimes(1);
  });

  it('writes the new last-cleaned timestamp only after cleanup succeeds', async () => {
    mocked.execute.mockRejectedValueOnce(new Error('delete failed'));

    const { cleanupEventOutboxIfDue } = await import('@/lib/event-outbox-cleanup');

    await expect(
      cleanupEventOutboxIfDue({
        ownerId: 'owner-1',
        now: new Date('2026-03-11T00:00:00.000Z'),
      }),
    ).rejects.toThrow('delete failed');

    expect(mocked.insert).not.toHaveBeenCalled();
  });

  it('builds an owner-scoped delete query using the retention cutoff', async () => {
    const { buildEventOutboxCleanupQuery } = await import('@/lib/event-outbox-cleanup');
    const cutoff = new Date('2026-03-10T00:00:00.000Z');

    const snapshot = sqlSnapshot(buildEventOutboxCleanupQuery('owner-1', cutoff));

    expect(snapshot.sql).toContain('delete from events_outbox');
    expect(snapshot.sql).toContain('owner_id = $1');
    expect(snapshot.sql).toContain('created_at < $2');
    expect(snapshot.params[0]).toBe('owner-1');
    expect(snapshot.params[1]).toBe(cutoff.toISOString());
  });
});
