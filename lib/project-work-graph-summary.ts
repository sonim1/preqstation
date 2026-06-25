type ProjectWorkGraphTaskRef = {
  taskKey: string | null;
  title: string | null;
  status?: string | null;
};

export type ProjectWorkGraphNodeRow = {
  id: string;
  taskId: string;
  type: string | null;
  status: string | null;
  title: string | null;
  resultSummary: string | null;
  updatedAt: Date | string | null;
  task?: ProjectWorkGraphTaskRef | null;
};

export type ProjectKnowledgeProposalRow = {
  id: string;
  taskId: string;
  status: string | null;
  target: string | null;
  body: string | null;
  createdAt: Date | string | null;
  task?: Pick<ProjectWorkGraphTaskRef, 'taskKey' | 'title'> | null;
};

export type ProjectWorkGraphNodeSummary = {
  id: string;
  taskKey: string | null;
  taskTitle: string | null;
  title: string | null;
  status: string | null;
  summary?: string | null;
};

export type ProjectKnowledgeProposalSummary = {
  id: string;
  taskKey: string | null;
  taskTitle: string | null;
  target: string | null;
  body: string | null;
};

export type ProjectWorkGraphSummary = {
  counts: {
    activeRoots: number;
    waitingDecisions: number;
    failedNodes: number;
    blockedNodes: number;
    recentResults: number;
    pendingProposals: number;
  };
  activeRoots: ProjectWorkGraphNodeSummary[];
  waitingDecisions: ProjectWorkGraphNodeSummary[];
  failedNodes: ProjectWorkGraphNodeSummary[];
  blockedNodes: ProjectWorkGraphNodeSummary[];
  recentResults: ProjectWorkGraphNodeSummary[];
  pendingProposals: ProjectKnowledgeProposalSummary[];
};

const ACTIVE_ROOT_STATUSES = new Set(['ready', 'running', 'waiting_for_user', 'blocked', 'failed']);
const LIMIT = 5;

function toTime(value: Date | string | null | undefined) {
  if (!value) return 0;
  const parsed = value instanceof Date ? value : new Date(value);
  const time = parsed.getTime();
  return Number.isFinite(time) ? time : 0;
}

function byRecentUpdatedAt(left: ProjectWorkGraphNodeRow, right: ProjectWorkGraphNodeRow) {
  return toTime(right.updatedAt) - toTime(left.updatedAt);
}

function byRecentCreatedAt(
  left: ProjectKnowledgeProposalRow,
  right: ProjectKnowledgeProposalRow,
) {
  return toTime(right.createdAt) - toTime(left.createdAt);
}

function nodeSummary(node: ProjectWorkGraphNodeRow): ProjectWorkGraphNodeSummary {
  return {
    id: node.id,
    taskKey: node.task?.taskKey ?? null,
    taskTitle: node.task?.title ?? null,
    title: node.title,
    status: node.status,
    summary: node.resultSummary,
  };
}

function proposalSummary(
  proposal: ProjectKnowledgeProposalRow,
): ProjectKnowledgeProposalSummary {
  return {
    id: proposal.id,
    taskKey: proposal.task?.taskKey ?? null,
    taskTitle: proposal.task?.title ?? null,
    target: proposal.target,
    body: proposal.body,
  };
}

export function buildProjectWorkGraphSummary({
  nodes,
  proposals,
}: {
  nodes: ProjectWorkGraphNodeRow[];
  proposals: ProjectKnowledgeProposalRow[];
}): ProjectWorkGraphSummary {
  const recentNodes = [...nodes].sort(byRecentUpdatedAt);
  const pendingProposals = proposals
    .filter((proposal) => proposal.status === 'pending')
    .sort(byRecentCreatedAt);

  const activeRoots = recentNodes.filter(
    (node) => node.type === 'root' && ACTIVE_ROOT_STATUSES.has(node.status ?? ''),
  );
  const waitingDecisions = recentNodes.filter(
    (node) => node.status === 'waiting_for_user' || node.type === 'approval',
  );
  const failedNodes = recentNodes.filter((node) => node.status === 'failed');
  const blockedNodes = recentNodes.filter((node) => node.status === 'blocked');
  const recentResults = recentNodes.filter(
    (node) => node.status === 'completed' && Boolean(node.resultSummary),
  );

  return {
    counts: {
      activeRoots: activeRoots.length,
      waitingDecisions: waitingDecisions.length,
      failedNodes: failedNodes.length,
      blockedNodes: blockedNodes.length,
      recentResults: recentResults.length,
      pendingProposals: pendingProposals.length,
    },
    activeRoots: activeRoots.slice(0, LIMIT).map(nodeSummary),
    waitingDecisions: waitingDecisions.slice(0, LIMIT).map(nodeSummary),
    failedNodes: failedNodes.slice(0, LIMIT).map(nodeSummary),
    blockedNodes: blockedNodes.slice(0, LIMIT).map(nodeSummary),
    recentResults: recentResults.slice(0, LIMIT).map(nodeSummary),
    pendingProposals: pendingProposals.slice(0, LIMIT).map(proposalSummary),
  };
}
