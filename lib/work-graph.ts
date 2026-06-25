export const WORK_NODE_TYPES = [
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
] as const;

export const WORK_NODE_STATUSES = [
  'pending',
  'ready',
  'running',
  'waiting_for_user',
  'blocked',
  'completed',
  'failed',
  'cancelled',
] as const;

export const WORK_NODE_EVENT_TYPES = [
  'graph.initialized',
  'node.created',
  'node.started',
  'node.completed',
  'node.failed',
  'node.cancelled',
  'node.waiting_for_user',
  'node.evidence.attached',
  'workflow_memory.appended',
] as const;

export const WORK_NODE_EVIDENCE_KINDS = [
  'command',
  'test',
  'log',
  'changed_file',
  'screenshot',
  'artifact',
  'pull_request',
  'deployment',
  'summary',
  'error',
] as const;

export type WorkNodeType = (typeof WORK_NODE_TYPES)[number];
export type WorkNodeStatus = (typeof WORK_NODE_STATUSES)[number];
export type WorkNodeEventType = (typeof WORK_NODE_EVENT_TYPES)[number];
export type WorkNodeEvidenceKind = (typeof WORK_NODE_EVIDENCE_KINDS)[number];

export type WorkGraphSummary = {
  running_count: number;
  ready_count: number;
  waiting_count: number;
  blocked_count: number;
  failed_count: number;
  completed_count: number;
  root_overlay: 'running' | 'ready' | 'waiting_for_user' | 'blocked' | 'failed' | null;
};

export function normalizeWorkNodeType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? '';
  return WORK_NODE_TYPES.includes(normalized as WorkNodeType) ? (normalized as WorkNodeType) : null;
}

export function normalizeWorkNodeStatus(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? '';
  return WORK_NODE_STATUSES.includes(normalized as WorkNodeStatus)
    ? (normalized as WorkNodeStatus)
    : null;
}

export function normalizeWorkNodeEvidenceKind(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? '';
  return WORK_NODE_EVIDENCE_KINDS.includes(normalized as WorkNodeEvidenceKind)
    ? (normalized as WorkNodeEvidenceKind)
    : null;
}

export function buildWorkGraphSummary(
  nodes: Array<{ status: string | null }>,
): WorkGraphSummary {
  const counts = {
    running_count: 0,
    ready_count: 0,
    waiting_count: 0,
    blocked_count: 0,
    failed_count: 0,
    completed_count: 0,
  };

  for (const node of nodes) {
    if (node.status === 'running') counts.running_count += 1;
    if (node.status === 'ready') counts.ready_count += 1;
    if (node.status === 'waiting_for_user') counts.waiting_count += 1;
    if (node.status === 'blocked') counts.blocked_count += 1;
    if (node.status === 'failed') counts.failed_count += 1;
    if (node.status === 'completed') counts.completed_count += 1;
  }

  const root_overlay =
    counts.failed_count > 0
      ? 'failed'
      : counts.blocked_count > 0
        ? 'blocked'
        : counts.waiting_count > 0
          ? 'waiting_for_user'
          : counts.running_count > 0
            ? 'running'
            : counts.ready_count > 0
              ? 'ready'
              : null;

  return { ...counts, root_overlay };
}
