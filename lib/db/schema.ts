import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tsvector } from '@/lib/db/pg-types';
import type { ProjectBackgroundCredit } from '@/lib/project-backgrounds';

const currentAppUserId = sql`nullif(current_setting('app.user_id', true), '')`;

function appUserMatches(column: AnyPgColumn) {
  return sql`${column}::text = ${currentAppUserId}`;
}

function ownerViaUser(column: AnyPgColumn) {
  return sql`exists (
    select 1
    from "users"
    where "users"."id" = ${column}
      and "users"."id"::text = ${currentAppUserId}
  )`;
}

function ownerViaProject(column: AnyPgColumn) {
  return sql`exists (
    select 1
    from "projects"
    where "projects"."id" = ${column}
      and "projects"."owner_id"::text = ${currentAppUserId}
  )`;
}

function ownerViaTask(column: AnyPgColumn) {
  return sql`exists (
    select 1
    from "tasks"
    where "tasks"."id" = ${column}
      and "tasks"."owner_id"::text = ${currentAppUserId}
  )`;
}

function ownerViaTaskAndLabel(taskIdColumn: AnyPgColumn, labelIdColumn: AnyPgColumn) {
  return sql`${ownerViaTask(taskIdColumn)}
    and exists (
      select 1
      from "task_labels"
      where "task_labels"."id" = ${labelIdColumn}
        and "task_labels"."owner_id"::text = ${currentAppUserId}
    )`;
}

function currentSessionIsOwner() {
  return sql`exists (
    select 1
    from "users"
    where "users"."id"::text = ${currentAppUserId}
      and "users"."is_owner" = true
  )`;
}

// ─── Users ───────────────────────────────────────────────────────────
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    name: text('name'),
    isOwner: boolean('is_owner').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    pgPolicy('users_select_self', {
      for: 'select',
      using: appUserMatches(table.id),
    }),
    pgPolicy('users_update_self', {
      for: 'update',
      using: appUserMatches(table.id),
      withCheck: appUserMatches(table.id),
    }),
    pgPolicy('users_insert_owner_bootstrap', {
      for: 'insert',
      withCheck: sql`${table.isOwner} = true
        and not exists (select 1 from "users" where "users"."is_owner" = true)`,
    }),
  ],
).enableRLS();

// ─── OAuth Codes ─────────────────────────────────────────────────────
export const oauthCodes = pgTable(
  'oauth_codes',
  {
    code: text('code').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: text('client_id').references(() => oauthClients.clientId, { onDelete: 'cascade' }),
    codeChallenge: text('code_challenge').notNull(),
    codeChallengeMethod: text('code_challenge_method').notNull(),
    redirectUri: text('redirect_uri').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, precision: 6 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy('oauth_codes_owner_via_user', {
      for: 'all',
      using: ownerViaUser(table.userId),
      withCheck: ownerViaUser(table.userId),
    }),
    index('oauth_codes_user_id_expires_at_idx').on(table.userId, table.expiresAt),
    index('oauth_codes_client_id_expires_at_idx').on(table.clientId, table.expiresAt),
  ],
).enableRLS();

// ─── OAuth Clients ───────────────────────────────────────────────────
export const oauthClients = pgTable(
  'oauth_clients',
  {
    clientId: text('client_id').primaryKey(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }),
    clientName: text('client_name'),
    redirectUris: jsonb('redirect_uris').$type<string[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    pgPolicy('oauth_clients_owner_all', {
      for: 'all',
      using: ownerViaUser(table.ownerId),
      withCheck: ownerViaUser(table.ownerId),
    }),
    index('oauth_clients_owner_id_idx').on(table.ownerId),
  ],
).enableRLS();

// ─── MCP Connections ────────────────────────────────────────────────
export const mcpConnections = pgTable(
  'mcp_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    redirectUri: text('redirect_uri').notNull(),
    engine: text('engine').$type<'claude-code' | 'codex' | 'gemini-cli' | null>(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, precision: 6 }),
    expiresAt: timestamp('expires_at', { withTimezone: true, precision: 6 }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, precision: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    pgPolicy('mcp_connections_owner_all', {
      for: 'all',
      using: appUserMatches(table.ownerId),
      withCheck: appUserMatches(table.ownerId),
    }),
    index('mcp_connections_owner_id_revoked_at_idx').on(table.ownerId, table.revokedAt),
    index('mcp_connections_client_id_idx').on(table.clientId),
  ],
).enableRLS();

