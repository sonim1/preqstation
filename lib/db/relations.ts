import { relations } from 'drizzle-orm';

import {
  apiTokens,
  auditLogs,
  browserSessions,
  connectionNotificationReads,
  knowledgeUpdateProposals,
  mcpConnections,
  oauthClients,
  oauthCodes,
  projects,
  projectSettings,
  qaRuns,
  securityEvents,
  taskComments,
  taskLabelAssignments,
  taskLabels,
  tasks,
  taskWorkNodeDependencies,
  taskWorkNodeEvents,
  taskWorkNodeEvidence,
  taskWorkNodes,
  users,
  userSettings,
  workLogs,
} from './schema';

// ─── User Relations ──────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  apiTokens: many(apiTokens),
  browserSessions: many(browserSessions),
  oauthClients: many(oauthClients),
  mcpConnections: many(mcpConnections),
  oauthCodes: many(oauthCodes),
  projects: many(projects),
  taskLabels: many(taskLabels),
  taskComments: many(taskComments),
  taskWorkNodes: many(taskWorkNodes),
  taskWorkNodeDependencies: many(taskWorkNodeDependencies),
  taskWorkNodeEvents: many(taskWorkNodeEvents),
  taskWorkNodeEvidence: many(taskWorkNodeEvidence),
  tasks: many(tasks),
  workLogs: many(workLogs),
  auditLogs: many(auditLogs),
  userSettings: many(userSettings),
  securityEvents: many(securityEvents),
  qaRuns: many(qaRuns),
  connectionNotificationReads: many(connectionNotificationReads),
  knowledgeUpdateProposals: many(knowledgeUpdateProposals),
}));

// ─── OAuth Client Relations ──────────────────────────────────────────
export const oauthClientsRelations = relations(oauthClients, ({ one, many }) => ({
  owner: one(users, {
    fields: [oauthClients.ownerId],
    references: [users.id],
  }),
  oauthCodes: many(oauthCodes),
  mcpConnections: many(mcpConnections),
}));

// ─── OAuth Code Relations ────────────────────────────────────────────
export const oauthCodesRelations = relations(oauthCodes, ({ one }) => ({
  user: one(users, {
    fields: [oauthCodes.userId],
    references: [users.id],
  }),
  client: one(oauthClients, {
    fields: [oauthCodes.clientId],
    references: [oauthClients.clientId],
  }),
}));

// ─── MCP Connection Relations ────────────────────────────────────────
export const mcpConnectionsRelations = relations(mcpConnections, ({ one }) => ({
  owner: one(users, {
    fields: [mcpConnections.ownerId],
    references: [users.id],
  }),
  client: one(oauthClients, {
    fields: [mcpConnections.clientId],
    references: [oauthClients.clientId],
  }),
}));

// ─── Browser Session Relations ───────────────────────────────────────
export const browserSessionsRelations = relations(browserSessions, ({ one }) => ({
  owner: one(users, {
    fields: [browserSessions.ownerId],
    references: [users.id],
  }),
}));

// ─── API Token Relations ─────────────────────────────────────────────
export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  owner: one(users, {
    fields: [apiTokens.ownerId],
    references: [users.id],
  }),
}));

// ─── Project Relations ───────────────────────────────────────────────
export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  taskLabels: many(taskLabels),
  tasks: many(tasks),
  taskComments: many(taskComments),
  workLogs: many(workLogs),
  taskWorkNodes: many(taskWorkNodes),
  taskWorkNodeEvents: many(taskWorkNodeEvents),
  taskWorkNodeEvidence: many(taskWorkNodeEvidence),
  knowledgeUpdateProposals: many(knowledgeUpdateProposals),
  projectSettings: many(projectSettings),
  qaRuns: many(qaRuns),
}));

