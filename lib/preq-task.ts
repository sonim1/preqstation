import anyAscii from 'any-ascii';
import { and, asc, eq, ilike, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { projects, taskLabels } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';
import { getEngineConfig } from '@/lib/engine-icons';
import {
  type ProjectSettingEntry,
  resolveAgentInstructions,
  resolveDeployStrategyConfig,
} from '@/lib/project-settings';
import { normalizeTaskDispatchTarget } from '@/lib/task-dispatch';
import { isTaskStatus, parseTaskPriority, TASK_STATUSES, type TaskRunState } from '@/lib/task-meta';

export const PREQ_TASK_STATUSES = TASK_STATUSES;

export type PreqTaskStatus = (typeof PREQ_TASK_STATUSES)[number];

export type PreqSerializableTask = {
  id: string;
  taskKey: string;
  taskPrefix: string;
  taskNumber: number;
  title: string;
  note: string | null;
  status: string;
  taskPriority: string;
  branch: string | null;
  engine: string | null;
  dispatchTarget?: string | null;
  runState?: TaskRunState | null;
  runStateUpdatedAt?: Date | null;
  latestPreqResult?: {
    title: string;
    summary: string | null;
    blocked_reason: string | null;
    worked_at: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  project: { repoUrl: string | null; settings?: ProjectSettingEntry[] } | null;
  labels: Array<{ name: string }>;
};

export function toInternalTaskStatus(status: PreqTaskStatus | undefined) {
  if (!status) return undefined;
  return isTaskStatus(status) ? status : undefined;
}

export function toPreqTaskStatus(status: string) {
  if (isTaskStatus(status)) return status;
  return 'todo';
}

export function toPreqTaskRunState(runState: TaskRunState | null | undefined) {
  if (runState === 'queued') return 'queued';
  if (runState === 'running') return 'working';
  return null;
}

export function toPreqTaskDispatchTarget(dispatchTarget: string | null | undefined) {
  return normalizeTaskDispatchTarget(dispatchTarget);
}

export function parseAcceptanceCriteria(note: string | null) {
  if (!note) return [];
  const lines = note.split(/\r?\n/);
  const parsed: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\s*-\s*\[(?: |x|X)\]\s+(.+)$/);
    if (match && match[1]) parsed.push(match[1].trim());
  }
  return parsed;
}

export function buildTaskNote(description?: string, acceptanceCriteria?: string[]) {
  const sections: string[] = [];
  const normalizedDescription = (description || '').trim();
  if (normalizedDescription) {
    sections.push(normalizedDescription);
  }

  const items = (acceptanceCriteria || []).map((item) => item.trim()).filter(Boolean);
  if (items.length > 0) {
    sections.push('## Acceptance Criteria', ...items.map((item) => `- [ ] ${item}`));
  }

  return sections.join('\n\n').trim() || null;
}

export function normalizeTaskPriority(value: string | undefined) {
  const normalized = (value || '').trim().toLowerCase();
  return parseTaskPriority(normalized || 'none');
}

export async function resolveProjectByRepo(
  ownerId: string,
  repo: string | null | undefined,
  client: DbClientOrTx = db,
) {
  const normalizedRepo = (repo || '').trim();
  if (!normalizedRepo) return null;

  const project = await client.query.projects.findFirst({
    where: and(
      eq(projects.ownerId, ownerId),
      isNull(projects.deletedAt),
      eq(projects.repoUrl, normalizedRepo),
    ),
    columns: { id: true, name: true, projectKey: true },
  });

  return project ? { id: project.id, name: project.name, projectKey: project.projectKey } : null;
}

export async function resolveOrCreateLabelId(
  ownerId: string,
  projectId: string,
  labelName: string | null,
  client: DbClientOrTx = db,
) {
  if (!labelName) return null;
  const trimmed = labelName.trim();
  if (!trimmed) return null;

  const existing = await client.query.taskLabels.findFirst({
    where: and(
      eq(taskLabels.ownerId, ownerId),
      eq(taskLabels.projectId, projectId),
      ilike(taskLabels.name, trimmed),
    ),
    columns: { id: true },
  });
  if (existing) return existing.id;

  const [created] = await client
    .insert(taskLabels)
    .values({
      ownerId,
      projectId,
      name: trimmed,
      color: 'blue',
    })
    .returning({ id: taskLabels.id });

  return created.id;
}

export async function fetchAvailableLabels(
  ownerId: string,
  projectId: string | null | undefined,
  client: DbClientOrTx = db,
) {
  if (!projectId) return [];

  const labels = await client.query.taskLabels.findMany({
    where: and(eq(taskLabels.ownerId, ownerId), eq(taskLabels.projectId, projectId)),
    orderBy: asc(taskLabels.name),
    columns: { name: true, color: true },
  });
  return labels.map((l) => ({ name: l.name, color: l.color }));
}

export function firstTaskLabel(labels: string[] | undefined) {
  if (!labels) return undefined;
  const label = labels[0]?.trim() || '';
  return label || null;
}

