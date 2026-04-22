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

describe('drizzle task search migration', () => {
  it('keeps the task search migration registered in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const searchMigration = journal.entries.find((entry) => entry.tag === '0006_task_search');

    expect(searchMigration).toBeTruthy();
    expect(searchMigration?.idx).toBe(6);
  });

  it('adds the search_vector column, gin index, and task search SQL functions', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0006_task_search.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('ALTER TABLE "tasks" ADD COLUMN "search_vector" tsvector');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "tasks_search_vector_idx"');
    expect(sql).toContain('USING gin ("search_vector")');
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION refresh_task_search_document(task_uuid uuid)',
    );
    expect(sql).toContain('CREATE OR REPLACE FUNCTION search_tasks_fts(');
    expect(sql).toContain("websearch_to_tsquery('simple', v_query)");
    expect(sql).toContain('CASE WHEN t.task_key = v_query THEN 10.0 ELSE 0.0 END');
    expect(sql).toContain('UPDATE "tasks" SET "search_vector" = NULL');
  });

  it('wires trigger refreshes for task field changes and label changes', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0006_task_search.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION tasks_refresh_search_vector_trigger()');
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION task_label_assignments_refresh_search_vector_trigger()',
    );
    expect(sql).toContain('CREATE OR REPLACE FUNCTION task_labels_refresh_search_vector_trigger()');
    expect(sql).toContain(
      'AFTER INSERT OR UPDATE OF "task_key", "title", "note", "branch" ON "tasks"',
    );
    expect(sql).toContain('AFTER INSERT OR UPDATE OR DELETE ON "task_label_assignments"');
    expect(sql).toContain('AFTER UPDATE OF "name" ON "task_labels"');
  });
});
