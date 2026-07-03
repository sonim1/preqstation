import os from 'node:os';

import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  tasks,
  taskWorkNodeDependencies,
  taskWorkNodeEvents,
  taskWorkNodeEvidence,
  taskWorkNodes,
} from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';
import {
  ENTITY_WORK_GRAPH,
  ENTITY_WORK_NODE,
  WORK_GRAPH_UPDATED,
  WORK_NODE_UPDATED,
  writeOutboxEvent,
} from '@/lib/outbox';
import { safeCreateTaskNotification } from '@/lib/task-notifications';
import { syncTaskRunStateFromExecutionState } from '@/lib/task-run-state';
import {
  buildWorkGraphSummary,
  normalizeWorkNodeEvidenceKind,
  normalizeWorkNodeStatus,
  normalizeWorkNodeType,
  type WorkNodeEventType,
  type WorkNodeEvidenceKind,
  type WorkNodeStatus,
  type WorkNodeType,
} from '@/lib/work-graph';

const EVIDENCE_PAYLOAD_MAX_BYTES = 64 * 1024;
const WORKFLOW_MEMORY_APPEND_MAX_CHARS = 4000;
const WORKFLOW_MEMORY_MAX_CHARS = 64 * 1024;
const SECRET_FILE_PATTERN =
  /(^|[/\\\s'"`])(?:\.env(?:\.[\w.-]+)?|id_rsa|id_ed25519|[^/\\\s'"`]+\.(?:key|pem|p12|pfx))(?=$|[/\\\s'"`])/i;
const PRIVATE_KEY_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const TOKEN_PREFIX_PATTERN =
  /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|xox[baprs]-[A-Za-z0-9-]{16,}|preq_[A-Za-z0-9_-]{16,})\b/;
const USER_HOME_PATH_PATTERN = /(^|[\s'"`])\/(?:Users|home)\/[^/\\\s'"`]+(?=$|[/\\\s'"`])/g;

const TRANSITIONS: Record<WorkNodeStatus, WorkNodeStatus[]> = {
  pending: ['ready', 'running', 'cancelled'],
  ready: ['running', 'cancelled'],
  running: ['completed', 'failed', 'waiting_for_user', 'blocked', 'cancelled'],
  waiting_for_user: ['ready', 'running', 'completed', 'cancelled'],
  blocked: ['ready', 'failed', 'cancelled'],
  failed: ['ready', 'cancelled'],
  completed: [],
  cancelled: [],
};

export class WorkGraphServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'WorkGraphServiceError';
  }
}

type WorkGraphTask = {
  id: string;
  ownerId: string;
  projectId: string;
  taskKey: string;
  title: string;
  workflowMemory?: string | null;
};

export type CreateWorkNodeInput = {
  type: string;
  title: string;
  body?: string | null;
  status?: string | null;
  parentId?: string | null;
  runtimeTarget?: string | null;
  engine?: string | null;
  model?: string | null;
  actorKind?: string | null;
  actorLabel?: string | null;
  idempotencyKey?: string | null;
  sortOrder?: string | null;
  waitingReason?: string | null;
  decisionPrompt?: string | null;
  resultSummary?: string | null;
  metadata?: Record<string, unknown> | null;
  dependencyIds?: string[];
};

export type TransitionWorkNodeAction =
  | 'start'
  | 'complete'
  | 'fail'
  | 'cancel'
  | 'wait'
  | 'block'
  | 'ready';

export type EvidenceInput = {
  kind: string;
  title: string;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
  artifactUrl?: string | null;
};

function requireWorkNodeType(value: string): WorkNodeType {
  const type = normalizeWorkNodeType(value);
  if (!type) throw new WorkGraphServiceError('invalid_type', 'Invalid work node type.');
  return type;
}

function requireWorkNodeStatus(value: string): WorkNodeStatus {
  const status = normalizeWorkNodeStatus(value);
  if (!status) throw new WorkGraphServiceError('invalid_status', 'Invalid work node status.');
  return status;
}

