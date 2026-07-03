import { readFileSync } from 'node:fs';
import path from 'node:path';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
  tasks,
  taskWorkNodeDependencies,
  taskWorkNodeEvents,
  taskWorkNodeEvidence,
  taskWorkNodes,
} from '@/lib/db/schema';
import {
  WORK_NODE_EVENT_TYPES,
  WORK_NODE_EVIDENCE_KINDS,
  WORK_NODE_STATUSES,
  WORK_NODE_TYPES,
} from '@/lib/work-graph';

type Journal = {
  entries: Array<{
    idx: number;
    tag: string;
    when: number;
  }>;
};

describe('drizzle task work graph migration', () => {
  it('registers the task work graph migration in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const migration = journal.entries.find((entry) => entry.tag === '0026_task_work_graph');

    expect(migration).toBeTruthy();
    expect(migration?.idx).toBe(26);
  });

  it('adds workflow memory columns to tasks and graph tables to schema metadata', () => {
    const taskColumns = getTableConfig(tasks).columns.map((column) => column.name);

    expect(taskColumns).toContain('workflow_memory');
    expect(taskColumns).toContain('workflow_memory_updated_at');

    const configs = [
      getTableConfig(taskWorkNodes),
      getTableConfig(taskWorkNodeDependencies),
      getTableConfig(taskWorkNodeEvents),
      getTableConfig(taskWorkNodeEvidence),
    ];

    expect(configs.map((config) => config.name).sort()).toEqual([
      'task_work_node_dependencies',
      'task_work_node_events',
      'task_work_node_evidence',
      'task_work_nodes',
    ]);

    for (const config of configs) {
      expect(config.enableRLS).toBe(true);
      expect(config.policies.map((policy) => policy.name)).toContain(`${config.name}_owner_all`);
    }
  });

  it('keeps work node enums runtime-agnostic and complete for the MVP', () => {
    expect(WORK_NODE_TYPES).toEqual([
      'root',
      'plan',
      'explore',
      'analyze',
      'research',
      'interview',
      'implement',
      'document',
      'review',
      'test',
      'qa',
      'deploy',
      'decision',
      'approval',
      'blocked',
      'proposal',
      'result',
    ]);
    expect(WORK_NODE_STATUSES).toEqual([
      'pending',
      'ready',
      'running',
      'waiting_for_user',
      'blocked',
      'completed',
      'failed',
      'cancelled',
    ]);
    expect(WORK_NODE_EVENT_TYPES).toContain('workflow_memory.appended');
    expect(WORK_NODE_EVIDENCE_KINDS).toContain('pull_request');
  });

  it('creates graph tables, indexes, RLS policies, and binary sort order collation', () => {
    const migrationPath = path.join(process.cwd(), 'drizzle', '0026_task_work_graph.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "workflow_memory" text;');
    expect(sql).toContain(
      'ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "workflow_memory_updated_at" timestamp (6) with time zone;',
    );
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "task_work_nodes"');
    expect(sql).toContain('"sort_order" varchar(64) COLLATE "C" NOT NULL DEFAULT \'a0\'');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "task_work_node_dependencies"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "task_work_node_events"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "task_work_node_evidence"');

    for (const name of [
      'task_work_nodes_owner_id_task_id_idx',
      'task_work_nodes_task_id_parent_id_sort_order_idx',
      'task_work_nodes_owner_id_status_idx',
      'task_work_nodes_owner_id_engine_idx',
      'task_work_nodes_owner_id_idempotency_key_unique_idx',
      'task_work_node_dependencies_node_depends_on_unique_idx',
      'task_work_node_events_task_id_created_at_idx',
      'task_work_node_events_node_id_created_at_idx',
      'task_work_node_events_owner_id_created_at_idx',
      'task_work_node_evidence_node_id_created_at_idx',
      'task_work_node_evidence_owner_id_kind_idx',
    ]) {
      expect(sql).toContain(`"${name}"`);
    }

    for (const tableName of [
      'task_work_nodes',
      'task_work_node_dependencies',
      'task_work_node_events',
      'task_work_node_evidence',
    ]) {
      expect(sql).toContain(`ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`);
      expect(sql).toContain(`ALTER TABLE "${tableName}" FORCE ROW LEVEL SECURITY;`);
      expect(sql).toContain(`CREATE POLICY "${tableName}_owner_all"`);
    }
  });
});
