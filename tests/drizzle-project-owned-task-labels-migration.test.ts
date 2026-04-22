import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

type Journal = {
  entries: Array<{
    tag: string;
    when: number;
  }>;
};

describe('drizzle project-owned task labels migration', () => {
  it('registers the project-owned labels migration in the drizzle journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;

    expect(journal.entries.some((entry) => entry.tag === '0018_project_owned_task_labels')).toBe(
      true,
    );
  });

  it('adds a hard-cut migration that backfills labels by project and blocks null task projects', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0018_project_owned_task_labels.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('ALTER TABLE "task_labels" ADD COLUMN "project_id" uuid');
    expect(sql).toContain('RAISE EXCEPTION');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS "todo_labels_owner_id_name_key"');
    expect(sql).toContain('UPDATE "task_label_assignments"');
    expect(sql).toContain('UPDATE "tasks"');
    expect(sql).toContain('ALTER TABLE "task_labels" ALTER COLUMN "project_id" SET NOT NULL');
    expect(sql).toContain('ALTER TABLE "tasks" ALTER COLUMN "project_id" SET NOT NULL');
  });
});