function requireEvidenceKind(value: string): WorkNodeEvidenceKind {
  const kind = normalizeWorkNodeEvidenceKind(value);
  if (!kind) throw new WorkGraphServiceError('invalid_evidence_kind', 'Invalid evidence kind.');
  return kind;
}

async function findTaskOrThrow(params: { client: DbClientOrTx; ownerId: string; taskId: string }) {
  const task = await params.client.query.tasks.findFirst({
    where: and(eq(tasks.ownerId, params.ownerId), eq(tasks.id, params.taskId)),
    columns: {
      id: true,
      ownerId: true,
      projectId: true,
      taskKey: true,
      title: true,
      workflowMemory: true,
    },
  });

  if (!task) {
    throw new WorkGraphServiceError('not_found', 'Task not found.', 404);
  }

  return task;
}

function assertSameTaskNode(
  node: { taskId: string; projectId: string; ownerId: string },
  task: WorkGraphTask,
) {
  if (
    node.ownerId !== task.ownerId ||
    node.projectId !== task.projectId ||
    node.taskId !== task.id
  ) {
    throw new WorkGraphServiceError(
      'invalid_dependency',
      'Work graph nodes must belong to the same task.',
    );
  }
}

async function writeNodeEvent(params: {
  client: DbClientOrTx;
  task: WorkGraphTask;
  nodeId: string | null;
  eventType: WorkNodeEventType;
  message?: string | null;
  payload?: Record<string, unknown> | null;
  createdBy?: string | null;
}) {
  await params.client.insert(taskWorkNodeEvents).values({
    ownerId: params.task.ownerId,
    projectId: params.task.projectId,
    taskId: params.task.id,
    nodeId: params.nodeId,
    eventType: params.eventType,
    message: params.message ?? null,
    payload: params.payload ?? null,
    createdBy: params.createdBy ?? null,
  });
}

async function writeGraphOutbox(params: {
  client: DbClientOrTx;
  task: WorkGraphTask;
  nodeId?: string | null;
  payload?: Record<string, unknown>;
}) {
  await writeOutboxEvent({
    tx: params.client,
    ownerId: params.task.ownerId,
    projectId: params.task.projectId,
    eventType: params.nodeId ? WORK_NODE_UPDATED : WORK_GRAPH_UPDATED,
    entityType: params.nodeId ? ENTITY_WORK_NODE : ENTITY_WORK_GRAPH,
    entityId: params.nodeId ?? params.task.taskKey,
    payload: params.payload ?? {},
  });
}

export async function getWorkGraph({
  client = db,
  ownerId,
  taskId,
}: {
  client?: DbClientOrTx;
  ownerId: string;
  taskId: string;
}) {
  const task = await findTaskOrThrow({ client, ownerId, taskId });
  const [nodes, dependencies, events, evidence] = await Promise.all([
    client.query.taskWorkNodes.findMany({
      where: and(eq(taskWorkNodes.ownerId, ownerId), eq(taskWorkNodes.taskId, task.id)),
      orderBy: [taskWorkNodes.sortOrder],
    }),
    client.query.taskWorkNodeDependencies.findMany({
      where: and(
        eq(taskWorkNodeDependencies.ownerId, ownerId),
        eq(taskWorkNodeDependencies.taskId, task.id),
      ),
    }),
    client.query.taskWorkNodeEvents.findMany({
      where: and(eq(taskWorkNodeEvents.ownerId, ownerId), eq(taskWorkNodeEvents.taskId, task.id)),
      orderBy: [desc(taskWorkNodeEvents.createdAt)],
      limit: 50,
    }),
    client.query.taskWorkNodeEvidence.findMany({
      where: and(
        eq(taskWorkNodeEvidence.ownerId, ownerId),
        eq(taskWorkNodeEvidence.taskId, task.id),
      ),
      orderBy: [desc(taskWorkNodeEvidence.createdAt)],
      limit: 50,
    }),
  ]);

  return {
    task,
    summary: buildWorkGraphSummary(nodes),
    nodes,
    dependencies,
    events,
    evidence,
    workflow_memory: task.workflowMemory ?? null,
  };
}

