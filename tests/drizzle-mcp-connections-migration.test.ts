import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import * as schema from '@/lib/db/schema';

type Journal = {
  entries: Array<{
    idx: number;
    tag: string;
    when: number;
  }>;
};

describe('drizzle mcp connections migration', () => {
  it('keeps the mcp connections migration registered in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const mcpMigration = journal.entries.find((entry) => entry.tag === '0010_mcp_connections');

    expect(mcpMigration).toBeTruthy();
    expect(mcpMigration?.idx).toBe(10);
    expect(existsSync(path.join(process.cwd(), 'drizzle', 'meta', '0010_snapshot.json'))).toBe(
      true,
    );
  });

  it('creates durable oauth client and mcp connection storage', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0010_mcp_connections.sql');
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE "oauth_clients"');
    expect(sql).toContain('CREATE TABLE "mcp_connections"');
    expect(sql).toContain('ALTER TABLE "oauth_codes" ADD COLUMN "client_id" text');
    expect(sql).toContain('"redirect_uris" jsonb NOT NULL');
    expect(sql).toContain('"engine" text');
    expect(sql).toContain('"last_used_at" timestamp (6) with time zone');
    expect(sql).toContain('"revoked_at" timestamp (6) with time zone');
  });

  it('adds oauth client and mcp connection tables to the canonical schema', () => {
    expect(schema).toHaveProperty('oauthClients');
    expect(schema).toHaveProperty('mcpConnections');
  });
});