// ─── Task Label Relations ────────────────────────────────────────────
export const taskLabelsRelations = relations(taskLabels, ({ one, many }) => ({
  owner: one(users, {
    fields: [taskLabels.ownerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [taskLabels.projectId],
    references: [projects.id],
  }),
  labelAssignments: many(taskLabelAssignments),
  tasks: many(tasks),
}));

// ─── Task Relations ──────────────────────────────────────────────────
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  owner: one(users, {
    fields: [tasks.ownerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  label: one(taskLabels, {
    fields: [tasks.labelId],
    references: [taskLabels.id],
  }),
  labelAssignments: many(taskLabelAssignments),
  comments: many(taskComments),
  workNodes: many(taskWorkNodes),
  workNodeDependencies: many(taskWorkNodeDependencies),
  workNodeEvents: many(taskWorkNodeEvents),
  workNodeEvidence: many(taskWorkNodeEvidence),
  knowledgeUpdateProposals: many(knowledgeUpdateProposals),
  workLogs: many(workLogs),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  owner: one(users, {
    fields: [taskComments.ownerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [taskComments.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
  parent: one(taskComments, {
    fields: [taskComments.parentCommentId],
    references: [taskComments.id],
  }),
}));

export const taskWorkNodesRelations = relations(taskWorkNodes, ({ one, many }) => ({
  owner: one(users, {
    fields: [taskWorkNodes.ownerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [taskWorkNodes.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [taskWorkNodes.taskId],
    references: [tasks.id],
  }),
  parent: one(taskWorkNodes, {
    fields: [taskWorkNodes.parentId],
    references: [taskWorkNodes.id],
  }),
  children: many(taskWorkNodes),
  dependencies: many(taskWorkNodeDependencies, { relationName: 'nodeDependencies' }),
  dependents: many(taskWorkNodeDependencies, { relationName: 'nodeDependents' }),
  events: many(taskWorkNodeEvents),
  evidence: many(taskWorkNodeEvidence),
  knowledgeUpdateProposals: many(knowledgeUpdateProposals),
}));

export const knowledgeUpdateProposalsRelations = relations(
  knowledgeUpdateProposals,
  ({ one }) => ({
    owner: one(users, {
      fields: [knowledgeUpdateProposals.ownerId],
      references: [users.id],
    }),
    project: one(projects, {
      fields: [knowledgeUpdateProposals.projectId],
      references: [projects.id],
    }),
    task: one(tasks, {
      fields: [knowledgeUpdateProposals.taskId],
      references: [tasks.id],
    }),
    sourceNode: one(taskWorkNodes, {
      fields: [knowledgeUpdateProposals.sourceNodeId],
      references: [taskWorkNodes.id],
    }),
  }),
);

export const taskWorkNodeDependenciesRelations = relations(
  taskWorkNodeDependencies,
  ({ one }) => ({
    owner: one(users, {
      fields: [taskWorkNodeDependencies.ownerId],
      references: [users.id],
    }),
    task: one(tasks, {
      fields: [taskWorkNodeDependencies.taskId],
      references: [tasks.id],
    }),
    node: one(taskWorkNodes, {
      fields: [taskWorkNodeDependencies.nodeId],
      references: [taskWorkNodes.id],
      relationName: 'nodeDependencies',
    }),
    dependsOnNode: one(taskWorkNodes, {
      fields: [taskWorkNodeDependencies.dependsOnNodeId],
      references: [taskWorkNodes.id],
      relationName: 'nodeDependents',
    }),
  }),
);

export const taskWorkNodeEventsRelations = relations(taskWorkNodeEvents, ({ one }) => ({
  owner: one(users, {
    fields: [taskWorkNodeEvents.ownerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [taskWorkNodeEvents.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [taskWorkNodeEvents.taskId],
    references: [tasks.id],
  }),
  node: one(taskWorkNodes, {
    fields: [taskWorkNodeEvents.nodeId],
    references: [taskWorkNodes.id],
  }),
}));

export const taskWorkNodeEvidenceRelations = relations(taskWorkNodeEvidence, ({ one }) => ({
  owner: one(users, {
    fields: [taskWorkNodeEvidence.ownerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [taskWorkNodeEvidence.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [taskWorkNodeEvidence.taskId],
    references: [tasks.id],
  }),
  node: one(taskWorkNodes, {
    fields: [taskWorkNodeEvidence.nodeId],
    references: [taskWorkNodes.id],
  }),
}));

export const connectionNotificationReadsRelations = relations(
  connectionNotificationReads,
  ({ one }) => ({
    owner: one(users, {
      fields: [connectionNotificationReads.ownerId],
      references: [users.id],
    }),
  }),
);

export const taskLabelAssignmentsRelations = relations(taskLabelAssignments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskLabelAssignments.taskId],
    references: [tasks.id],
  }),
  label: one(taskLabels, {
    fields: [taskLabelAssignments.labelId],
    references: [taskLabels.id],
  }),
}));

// ─── Work Log Relations ──────────────────────────────────────────────
export const workLogsRelations = relations(workLogs, ({ one }) => ({
  owner: one(users, {
    fields: [workLogs.ownerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [workLogs.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [workLogs.taskId],
    references: [tasks.id],
  }),
}));

// ─── Audit Log Relations ─────────────────────────────────────────────
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  owner: one(users, {
    fields: [auditLogs.ownerId],
    references: [users.id],
  }),
}));

// ─── User Setting Relations ──────────────────────────────────────────
export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  owner: one(users, {
    fields: [userSettings.ownerId],
    references: [users.id],
  }),
}));

// ─── Project Setting Relations ───────────────────────────────────────
export const projectSettingsRelations = relations(projectSettings, ({ one }) => ({
  project: one(projects, {
    fields: [projectSettings.projectId],
    references: [projects.id],
  }),
}));

// ─── QA Run Relations ────────────────────────────────────────────────
export const qaRunsRelations = relations(qaRuns, ({ one }) => ({
  owner: one(users, {
    fields: [qaRuns.ownerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [qaRuns.projectId],
    references: [projects.id],
  }),
}));

// ─── Events Outbox Relations ─────────────────────────────────────────
// EventOutbox keeps ownerId/projectId as plain columns, so there are no relation mappings here.

// ─── Security Event Relations ────────────────────────────────────────
export const securityEventsRelations = relations(securityEvents, ({ one }) => ({
  owner: one(users, {
    fields: [securityEvents.ownerId],
    references: [users.id],
  }),
}));
