import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
  apiTokens,
  auditLogs,
  dashboardProjectWorkLogDaily,
  dashboardWorkLogDailyTotals,
  eventsOutbox,
  mcpConnections,
  oauthClients,
  oauthCodes,
  projects,
  projectSettings,
  qaRuns,
  securityEvents,
  taskLabelAssignments,
  taskLabels,
  taskNotifications,
  tasks,
  users,
  userSettings,
  workLogs,
} from '@/lib/db/schema';

type Journal = {
  entries: Array<{
    idx: number;
    tag: string;
    when: number;
  }>;
};

const EXPECTED_POLICIES_BY_TABLE = {
  users: ['users_select_self', 'users_update_self', 'users_insert_owner_bootstrap'],
  oauth_clients: ['oauth_clients_owner_all'],
  oauth_codes: ['oauth_codes_owner_via_user'],
  mcp_connections: ['mcp_connections_owner_all'],
  api_tokens: ['api_tokens_owner_all'],
  projects: ['projects_owner_all'],
  task_labels: ['task_labels_owner_all'],
  task_label_assignments: ['task_label_assignments_owner_via_task'],
  tasks: ['tasks_owner_all'],
  task_notifications: ['task_notifications_owner_all'],
  work_logs: ['work_logs_owner_all'],
  dashboard_work_log_daily_totals: ['dashboard_work_log_daily_totals_owner_all'],
  dashboard_project_work_log_daily: ['dashboard_project_work_log_daily_owner_all'],
  audit_logs: ['audit_logs_owner_all'],
  user_settings: ['user_settings_owner_all'],
  project_settings: ['project_settings_owner_via_project'],
  qa_runs: ['qa_runs_owner_all'],
  events_outbox: ['events_outbox_owner_all'],
  security_events: ['security_events_owner_select', 'security_events_owner_insert'],
} as const;

const MIGRATION_0009_POLICY_TABLES = {
  users: EXPECTED_POLICIES_BY_TABLE.users,
  oauth_codes: EXPECTED_POLICIES_BY_TABLE.oauth_codes,
  api_tokens: EXPECTED_POLICIES_BY_TABLE.api_tokens,
  projects: EXPECTED_POLICIES_BY_TABLE.projects,
  task_labels: EXPECTED_POLICIES_BY_TABLE.task_labels,
  task_label_assignments: EXPECTED_POLICIES_BY_TABLE.task_label_assignments,
  tasks: EXPECTED_POLICIES_BY_TABLE.tasks,
  work_logs: EXPECTED_POLICIES_BY_TABLE.work_logs,
  audit_logs: EXPECTED_POLICIES_BY_TABLE.audit_logs,
  user_settings: EXPECTED_POLICIES_BY_TABLE.user_settings,
  project_settings: EXPECTED_POLICIES_BY_TABLE.project_settings,
  qa_runs: EXPECTED_POLICIES_BY_TABLE.qa_runs,
  events_outbox: EXPECTED_POLICIES_BY_TABLE.events_outbox,
  security_events: EXPECTED_POLICIES_BY_TABLE.security_events,
} as const;

const FORCED_RLS_TABLES = [
  'projects',
  'task_labels',
  'task_label_assignments',
  'tasks',
  'work_logs',
  'audit_logs',
  'user_settings',
  'project_settings',
  'qa_runs',
] as const;

const CANONICAL_TABLES = [
  users,
  oauthClients,
  oauthCodes,
  mcpConnections,
  apiTokens,
  projects,
  taskLabels,
  taskLabelAssignments,
  tasks,
  taskNotifications,
  workLogs,
  dashboardWorkLogDailyTotals,
  dashboardProjectWorkLogDaily,
  auditLogs,
  userSettings,
  projectSettings,
  qaRuns,
  eventsOutbox,
  securityEvents,
];

describe('drizzle row level security migration', () => {
  it('marks every current application table as RLS-enabled in canonical schema metadata', () => {
    const configs = CANONICAL_TABLES.map((table) => getTableConfig(table));

    expect(configs.map((config) => config.name).sort()).toEqual(
      Object.keys(EXPECTED_POLICIES_BY_TABLE).sort(),
    );

    for (const config of configs) {
      expect(config.enableRLS).toBe(true);
      expect(config.policies.map((policy) => policy.name).sort()).toEqual(
        [
          ...EXPECTED_POLICIES_BY_TABLE[config.name as keyof typeof EXPECTED_POLICIES_BY_TABLE],
        ].sort(),
      );
    }
  });

  it('keeps the full-schema RLS migration registered in the journal', () => {
    const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
    const rlsMigration = journal.entries.find(
      (entry) => entry.tag === '0009_row_level_security_for_all',
    );

    expect(rlsMigration).toBeTruthy();
    expect(rlsMigration?.idx).toBe(9);
    expect(existsSync(path.join(process.cwd(), 'drizzle', 'meta', '0009_snapshot.json'))).toBe(
      true,
    );
  });

  it('enables and forces RLS plus creates named policies for every protected table', () => {
    const migrationPath = path.join(
      process.cwd(),
      'drizzle',
      '0009_row_level_security_for_all.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8');

    for (const tableName of Object.keys(MIGRATION_0009_POLICY_TABLES)) {
      expect(sql).toContain(`ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`);
    }

    for (const tableName of FORCED_RLS_TABLES) {
      expect(sql).toContain(`ALTER TABLE "${tableName}" FORCE ROW LEVEL SECURITY;`);
    }

    for (const policyNames of Object.values(MIGRATION_0009_POLICY_TABLES)) {
      for (const policyName of policyNames) {
        expect(sql).toContain(`CREATE POLICY "${policyName}"`);
      }
    }
  });
});