// ─── Browser Sessions ───────────────────────────────────────────────
export const browserSessions = pgTable(
  'browser_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    browserName: text('browser_name'),
    osName: text('os_name'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, precision: 6 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, precision: 6 }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, precision: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    pgPolicy('browser_sessions_owner_all', {
      for: 'all',
      using: appUserMatches(table.ownerId),
      withCheck: appUserMatches(table.ownerId),
    }),
    index('browser_sessions_owner_id_revoked_at_idx').on(table.ownerId, table.revokedAt),
    index('browser_sessions_owner_id_last_used_at_idx').on(table.ownerId, table.lastUsedAt),
  ],
).enableRLS();

// ─── API Tokens ──────────────────────────────────────────────────────
export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenPrefix: text('token_prefix').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, precision: 6 }),
    expiresAt: timestamp('expires_at', { withTimezone: true, precision: 6 }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, precision: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    pgPolicy('api_tokens_owner_all', {
      for: 'all',
      using: appUserMatches(table.ownerId),
      withCheck: appUserMatches(table.ownerId),
    }),
    index('api_tokens_owner_id_revoked_at_idx').on(table.ownerId, table.revokedAt),
  ],
).enableRLS();

// ─── Projects ────────────────────────────────────────────────────────
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectKey: text('project_key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    repoUrl: text('repo_url'),
    vercelUrl: text('vercel_url'),
    status: text('status').notNull().default('active'),
    priority: integer('priority').notNull().default(2),
    bgImage: text('bg_image'),
    bgImageCredit: jsonb('bg_image_credit').$type<ProjectBackgroundCredit | null>(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, precision: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    pgPolicy('projects_owner_all', {
      for: 'all',
      using: appUserMatches(table.ownerId),
      withCheck: appUserMatches(table.ownerId),
    }),
    index('projects_owner_id_idx').on(table.ownerId),
    uniqueIndex('projects_owner_id_project_key_idx').on(table.ownerId, table.projectKey),
  ],
).enableRLS();

// ─── Task Labels ─────────────────────────────────────────────────────
export const taskLabels = pgTable(
  'task_labels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('blue'),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    pgPolicy('task_labels_owner_all', {
      for: 'all',
      using: appUserMatches(table.ownerId),
      withCheck: appUserMatches(table.ownerId),
    }),
    index('task_labels_owner_id_idx').on(table.ownerId),
    index('task_labels_project_id_idx').on(table.projectId),
    uniqueIndex('task_labels_project_id_name_idx').on(table.projectId, table.name),
  ],
).enableRLS();

export const taskLabelAssignments = pgTable(
  'task_label_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => taskLabels.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy('task_label_assignments_owner_via_task', {
      for: 'all',
      using: ownerViaTaskAndLabel(table.taskId, table.labelId),
      withCheck: ownerViaTaskAndLabel(table.taskId, table.labelId),
    }),
    index('task_label_assignments_task_id_idx').on(table.taskId, table.position),
    index('task_label_assignments_label_id_idx').on(table.labelId),
    uniqueIndex('task_label_assignments_task_id_label_id_unique_idx').on(
      table.taskId,
      table.labelId,
    ),
  ],
).enableRLS();

// ─── Tasks ───────────────────────────────────────────────────────────
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id').references(() => taskLabels.id, { onDelete: 'set null' }),
    taskKey: text('task_key').notNull(),
    taskPrefix: text('task_prefix').notNull(),
    taskNumber: integer('task_number').notNull(),
    title: text('title').notNull(),
    note: text('note'),
    status: text('status').notNull().default('inbox'),
    taskPriority: text('task_priority').notNull().default('none'),
    branch: text('branch'),
    engine: text('engine'),
    dispatchTarget: text('dispatch_target'),
    runState: text('run_state'),
    runStateUpdatedAt: timestamp('run_state_updated_at', { withTimezone: true, precision: 6 }),
    searchVector: tsvector('search_vector'),
    dueAt: timestamp('due_at', { withTimezone: true, precision: 6 }),
    focusedAt: timestamp('focused_at', { withTimezone: true, precision: 6 }),
    sortOrder: varchar('sort_order', { length: 64 }).notNull().default('a0'),
    archivedAt: timestamp('archived_at', { withTimezone: true, precision: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    pgPolicy('tasks_owner_all', {
      for: 'all',
      using: appUserMatches(table.ownerId),
      withCheck: appUserMatches(table.ownerId),
    }),
    index('tasks_owner_id_idx').on(table.ownerId),
    index('tasks_owner_id_task_prefix_task_number_idx').on(
      table.ownerId,
      table.taskPrefix,
      table.taskNumber,
    ),
    index('tasks_project_id_idx').on(table.projectId),
    index('tasks_label_id_idx').on(table.labelId),
    index('tasks_owner_id_status_sort_order_idx').on(table.ownerId, table.status, table.sortOrder),
    index('tasks_owner_id_engine_idx').on(table.ownerId, table.engine),
    index('tasks_owner_id_run_state_idx').on(table.ownerId, table.runState),
    index('tasks_owner_id_dispatch_target_idx').on(table.ownerId, table.dispatchTarget),
    index('tasks_search_vector_idx').using('gin', table.searchVector),
    uniqueIndex('tasks_owner_id_task_key_idx').on(table.ownerId, table.taskKey),
    uniqueIndex('tasks_owner_id_task_prefix_task_number_unique_idx').on(
      table.ownerId,
      table.taskPrefix,
      table.taskNumber,
    ),
  ],
).enableRLS();

