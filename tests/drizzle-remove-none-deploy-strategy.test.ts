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

describe('drizzle remove none deploy strategy migration', () => {
  it('registers the removal migration in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const migration = journal.entries.find(
      (entry) => entry.tag === '0020_remove_none_deploy_strategy',
    );

    expect(migration).toBeTruthy();
    expect(migration?.idx).toBe(20);
  });

  it('backfills legacy none deploy strategy values to direct commit', () => {
    const migrationPath = path.join(
      process.cwd(),
      'drizzle',
      '0020_remove_none_deploy_strategy.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('UPDATE "project_settings"');
    expect(sql).toContain(`SET "value" = 'direct_commit'`);
    expect(sql).toContain(`WHERE "key" = 'deploy_strategy' AND "value" = 'none'`);
  });

  it('normalizes companion direct-commit flags for the same legacy none projects', () => {
    const migrationPath = path.join(
      process.cwd(),
      'drizzle',
      '0020_remove_none_deploy_strategy.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('affected_projects');
    expect(sql).toContain(`SET "value" = 'true'`);
    expect(sql).toContain(`"project_id" IN (SELECT "project_id" FROM affected_projects)`);
    expect(sql).toContain(`"key" IN ('deploy_commit_on_review', 'deploy_squash_merge')`);
  });
});
