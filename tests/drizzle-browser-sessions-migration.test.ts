import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { browserSessions } from '@/lib/db/schema';

type Journal = {
  entries: Array<{
    idx: number;
    tag: string;
    when: number;
  }>;
};

describe('drizzle browser sessions migration', () => {
  it('keeps the browser sessions migration registered in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const browserSessionsMigration = journal.entries.find(
      (entry) => entry.tag === '0012_browser_sessions',
    );

    expect(browserSessionsMigration).toBeTruthy();
    expect(browserSessionsMigration?.idx).toBe(12);
    expect(existsSync(path.join(process.cwd(), 'drizzle', 'meta', '0012_snapshot.json'))).toBe(
      true,
    );
  });

  it('creates durable browser session storage with owner-scoped metadata', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0012_browser_sessions.sql');
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE "browser_sessions"');
    expect(sql).toContain('"owner_id" uuid NOT NULL');
    expect(sql).toContain('"ip_address" text');
    expect(sql).toContain('"user_agent" text');
    expect(sql).toContain('"browser_name" text');
    expect(sql).toContain('"os_name" text');
    expect(sql).toContain('"last_used_at" timestamp (6) with time zone');
    expect(sql).toContain('"expires_at" timestamp (6) with time zone NOT NULL');
    expect(sql).toContain('"revoked_at" timestamp (6) with time zone');
    expect(sql).toContain('ALTER TABLE "browser_sessions" ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('CREATE POLICY "browser_sessions_owner_all"');
  });

  it('adds browser sessions to the canonical schema with owner-scoped RLS metadata', () => {
    const config = getTableConfig(browserSessions);

    expect(config.name).toBe('browser_sessions');
    expect(config.enableRLS).toBe(true);
    expect(config.policies.map((policy) => policy.name)).toContain('browser_sessions_owner_all');
  });
});