export async function initializeWorkGraph({
  client = db,
  ownerId,
  taskId,
  actorLabel,
}: {
  client?: DbClientOrTx;
  ownerId: string;
  taskId: string;
  actorLabel?: string | null;
}) {
  const task = await findTaskOrThrow({ client, ownerId, taskId });
  const existing = await client.query.taskWorkNodes.findFirst({
    where: and(
      eq(taskWorkNodes.ownerId, ownerId),
      eq(taskWorkNodes.taskId, task.id),
      eq(taskWorkNodes.type, 'root'),
    ),
  });

  if (existing) return { node: existing, created: false };

  const [node] = await client
    .insert(taskWorkNodes)
    .values({
      ownerId,
      projectId: task.projectId,
      taskId: task.id,
      type: 'root',
      status: 'ready',
      title: task.title,
      actorLabel: actorLabel ?? null,
    })
    .returning();

  if (!node) throw new WorkGraphServiceError('insert_failed', 'Failed to initialize graph.', 500);

  await writeNodeEvent({
    client,
    task,
    nodeId: node.id,
    eventType: 'graph.initialized',
    createdBy: actorLabel,
  });
  await writeGraphOutbox({ client, task, nodeId: node.id, payload: { action: 'initialized' } });
  await syncTaskRunStateFromExecutionState({ client, ownerId, taskId: task.id });

  return { node, created: true };
}

