import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

type Journal = {
  entries: Array<{
    idx: number;
    tag: string;
    when: number;
  }>;
};

describe('drizzle legacy prisma cleanup migration', () => {
  it('registers the legacy prisma cleanup migration in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const cleanupMigration = journal.entries.find(
      (entry) => entry.tag === '0016_legacy_prisma_cleanup',
    );

    expect(cleanupMigration).toBeTruthy();
    expect(cleanupMigration?.idx).toBe(16);
  });

  it('drops the legacy dogfood_runs and _prisma_migrations tables', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0016_legacy_prisma_cleanup.sql');
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('DROP TABLE IF EXISTS "public"."dogfood_runs";');
    expect(sql).toContain('DROP TABLE IF EXISTS "public"."_prisma_migrations";');
  });
});
