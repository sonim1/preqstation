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

describe('drizzle auth and oauth migration', () => {
  it('keeps the auth and oauth migration registered in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const authMigration = journal.entries.find(
      (entry) => entry.tag === '0007_preq_mcp_oauth_db_auth',
    );

    expect(authMigration).toBeTruthy();
    expect(authMigration?.idx).toBe(7);
  });

  it('adds owner password hashes and oauth code storage', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0007_preq_mcp_oauth_db_auth.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('ALTER TABLE "users" ADD COLUMN "password_hash" text');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "oauth_codes"');
    expect(sql).toContain('"user_id" uuid NOT NULL');
    expect(sql).toContain('"code_challenge" text NOT NULL');
    expect(sql).toContain('"redirect_uri" text NOT NULL');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "oauth_codes_user_id_expires_at_idx"');
  });
});
