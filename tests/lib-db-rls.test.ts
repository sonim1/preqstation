import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dialect = new PgDialect();

function sqlSnapshot(value: Parameters<PgDialect['sqlToQuery']>[0]) {
  const { sql, params } = dialect.sqlToQuery(value);
  return { sql, params };
}

const mocked = vi.hoisted(() => {
  const tx = {
    execute: vi.fn(),
  };

  const db = {
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };

  return { db, tx };
});

vi.mock('@/lib/db', () => ({
  adminDb: mocked.db,
  db: mocked.db,
}));

import { withAdminDb, withOwnerDb } from '@/lib/db/rls';

describe('lib/db/rls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.tx.execute.mockResolvedValue([{ set_config: 'owner-1', set_config_1: 'UTC' }]);
  });

  it('wraps owner-scoped work in a transaction and sets owner db session context locally', async () => {
    const result = await withOwnerDb('owner-1', async (client) => {
      expect(client).toBe(mocked.tx);
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(mocked.db.transaction).toHaveBeenCalledOnce();
    expect(mocked.tx.execute).toHaveBeenCalledOnce();

    const snapshot = sqlSnapshot(mocked.tx.execute.mock.calls[0][0]);
    expect(snapshot.sql).toContain("set_config('app.user_id', $1, true)");
    expect(snapshot.sql).toContain("set_config('app.default_timezone', $2, true)");
    expect(snapshot.params).toEqual(['owner-1', expect.any(String)]);
  });

  it('passes the ambient admin client through unchanged for unscoped flows', async () => {
    const result = await withAdminDb(async (client) => {
      expect(client).toBe(mocked.db);
      return 'admin-ok';
    });

    expect(result).toBe('admin-ok');
    expect(mocked.db.transaction).not.toHaveBeenCalled();
  });
});