export async function createWorkNode({
  client = db,
  ownerId,
  taskId,
  input,
}: {
  client?: DbClientOrTx;
  ownerId: string;
  taskId: string;
  input: CreateWorkNodeInput;
}) {
  const task = await findTaskOrThrow({ client, ownerId, taskId });
  const idempotencyKey = input.idempotencyKey?.trim() || null;

  if (idempotencyKey) {
    const existing = await client.query.taskWorkNodes.findFirst({
      where: and(
        eq(taskWorkNodes.ownerId, ownerId),
        eq(taskWorkNodes.idempotencyKey, idempotencyKey),
      ),
    });
    if (existing) return { node: existing, created: false };
  }

  const type = requireWorkNodeType(input.type);
  const status = requireWorkNodeStatus(input.status || 'pending');
  const title = input.title.trim();
  if (!title) throw new WorkGraphServiceError('invalid_title', 'Work node title is required.');

  if (input.parentId) {
    const parent = await client.query.taskWorkNodes.findFirst({
      where: and(eq(taskWorkNodes.ownerId, ownerId), eq(taskWorkNodes.id, input.parentId)),
      columns: { ownerId: true, projectId: true, taskId: true },
    });
    if (!parent) throw new WorkGraphServiceError('invalid_parent', 'Parent node not found.');
    assertSameTaskNode(parent, task);
  }

  const dependencyIds = [...new Set(input.dependencyIds ?? [])];
  if (dependencyIds.length > 0) {
    const dependencies = await client.query.taskWorkNodes.findMany({
      where: and(eq(taskWorkNodes.ownerId, ownerId), inArray(taskWorkNodes.id, dependencyIds)),
      columns: { id: true, ownerId: true, projectId: true, taskId: true },
    });
    if (dependencies.length !== dependencyIds.length) {
      throw new WorkGraphServiceError('invalid_dependency', 'Dependency node not found.');
    }
    for (const dependency of dependencies) {
      assertSameTaskNode(dependency, task);
    }
  }

  const [node] = await client
    .insert(taskWorkNodes)
    .values({
      ownerId,
      projectId: task.projectId,
      taskId: task.id,
      parentId: input.parentId ?? null,
      type,
      status,
      title,
      body: input.body ?? null,
      runtimeTarget: input.runtimeTarget ?? null,
      engine: input.engine ?? null,
      model: input.model ?? null,
      actorKind: input.actorKind || 'runtime',
      actorLabel: input.actorLabel ?? null,
      idempotencyKey,
      sortOrder: input.sortOrder || 'a0',
      waitingReason: input.waitingReason ?? null,
      decisionPrompt: input.decisionPrompt ?? null,
      resultSummary: input.resultSummary ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();

  if (!node) throw new WorkGraphServiceError('insert_failed', 'Failed to create work node.', 500);

  for (const dependencyId of dependencyIds) {
    await client.insert(taskWorkNodeDependencies).values({
      ownerId,
      taskId: task.id,
      nodeId: node.id,
      dependsOnNodeId: dependencyId,
    });
  }

  await writeNodeEvent({
    client,
    task,
    nodeId: node.id,
    eventType: 'node.created',
    payload: { type, status },
    createdBy: input.actorLabel,
  });
  await writeGraphOutbox({ client, task, nodeId: node.id, payload: { action: 'created', status } });
  await syncTaskRunStateFromExecutionState({ client, ownerId, taskId: task.id });

  return { node, created: true };
}

function transitionToStatus(action: TransitionWorkNodeAction): {
  status: WorkNodeStatus;
  eventType: WorkNodeEventType;
} {
  if (action === 'start') return { status: 'running', eventType: 'node.started' };
  if (action === 'complete') return { status: 'completed', eventType: 'node.completed' };
  if (action === 'fail') return { status: 'failed', eventType: 'node.failed' };
  if (action === 'cancel') return { status: 'cancelled', eventType: 'node.cancelled' };
  if (action === 'wait') return { status: 'waiting_for_user', eventType: 'node.waiting_for_user' };
  if (action === 'block') return { status: 'blocked', eventType: 'node.waiting_for_user' };
  return { status: 'ready', eventType: 'node.started' };
}

function shouldCreateAttentionNotification(params: {
  type: string;
  status: WorkNodeStatus;
  action: TransitionWorkNodeAction;
}) {
  if (params.status === 'waiting_for_user' || params.status === 'failed') return true;
  if (params.type === 'approval' && (params.status === 'ready' || params.action === 'wait'))
    return true;
  return false;
}

export async function transitionWorkNode({
  client = db,
  ownerId,
  nodeId,
  action,
  resultSummary,
  waitingReason,
  decisionPrompt,
  metadata,
  actorLabel,
  now = new Date(),
}: {
  client?: DbClientOrTx;
  ownerId: string;
  nodeId: string;
  action: TransitionWorkNodeAction;
  resultSummary?: string | null;
  waitingReason?: string | null;
  decisionPrompt?: string | null;
  metadata?: Record<string, unknown> | null;
  actorLabel?: string | null;
  now?: Date;
}) {
  const existing = await client.query.taskWorkNodes.findFirst({
    where: and(eq(taskWorkNodes.ownerId, ownerId), eq(taskWorkNodes.id, nodeId)),
  });
  if (!existing) throw new WorkGraphServiceError('not_found', 'Work node not found.', 404);

  const currentStatus = requireWorkNodeStatus(existing.status);
  const { status, eventType } = transitionToStatus(action);
  if (!TRANSITIONS[currentStatus].includes(status)) {
    throw new WorkGraphServiceError(
      'conflict',
      `Cannot transition work node from ${currentStatus} to ${status}.`,
      409,
    );
  }

  const [node] = await client
    .update(taskWorkNodes)
    .set({
      status,
      startedAt: status === 'running' && !existing.startedAt ? now : existing.startedAt,
      completedAt:
        status === 'completed' || status === 'cancelled' ? now : (existing.completedAt ?? null),
      failedAt: status === 'failed' ? now : (existing.failedAt ?? null),
      waitingReason: waitingReason ?? existing.waitingReason ?? null,
      decisionPrompt: decisionPrompt ?? existing.decisionPrompt ?? null,
      resultSummary: resultSummary ?? existing.resultSummary ?? null,
      metadata: metadata ?? existing.metadata ?? null,
      updatedAt: now,
    })
    .where(
      and(
        eq(taskWorkNodes.ownerId, ownerId),
        eq(taskWorkNodes.id, nodeId),
        eq(taskWorkNodes.status, currentStatus),
      ),
    )
    .returning();

  if (!node) {
    throw new WorkGraphServiceError(
      'conflict',
      `Cannot transition work node from ${currentStatus} to ${status}.`,
      409,
      { expectedStatus: currentStatus, status },
    );
  }

  const task: WorkGraphTask = {
    id: existing.taskId,
    ownerId: existing.ownerId,
    projectId: existing.projectId,
    taskKey: existing.taskId,
    title: existing.title,
  };
  const taskRow = await client.query.tasks.findFirst({
    where: and(eq(tasks.ownerId, ownerId), eq(tasks.id, existing.taskId)),
    columns: { id: true, ownerId: true, projectId: true, taskKey: true, title: true },
  });
  const eventTask = taskRow ?? task;

  await writeNodeEvent({
    client,
    task: eventTask,
    nodeId,
    eventType,
    message: waitingReason ?? resultSummary ?? null,
    payload: { action, status },
    createdBy: actorLabel,
  });
  await writeGraphOutbox({
    client,
    task: eventTask,
    nodeId,
    payload: { action, previousStatus: currentStatus, status },
  });
  if (shouldCreateAttentionNotification({ type: existing.type, status, action })) {
    await safeCreateTaskNotification({
      tx: client,
      ownerId: eventTask.ownerId,
      projectId: eventTask.projectId,
      taskId: eventTask.id,
      taskKey: eventTask.taskKey,
      taskTitle: eventTask.title,
      statusFrom: `node:${currentStatus}`,
      statusTo: `node:${status}`,
      now,
    });
  }
  await syncTaskRunStateFromExecutionState({ client, ownerId, taskId: existing.taskId, now });

  return node;
}

function isMaskedSecret(value: string) {
  return /\*{3,}|<redacted>|redacted|REDACTED/.test(value);
}

function assertSafeEvidenceValue(value: unknown, path = 'evidence') {
  if (typeof value === 'string') {
    if (isMaskedSecret(value)) return;
    if (
      SECRET_FILE_PATTERN.test(value) ||
      PRIVATE_KEY_PATTERN.test(value) ||
      TOKEN_PREFIX_PATTERN.test(value)
    ) {
      throw new WorkGraphServiceError(
        'unsafe_evidence',
        'Evidence contains private file or token material.',
        400,
        { path },
      );
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeEvidenceValue(item, `${path}[${index}]`));
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value)) {
      assertSafeEvidenceValue(nestedValue, `${path}.${key}`);
    }
  }
}

