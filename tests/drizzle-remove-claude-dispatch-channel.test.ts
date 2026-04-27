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

describe('drizzle remove claude dispatch channel migration', () => {
  it('registers the removal migration in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const migration = journal.entries.find(
      (entry) => entry.tag === '0019_remove_claude_dispatch_channel',
    );

    expect(migration).toBeTruthy();
    expect(migration?.idx).toBe(19);
  });

  it('backfills legacy task targets and drops the dispatch_requests table', () => {
    const migrationPath = path.join(
      process.cwd(),
      'drizzle',
      '0019_remove_claude_dispatch_channel.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain(
      `UPDATE "tasks" SET "dispatch_target" = 'telegram' WHERE "dispatch_target" = 'claude-code-channel'`,
    );
    expect(sql).toContain('DROP TABLE IF EXISTS "dispatch_requests"');
  });
});