export function normalizePreqTaskLabelNames(labels: string[] | undefined) {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const label of labels || []) {
    const trimmed = label.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

export function serializePreqTask(task: PreqSerializableTask, ownerEmail: string) {
  const deployStrategy = resolveDeployStrategyConfig(task.project?.settings);
  const agentInstructions = resolveAgentInstructions(task.project?.settings);
  return {
    id: task.taskKey,
    uuid: task.id,
    task_key: task.taskKey,
    task_prefix: task.taskPrefix,
    task_number: task.taskNumber,
    title: task.title,
    description: task.note,
    status: toPreqTaskStatus(task.status),
    priority: parseTaskPriority(task.taskPriority),
    assignee: ownerEmail.split('@')[0] || ownerEmail,
    repo: task.project?.repoUrl ?? null,
    branch: task.branch ?? null,
    labels: task.labels.map((label) => label.name),
    acceptance_criteria: parseAcceptanceCriteria(task.note),
    engine: task.engine ?? null,
    dispatch_target: toPreqTaskDispatchTarget(task.dispatchTarget),
    run_state: toPreqTaskRunState(task.runState),
    run_state_updated_at: task.runStateUpdatedAt?.toISOString() ?? null,
    latest_preq_result: task.latestPreqResult ?? null,
    agent_instructions: agentInstructions,
    deploy_strategy: deployStrategy,
    result: null,
    created_at: task.createdAt.toISOString(),
    updated_at: task.updatedAt.toISOString(),
  };
}

export function generateBranchName(taskKey: string, title: string): string {
  const slug = anyAscii(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
  return `task/${taskKey.toLowerCase()}/${slug}`;
}

export function renderResultWorkLogDetail(params: {
  taskId: string;
  title: string;
  result: Record<string, unknown>;
  tokenName: string;
  engine?: string | null;
}) {
  const r = params.result;
  const summary = typeof r.summary === 'string' ? r.summary : '';
  const tests = typeof r.tests === 'string' ? r.tests : '';
  const prUrl = typeof r.pr_url === 'string' ? r.pr_url : '';
  const notes = typeof r.notes === 'string' ? r.notes : '';
  const reason = typeof r.reason === 'string' ? r.reason : '';
  const blockedAt = typeof r.blocked_at === 'string' ? r.blocked_at : '';
  const completedAt = typeof r.completed_at === 'string' ? r.completed_at : '';

  const sections: string[] = [`**${params.taskId}** · ${params.title}`];

  if (summary) {
    sections.push('', summary);
  }

  if (reason) {
    sections.push('', `**Blocked reason:** ${reason}`);
  }

  if (tests) {
    sections.push('', `**Tests:** ${tests}`);
  }

  if (prUrl) {
    sections.push('', `**PR:** ${prUrl}`);
  }

  if (notes) {
    sections.push('', `**Notes:** ${notes}`);
  }

  const footerItems: string[] = [];
  const engineKey = params.engine || (typeof r.engine === 'string' ? r.engine : null);
  const engineConfig = getEngineConfig(engineKey);
  if (engineConfig) {
    footerItems.push(`Engine: ${engineConfig.label}`);
  }
  if (blockedAt) {
    footerItems.push(`Blocked: ${blockedAt}`);
  }
  if (completedAt) {
    footerItems.push(`Completed: ${completedAt}`);
  }
  footerItems.push(`Source: ${params.tokenName}`);

  sections.push('', '---', '', footerItems.join(' · '));

  return sections.join('\n');
}

export function extractLatestPreqResultMeta(log: {
  title: string;
  detail: string | null;
  workedAt: Date;
}) {
  const detail = (log.detail || '').trim();
  if (!detail) {
    return {
      title: log.title,
      summary: null,
      blocked_reason: null,
      worked_at: log.workedAt.toISOString(),
    };
  }

  const lines = detail.split(/\r?\n/);
  const bodyLines = lines[0]?.startsWith('**') ? lines.slice(1) : lines.slice();
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];
  let blockedReason: string | null = null;

  const flushParagraph = () => {
    if (currentParagraph.length === 0) return;
    paragraphs.push(currentParagraph.join('\n').trim());
    currentParagraph = [];
  };

  for (const rawLine of bodyLines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    if (line === '---') {
      flushParagraph();
      break;
    }
    const blockedReasonMatch = line.match(/^\*\*Blocked reason:\*\*\s*(.+)$/);
    if (blockedReasonMatch) {
      blockedReason = blockedReasonMatch[1]?.trim() || null;
      flushParagraph();
      continue;
    }
    if (/^\*\*(Tests|PR|Notes):\*\*/.test(line)) {
      flushParagraph();
      continue;
    }
    currentParagraph.push(rawLine);
  }
  flushParagraph();

  return {
    title: log.title,
    summary: paragraphs[0] || null,
    blocked_reason: blockedReason,
    worked_at: log.workedAt.toISOString(),
  };
}