export function redactEvidenceValue<T>(value: T): T {
  const home = os.homedir();
  if (typeof value === 'string') {
    const redactedCurrentHome = home.length > 1 ? value.replaceAll(home, '~') : value;
    return redactedCurrentHome.replace(USER_HOME_PATH_PATTERN, '$1~') as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactEvidenceValue(item)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, redactEvidenceValue(nestedValue)]),
    ) as T;
  }
  return value;
}

export function validateEvidencePayloadSize(payload: unknown) {
  const size = Buffer.byteLength(JSON.stringify(payload ?? null), 'utf8');
  if (size > EVIDENCE_PAYLOAD_MAX_BYTES) {
    throw new WorkGraphServiceError(
      'payload_too_large',
      'Inline evidence payload exceeds 64 KB.',
      413,
      { maxBytes: EVIDENCE_PAYLOAD_MAX_BYTES, size },
    );
  }
}

export async function attachWorkNodeEvidence({
  client = db,
  ownerId,
  nodeId,
  input,
  actorLabel,
}: {
  client?: DbClientOrTx;
  ownerId: string;
  nodeId: string;
  input: EvidenceInput;
  actorLabel?: string | null;
}) {
  const node = await client.query.taskWorkNodes.findFirst({
    where: and(eq(taskWorkNodes.ownerId, ownerId), eq(taskWorkNodes.id, nodeId)),
  });
  if (!node) throw new WorkGraphServiceError('not_found', 'Work node not found.', 404);

  const kind = requireEvidenceKind(input.kind);
  const title = input.title.trim();
  if (!title || title.length > 160) {
    throw new WorkGraphServiceError('invalid_title', 'Evidence title must be 1-160 characters.');
  }
  if ((input.summary?.length ?? 0) > 4000) {
    throw new WorkGraphServiceError('summary_too_large', 'Evidence summary exceeds 4,000 chars.');
  }
  assertSafeEvidenceValue(input.summary ?? null, 'summary');
  assertSafeEvidenceValue(input.payload ?? null, 'payload');
  assertSafeEvidenceValue(input.artifactUrl ?? null, 'artifactUrl');

  const payload = redactEvidenceValue(input.payload ?? null);
  validateEvidencePayloadSize(payload);

  const [evidence] = await client
    .insert(taskWorkNodeEvidence)
    .values({
      ownerId,
      projectId: node.projectId,
      taskId: node.taskId,
      nodeId,
      kind,
      title,
      summary: input.summary ? redactEvidenceValue(input.summary) : null,
      payload,
      artifactUrl: input.artifactUrl ? redactEvidenceValue(input.artifactUrl) : null,
    })
    .returning();

  const task = await findTaskOrThrow({ client, ownerId, taskId: node.taskId });
  await writeNodeEvent({
    client,
    task,
    nodeId,
    eventType: 'node.evidence.attached',
    payload: { evidenceId: evidence?.id, kind },
    createdBy: actorLabel,
  });
  await writeGraphOutbox({ client, task, nodeId, payload: { action: 'evidence_attached', kind } });

  return evidence;
}

