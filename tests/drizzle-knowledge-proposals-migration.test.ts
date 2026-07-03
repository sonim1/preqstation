import { readFileSync } from 'node:fs';
import path from 'node:path';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { knowledgeUpdateProposals } from '@/lib/db/schema';

type Journal = {
  entries: Array<{
    idx: number;
    tag: string;
    when: number;
  }>;
};

describe('drizzle knowledge update proposals migration', () => {
  it('registers the knowledge proposal migration in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const migration = journal.entries.find(
      (entry) => entry.tag === '0027_knowledge_update_proposals',
    );

    expect(migration).toBeTruthy();
    expect(migration?.idx).toBe(27);
  });

  it('adds the proposal table to schema metadata with RLS', () => {
    const config = getTableConfig(knowledgeUpdateProposals);

    expect(config.name).toBe('knowledge_update_proposals');
    expect(config.enableRLS).toBe(true);
    expect(config.policies.map((policy) => policy.name)).toContain(
      'knowledge_update_proposals_owner_all',
    );
    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'owner_id',
        'project_id',
        'task_id',
        'source_node_id',
        'target',
        'body',
        'rationale',
        'status',
      ]),
    );
  });

  it('creates the proposal table, indexes, checks, and RLS policy', () => {
    const migrationPath = path.join(
      process.cwd(),
      'drizzle',
      '0027_knowledge_update_proposals.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "knowledge_update_proposals"');
    expect(sql).toContain('"status" text DEFAULT \'pending\' NOT NULL');
    expect(sql).toContain('CONSTRAINT "knowledge_update_proposals_status_check"');
    expect(sql).toContain(
      '"source_node_id" uuid REFERENCES "task_work_nodes"("id") ON DELETE set null',
    );

    for (const name of [
      'knowledge_update_proposals_owner_id_task_id_status_idx',
      'knowledge_update_proposals_source_node_id_idx',
      'knowledge_update_proposals_owner_id_status_created_at_idx',
    ]) {
      expect(sql).toContain(`"${name}"`);
    }

    expect(sql).toContain('ALTER TABLE "knowledge_update_proposals" ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE "knowledge_update_proposals" FORCE ROW LEVEL SECURITY;');
    expect(sql).toContain('CREATE POLICY "knowledge_update_proposals_owner_all"');
  });
});
