import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('drizzle qa runs migration', () => {
  it('guards legacy constraint renames to the qa_runs table', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0005_steady_qa_runs.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain("conrelid = 'public.qa_runs'::regclass");
    expect(sql).toContain("conname = 'dogfood_runs_owner_id_users_id_fk'");
    expect(sql).toContain("conname = 'dogfood_runs_project_id_projects_id_fk'");
  });

  it('guards legacy index renames when the target qa_runs indexes already exist', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0005_steady_qa_runs.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain("to_regclass('public.dogfood_runs_owner_id_idx') IS NOT NULL");
    expect(sql).toContain("to_regclass('public.qa_runs_owner_id_idx') IS NULL");
    expect(sql).toContain(
      "to_regclass('public.dogfood_runs_project_id_created_at_idx') IS NOT NULL",
    );
    expect(sql).toContain("to_regclass('public.qa_runs_project_id_created_at_idx') IS NULL");
    expect(sql).toContain("to_regclass('public.dogfood_runs_owner_id_status_idx') IS NOT NULL");
    expect(sql).toContain("to_regclass('public.qa_runs_owner_id_status_idx') IS NULL");
  });
});
