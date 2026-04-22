import type { db } from './index';
import type * as schema from './schema';

export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbClientOrTx = DbClient | DbTransaction;

// ─── User ────────────────────────────────────────────────────────────
export type InsertUser = typeof schema.users.$inferInsert;
export type SelectUser = typeof schema.users.$inferSelect;

// ─── OAuth Code ──────────────────────────────────────────────────────
export type InsertOauthCode = typeof schema.oauthCodes.$inferInsert;
export type SelectOauthCode = typeof schema.oauthCodes.$inferSelect;

// ─── OAuth Client ────────────────────────────────────────────────────
export type InsertOauthClient = typeof schema.oauthClients.$inferInsert;
export type SelectOauthClient = typeof schema.oauthClients.$inferSelect;

// ─── MCP Connection ──────────────────────────────────────────────────
export type InsertMcpConnection = typeof schema.mcpConnections.$inferInsert;
export type SelectMcpConnection = typeof schema.mcpConnections.$inferSelect;

// ─── Browser Session ─────────────────────────────────────────────────
export type InsertBrowserSession = typeof schema.browserSessions.$inferInsert;
export type SelectBrowserSession = typeof schema.browserSessions.$inferSelect;

// ─── API Token ───────────────────────────────────────────────────────
export type InsertApiToken = typeof schema.apiTokens.$inferInsert;
export type SelectApiToken = typeof schema.apiTokens.$inferSelect;

// ─── Project ─────────────────────────────────────────────────────────
export type InsertProject = typeof schema.projects.$inferInsert;
export type SelectProject = typeof schema.projects.$inferSelect;

// ─── Task ────────────────────────────────────────────────────────────
export type InsertTask = typeof schema.tasks.$inferInsert;
export type SelectTask = typeof schema.tasks.$inferSelect;

// ─── Task Label ──────────────────────────────────────────────────────
export type InsertTaskLabel = typeof schema.taskLabels.$inferInsert;
export type SelectTaskLabel = typeof schema.taskLabels.$inferSelect;
export type InsertTaskLabelAssignment = typeof schema.taskLabelAssignments.$inferInsert;
export type SelectTaskLabelAssignment = typeof schema.taskLabelAssignments.$inferSelect;

// ─── Work Log ────────────────────────────────────────────────────────
export type InsertWorkLog = typeof schema.workLogs.$inferInsert;
export type SelectWorkLog = typeof schema.workLogs.$inferSelect;
export type InsertDashboardWorkLogDailyTotal =
  typeof schema.dashboardWorkLogDailyTotals.$inferInsert;
export type SelectDashboardWorkLogDailyTotal =
  typeof schema.dashboardWorkLogDailyTotals.$inferSelect;
export type InsertDashboardProjectWorkLogDaily =
  typeof schema.dashboardProjectWorkLogDaily.$inferInsert;
export type SelectDashboardProjectWorkLogDaily =
  typeof schema.dashboardProjectWorkLogDaily.$inferSelect;

// ─── Audit Log ───────────────────────────────────────────────────────
export type InsertAuditLog = typeof schema.auditLogs.$inferInsert;
export type SelectAuditLog = typeof schema.auditLogs.$inferSelect;

// ─── User Setting ────────────────────────────────────────────────────
export type InsertUserSetting = typeof schema.userSettings.$inferInsert;
export type SelectUserSetting = typeof schema.userSettings.$inferSelect;

// ─── Project Setting ─────────────────────────────────────────────────
export type InsertProjectSetting = typeof schema.projectSettings.$inferInsert;
export type SelectProjectSetting = typeof schema.projectSettings.$inferSelect;

// ─── QA Run ──────────────────────────────────────────────────────────
export type InsertQaRun = typeof schema.qaRuns.$inferInsert;
export type SelectQaRun = typeof schema.qaRuns.$inferSelect;

// ─── Event Outbox ────────────────────────────────────────────────────
export type InsertEventOutbox = typeof schema.eventsOutbox.$inferInsert;
export type SelectEventOutbox = typeof schema.eventsOutbox.$inferSelect;

// ─── Security Event ──────────────────────────────────────────────────
export type InsertSecurityEvent = typeof schema.securityEvents.$inferInsert;
export type SelectSecurityEvent = typeof schema.securityEvents.$inferSelect;
