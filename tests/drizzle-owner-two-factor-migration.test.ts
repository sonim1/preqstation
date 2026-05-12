import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { users } from '@/lib/db/schema';

type Journal = {
  entries: Array<{
    idx: number;
    tag: string;
    when: number;
  }>;
};

describe('drizzle owner two factor migration', () => {
  it('registers the owner two factor migration in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const migration = journal.entries.find((entry) => entry.tag === '0024_owner_totp_2fa');

    expect(migration).toBeTruthy();
    expect(migration?.idx).toBe(24);
    expect(existsSync(path.join(process.cwd(), 'drizzle', 'meta', '0024_snapshot.json'))).toBe(
      true,
    );
  });

  it('adds disabled-by-default two factor columns to persisted SQL schema', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0024_owner_totp_2fa.sql');
    expect(existsSync(migrationPath)).toBe(true);

    const migrationSql = readFileSync(migrationPath, 'utf8');
    expect(migrationSql).toContain(
      'ALTER TABLE "users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;',
    );
    expect(migrationSql).toContain('ALTER TABLE "users" ADD COLUMN "two_factor_secret" text;');

    const canonicalSql = readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
    expect(canonicalSql).toContain('two_factor_enabled boolean not null default false');
    expect(canonicalSql).toContain('two_factor_secret text');
  });

  it('adds owner two factor fields to the canonical Drizzle user schema', () => {
    const config = getTableConfig(users);

    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['two_factor_enabled', 'two_factor_secret']),
    );
  });
});
