import { describe, expect, it, vi } from 'vitest';

describe('db module import', () => {
  it('does not require DATABASE_URL until the database is used', async () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.resetModules();

    const dbModule = await import('@/lib/db');

    expect(dbModule.db).toBeDefined();
    expect(() => dbModule.db.query).toThrow('DATABASE_URL is required');
  });
});
