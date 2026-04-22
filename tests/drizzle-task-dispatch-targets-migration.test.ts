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

describe('drizzle task dispatch targets migration', () => {
  it('keeps the dispatch target migration registered in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const dispatchMigration = journal.entries.find(
      (entry) => entry.tag === '0008_task_dispatch_targets',
    );

    expect(dispatchMigration).toBeTruthy();
    expect(dispatchMigration?.idx).toBe(8);
  });

  it('adds the task dispatch target column and supporting index', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0008_task_dispatch_targets.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "dispatch_target" text');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "tasks_owner_id_dispatch_target_idx"');
    expect(sql).toContain('USING btree ("owner_id","dispatch_target")');
  });
});