// ─── Dispatch Requests ──────────────────────────────────────────────
export const dispatchRequests = pgTable(
  'dispatch_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    objective: text('objective').notNull(),
    projectKey: text('project_key').notNull(),
    taskKey: text('task_key'),
    engine: text('engine'),
    dispatchTarget: text('dispatch_target').notNull().default('claude-code-channel'),
    branchName: text('branch_name'),
    promptMetadata: jsonb('prompt_metadata'),
    state: text('state').notNull().default('queued'),
    errorMessage: text('error_message'),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true, precision: 6 }),
    failedAt: timestamp('failed_at', { withTimezone: true, precision: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    pgPolicy('dispatch_requests_owner_all', {
      for: 'all',
      using: appUserMatches(table.ownerId),
      withCheck: appUserMatches(table.ownerId),
    }),
    index('dispatch_requests_owner_id_state_dispatch_target_idx').on(
      table.ownerId,
      table.state,
      table.dispatchTarget,
      table.createdAt,
    ),
    index('dispatch_requests_owner_id_objective_idx').on(table.ownerId, table.objective),
    index('dispatch_requests_owner_id_project_key_idx').on(table.ownerId, table.projectKey),
    index('dispatch_requests_owner_id_task_key_idx').on(table.ownerId, table.taskKey),
  ],
).enableRLS();

// ─── Work Logs ───────────────────────────────────────────────────────
export const workLogs = pgTable(
  'work_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    detail: text('detail'),
    engine: text('engine'),
    workedAt: timestamp('worked_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy('work_logs_owner_all', {
      for: 'all',
      using: appUserMatches(table.ownerId),
      withCheck: appUserMatches(table.ownerId),
    }),
    index('work_logs_owner_id_idx').on(table.ownerId),
    index('work_logs_project_id_idx').on(table.projectId),
    index('work_logs_task_id_idx').on(table.taskId),
    index('work_logs_owner_id_worked_at_created_at_idx').on(
      table.ownerId,
      table.workedAt,
      table.createdAt,
    ),
    index('work_logs_owner_id_project_id_worked_at_idx').on(
      table.ownerId,
      table.projectId,
      table.workedAt,
    ),
  ],
).enableRLS();

// ─── Dashboard Work Log Rollups ─────────────────────────────────────
export const dashboardWorkLogDailyTotals = pgTable(
  'dashboard_work_log_daily_totals',
  {
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bucketDate: date('bucket_date').notNull(),
    count: integer('count').notNull().default(0),
  },
  (table) => [
    primaryKey({
      columns: [table.ownerId, table.bucketDate],
      name: 'dashboard_work_log_daily_totals_pkey',
    }),
    pgPolicy('dashboard_work_log_daily_totals_owner_all', {
      for: 'all',
      using: appUserMatches(table.ownerId),
      withCheck: appUserMatches(table.ownerId),
    }),
    index('dashboard_work_log_daily_totals_owner_id_bucket_date_idx').on(
      table.ownerId,
      table.bucketDate,
    ),
  ],
).enableRLS();

export const dashboardProjectWorkLogDaily = pgTable(
  'dashboard_project_work_log_daily',
  {
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    bucketDate: date('bucket_date').notNull(),
    count: integer('count').notNull().default(0),
  },
  (table) => [
    primaryKey({
      columns: [table.ownerId, table.projectId, table.bucketDate],
      name: 'dashboard_project_work_log_daily_pkey',
    }),
    pgPolicy('dashboard_project_work_log_daily_owner_all', {
      for: 'all',
      using: appUserMatches(table.ownerId),
      withCheck: appUserMatches(table.ownerId),
    }),
    index('dashboard_project_work_log_daily_owner_id_bucket_date_idx').on(
      table.ownerId,
      table.bucketDate,
    ),
    index('dashboard_project_work_log_daily_owner_id_project_id_bucket_date_idx').on(
      table.ownerId,
      table.projectId,
      table.bucketDate,
    ),
  ],
).enableRLS();

