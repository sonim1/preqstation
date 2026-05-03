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

describe('drizzle task artifacts migration', () => {
  it('registers the structured artifacts migration in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const migration = journal.entries.find((entry) => entry.tag === '0022_task_artifacts');

    expect(migration).toBeTruthy();
    expect(migration?.idx).toBe(22);
  });

  it('adds jsonb artifact storage to tasks and qa_runs', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0022_task_artifacts.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('ALTER TABLE "tasks" ADD COLUMN "artifacts" jsonb DEFAULT');
    expect(sql).toContain('ALTER TABLE "qa_runs" ADD COLUMN "artifacts" jsonb DEFAULT');
  });
});
