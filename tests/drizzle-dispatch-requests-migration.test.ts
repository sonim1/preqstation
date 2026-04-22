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

describe('drizzle dispatch requests migration', () => {
  it('keeps the dispatch request migration registered in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const migration = journal.entries.find((entry) => entry.tag === '0017_dispatch_requests');

    expect(migration).toBeTruthy();
    expect(migration?.idx).toBe(17);
  });

  it('creates the dispatch_requests table and primary queue index', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0017_dispatch_requests.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "dispatch_requests"');
    expect(sql).toContain('"project_key" text NOT NULL');
    expect(sql).toContain('"prompt_metadata" jsonb');
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "dispatch_requests_owner_id_state_dispatch_target_idx"',
    );
  });
});
