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

describe('drizzle tasks owner engine index migration', () => {
  it('keeps the owner and engine index migration registered in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const engineIndexMigration = journal.entries.find(
      (entry) => entry.tag === '0013_tasks_owner_engine_index',
    );

    expect(engineIndexMigration).toBeTruthy();
    expect(engineIndexMigration?.idx).toBe(13);
  });

  it('adds the owner scoped engine index for task list queries', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0013_tasks_owner_engine_index.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "tasks_owner_id_engine_idx"');
    expect(sql).toContain('USING btree ("owner_id","engine")');
  });
});
