import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

type Journal = {
  entries: Array<{
    tag: string;
    when: number;
  }>;
};

describe('drizzle task label assignments migration', () => {
  it('keeps the first tracked migration incremental for existing databases', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const firstMigrationTag = journal.entries[0]?.tag;

    expect(firstMigrationTag).toBeTruthy();

    const migrationPath = path.join(process.cwd(), 'drizzle', `${firstMigrationTag}.sql`);
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "task_label_assignments"');
    expect(sql).toContain('INSERT INTO "task_label_assignments"');
    expect(sql).toContain('ON CONFLICT ("task_id", "label_id") DO NOTHING');
    expect(sql).not.toContain('CREATE TABLE "users"');
    expect(sql).not.toContain('CREATE TABLE "api_tokens"');
  });

  it('keeps migration timestamps in ascending order so newer migrations are applied', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const timestamps = journal.entries.map((entry) => entry.when);
    const sortedTimestamps = [...timestamps].sort((a, b) => a - b);

    expect(timestamps).toEqual(sortedTimestamps);
  });

  it('includes a cleanup migration for legacy task workflow and engine aliases', () => {
    const migrationPath = path.join(
      process.cwd(),
      'drizzle',
      '0003_legacy_compatibility_cleanup.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('WHERE "status" = \'in_progress\'');
    expect(sql).toContain("WHERE \"status\" IN ('in_review', 'review')");
    expect(sql).toContain('WHERE "status" = \'blocked\'');
    expect(sql).toContain('SET "engine" = \'claude-code\'');
    expect(sql).toContain('SET "engine" = \'gemini-cli\'');
    expect(sql).toContain('WHERE "key" = \'engine_in_progress\'');
    expect(sql).toContain('WHERE "key" = \'engine_in_review\'');
    expect(sql).toContain("replace(\"title\", 'In Progress', 'Todo')");
    expect(sql).toContain("replace(\"detail\", '`In Progress`', '`Todo`')");
  });
});