// ─── Audit Logs ──────────────────────────────────────────────────────
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy('audit_logs_owner_all', {
      for: 'all',
      using: appUserMatches(table.ownerId),
      withCheck: appUserMatches(table.ownerId),
    }),
    index('audit_logs_owner_id_created_at_idx').on(table.ownerId, table.createdAt),
  ],
).enableRLS();

// ─── User Settings ───────────────────────────────────────────────────
export const userSettings = pgTable(
  'user_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    pgPolicy('user_settings_owner_all', {
      for: 'all',
      using: appUserMatches(table.ownerId),
      withCheck: appUserMatches(table.ownerId),
    }),
    uniqueIndex('user_settings_owner_id_key_idx').on(table.ownerId, table.key),
  ],
).enableRLS();

// ─── Project Settings ────────────────────────────────────────────────
export const projectSettings = pgTable(
  'project_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    pgPolicy('project_settings_owner_via_project', {
      for: 'all',
      using: ownerViaProject(table.projectId),
      withCheck: ownerViaProject(table.projectId),
    }),
    index('project_settings_project_id_idx').on(table.projectId),
    uniqueIndex('project_settings_project_id_key_idx').on(table.projectId, table.key),
  ],
).enableRLS();

// ─── QA Runs ─────────────────────────────────────────────────────────
export const qaRuns = pgTable(
  'qa_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    branchName: text('branch_name').notNull(),
    status: text('status').notNull().default('queued'),
    engine: text('engine'),
    targetUrl: text('target_url'),
    taskKeys: jsonb('task_keys').$type<string[]>().notNull(),
    summary: jsonb('summary').$type<{
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    }>(),
    reportMarkdown: text('report_markdown'),
    startedAt: timestamp('started_at', { withTimezone: true, precision: 6 }),
    finishedAt: timestamp('finished_at', { withTimezone: true, precision: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    pgPolicy('qa_runs_owner_all', {
      for: 'all',
      using: appUserMatches(table.ownerId),
      withCheck: appUserMatches(table.ownerId),
    }),
    index('qa_runs_owner_id_idx').on(table.ownerId),
    index('qa_runs_project_id_created_at_idx').on(table.projectId, table.createdAt),
    index('qa_runs_owner_id_status_idx').on(table.ownerId, table.status),
  ],
).enableRLS();

// ─── Task Notifications ─────────────────────────────────────────────
export const taskNotifications = pgTable(
  'task_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id'),
    taskId: uuid('task_id').notNull(),
    taskKey: text('task_key').notNull(),
    taskTitle: text('task_title').notNull(),
    statusFrom: text('status_from').notNull(),
    statusTo: text('status_to').notNull(),
    readAt: timestamp('read_at', { withTimezone: true, precision: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy('task_notifications_owner_all', {
      for: 'all',
      using: appUserMatches(table.ownerId),
      withCheck: appUserMatches(table.ownerId),
    }),
    index('task_notifications_owner_id_read_at_created_at_idx').on(
      table.ownerId,
      table.readAt,
      table.createdAt,
    ),
    index('task_notifications_owner_id_created_at_idx').on(table.ownerId, table.createdAt),
    index('task_notifications_task_id_idx').on(table.taskId),
  ],
).enableRLS();

// ─── Events Outbox ───────────────────────────────────────────────────
export const eventsOutbox = pgTable(
  'events_outbox',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    ownerId: uuid('owner_id').notNull(),
    projectId: uuid('project_id'),
    eventType: text('event_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy('events_outbox_owner_all', {
      for: 'all',
      using: appUserMatches(table.ownerId),
      withCheck: appUserMatches(table.ownerId),
    }),
    index('events_outbox_owner_id_id_idx').on(table.ownerId, table.id),
    index('events_outbox_owner_id_project_id_id_idx').on(table.ownerId, table.projectId, table.id),
  ],
).enableRLS();

// ─── Security Events ────────────────────────────────────────────────
export const securityEvents = pgTable(
  'security_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email'),
    eventType: text('event_type').notNull(),
    outcome: text('outcome').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    path: text('path'),
    detail: jsonb('detail'),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy('security_events_owner_select', {
      for: 'select',
      using: currentSessionIsOwner(),
    }),
    pgPolicy('security_events_owner_insert', {
      for: 'insert',
      withCheck: sql`${currentSessionIsOwner()}
        and (${table.ownerId} is null or ${appUserMatches(table.ownerId)})`,
    }),
    index('security_events_owner_id_created_at_idx').on(table.ownerId, table.createdAt),
    index('security_events_actor_email_created_at_idx').on(table.actorEmail, table.createdAt),
  ],
).enableRLS();