export async function appendWorkflowMemory({
  client = db,
  ownerId,
  taskId,
  appendMarkdown,
  actorLabel,
  now = new Date(),
}: {
  client?: DbClientOrTx;
  ownerId: string;
  taskId: string;
  appendMarkdown: string;
  actorLabel?: string | null;
  now?: Date;
}) {
  const task = await findTaskOrThrow({ client, ownerId, taskId });
  const append = appendMarkdown.trim();
  if (!append) throw new WorkGraphServiceError('invalid_memory', 'Workflow memory is required.');
  if (append.length > WORKFLOW_MEMORY_APPEND_MAX_CHARS) {
    throw new WorkGraphServiceError(
      'memory_append_too_large',
      'Memory append exceeds 4,000 chars.',
    );
  }

  const nextMemory = [task.workflowMemory?.trim(), append].filter(Boolean).join('\n\n');
  if (nextMemory.length > WORKFLOW_MEMORY_MAX_CHARS) {
    throw new WorkGraphServiceError('memory_too_large', 'Workflow memory exceeds 64 KB.', 413);
  }

  const [updated] = await client
    .update(tasks)
    .set({ workflowMemory: nextMemory, workflowMemoryUpdatedAt: now })
    .where(and(eq(tasks.ownerId, ownerId), eq(tasks.id, task.id)))
    .returning();

  await writeNodeEvent({
    client,
    task,
    nodeId: null,
    eventType: 'workflow_memory.appended',
    createdBy: actorLabel,
  });
  await writeGraphOutbox({ client, task, payload: { action: 'workflow_memory.appended' } });

  return updated;
}
