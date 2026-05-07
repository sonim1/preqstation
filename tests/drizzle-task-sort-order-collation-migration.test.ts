import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

type Journal = {
  entries: Array<{
    idx: number;
    tag: string;
    when: number;
  }>;
};

describe('drizzle task sort order collation migration', () => {
  it('registers the sort order collation migration in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const migration = journal.entries.find(
      (entry) => entry.tag === '0023_task_sort_order_collation',
    );

    expect(migration).toBeTruthy();
    expect(migration?.idx).toBe(23);
  });

  it('moves binary collation onto the sort_order column and rebuilds the lane index', () => {
    const migrationPath = path.join(
      process.cwd(),
      'drizzle',
      '0023_task_sort_order_collation.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('DROP INDEX IF EXISTS "tasks_owner_id_status_sort_order_idx"');
    expect(sql).toContain(
      'ALTER TABLE "tasks" ALTER COLUMN "sort_order" TYPE varchar(64) COLLATE "C" USING "sort_order"',
    );
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "tasks_owner_id_status_sort_order_idx" ON "tasks" USING btree ("owner_id","status","sort_order")',
    );
  });
});
