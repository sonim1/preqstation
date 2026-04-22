import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

type Journal = {
  entries: Array<{
    idx: number;
    tag: string;
    when: number;
  }>;
};

describe('drizzle dashboard rollups migration', () => {
  it('registers the dashboard rollup migration file', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0011_dashboard_rollups.sql');
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('registers the timezone guard follow-up migration in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const timezoneGuardMigration = journal.entries.find(
      (entry) => entry.tag === '0015_dashboard_rollup_timezone_guard',
    );

    expect(timezoneGuardMigration).toBeTruthy();
    expect(timezoneGuardMigration?.idx).toBe(15);
  });

  it('creates rollup tables, rebuild helpers, and work-log triggers', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0011_dashboard_rollups.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE TABLE "dashboard_work_log_daily_totals"');
    expect(sql).toContain('CREATE TABLE "dashboard_project_work_log_daily"');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION dashboard_rebuild_work_log_rollups');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION dashboard_sync_work_log_rollups');
    expect(sql).toContain('CREATE TRIGGER dashboard_work_log_rollups_sync');
    expect(sql).toContain(
      'ALTER TABLE "dashboard_work_log_daily_totals" ENABLE ROW LEVEL SECURITY;',
    );
    expect(sql).toContain(
      'ALTER TABLE "dashboard_project_work_log_daily" ENABLE ROW LEVEL SECURITY;',
    );
  });

  it('guards dashboard_owner_timezone against invalid saved timezone values', () => {
    const migrationPath = path.join(
      process.cwd(),
      'drizzle',
      '0015_dashboard_rollup_timezone_guard.sql',
    );
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION dashboard_owner_timezone');
    expect(sql).toContain('WHEN invalid_parameter_value THEN');
    expect(sql).toContain('RETURN v_fallback;');
  });
});
