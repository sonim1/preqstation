import type { BoardTaskStatus, TaskStatus } from '@/lib/task-meta';

type TaskTerminology = {
  singular: string;
  singularLower: string;
  plural: string;
  pluralLower: string;
};

type AgentTerminology = {
  entityType?: string;
  singular?: string;
  singularLower?: string;
  plural: string;
  pluralLower: string;
  runStateAttributes?: Record<AgentRunState, string>;
  runStates?: Record<AgentRunState, string>;
};

type AgentRunState = 'running';

type ProjectDetailTerminology = {
  setupItems: {
    repository: string;
    agentInstructions: string;
    recentActivity: string;
  };
  readiness: {
    sectionTitle: string;
    tableLabel: string;
    badges: {
      dispatchReady: string;
      setupMissing: string;
      needsAttention: string;
    };
    readySummary: string;
    summaryPrefix: string;
    summaryNextPrefix: string;
    rows: {
      repository: {
        label: string;
        connectedStatus: string;
        missingStatus: string;
        connectedDescription: string;
        missingDescription: string;
      };
      deployment: {
        label: string;
      };
      instructions: {
        label: string;
        configuredStatus: string;
        missingStatus: string;
        configuredDescription: string;
        missingDescription: string;
      };
      activity: {
        label: string;
        noWorkLogsStatus: string;
      };
    };
  };
  deployStrategies: {
    direct_commit: string;
    feature_branch: string;
  };
  deployCopy: {
    toBranch: string;
    autoCreatePr: string;
    pushBeforeReview: string;
    reviewBeforePush: string;
  };
  recentActivity: {
    noWorkLogsYet: string;
    lastProjectUpdate: string;
    unknownDate: string;
    staleWorkLog: string;
    lastRecordedWork: string;
  };
};

type ProjectEditTerminology = {
  labelsTitle: string;
  labelsDescription: string;
};

type WorkLogTerminology = {
  loadingMoreLabel: string;
};

export type Terminology = {
  task: TaskTerminology;
  agents: AgentTerminology;
  statuses: Record<TaskStatus, string>;
  boardStatuses: Record<BoardTaskStatus, string>;
  projectDetail?: ProjectDetailTerminology;
  projectEdit?: ProjectEditTerminology;
  workLogs?: WorkLogTerminology;
};

const DEFAULT_AGENT_RUN_STATES: Record<AgentRunState, string> = {
  running: 'running',
};

const DEFAULT_AGENT_RUN_STATE_ATTRIBUTES: Record<AgentRunState, string> = {
  running: 'running',
};

const DEFAULT_PROJECT_DETAIL_TERMINOLOGY: ProjectDetailTerminology = {
  setupItems: {
    repository: 'repository',
    agentInstructions: 'agent instructions',
    recentActivity: 'recent activity',
  },
  readiness: {
    sectionTitle: 'Dispatch readiness',
    tableLabel: 'Dispatch readiness checks',
    badges: {
      dispatchReady: 'Dispatch-ready',
      setupMissing: 'Setup missing',
      needsAttention: 'Needs attention',
    },
    readySummary:
      '4 of 4 setup checks are ready. Repo, deploy rules, agent instructions, and recent activity are all visible.',
    summaryPrefix: 'setup checks are ready.',
    summaryNextPrefix: 'Next:',
    rows: {
      repository: {
        label: 'Repository',
        connectedStatus: 'Repository connected',
        missingStatus: 'Repository missing',
        connectedDescription: 'Repository linked for branch and PR work.',
        missingDescription:
          'Add the repository URL in Edit Details before dispatching coding work.',
      },
      deployment: {
        label: 'Deployment',
      },
      instructions: {
        label: 'Instructions',
        configuredStatus: 'Agent instructions configured',
        missingStatus: 'Agent instructions missing',
        configuredDescription: 'Instructions saved for dispatched agents.',
        missingDescription: 'Add agent instructions so workers inherit project-specific rules.',
      },
      activity: {
        label: 'Activity',
        noWorkLogsStatus: 'No work logs',
      },
    },
  },
  deployStrategies: {
    direct_commit: 'Direct Commit',
    feature_branch: 'Feature Branch',
  },
  deployCopy: {
    toBranch: 'to',
    autoCreatePr: 'Auto-create a PR and',
    pushBeforeReview: 'Push before review.',
    reviewBeforePush: 'Review can happen before push.',
  },
  recentActivity: {
    noWorkLogsYet: 'No work logs yet.',
    lastProjectUpdate: 'Last project update',
    unknownDate: 'unknown',
    staleWorkLog: 'No work log update in over 7 days.',
    lastRecordedWork: 'Last recorded work on',
  },
};

const KITCHEN_PROJECT_DETAIL_TERMINOLOGY: ProjectDetailTerminology = {
  ...DEFAULT_PROJECT_DETAIL_TERMINOLOGY,
  setupItems: {
    ...DEFAULT_PROJECT_DETAIL_TERMINOLOGY.setupItems,
    agentInstructions: 'line cook instructions',
  },
  readiness: {
    ...DEFAULT_PROJECT_DETAIL_TERMINOLOGY.readiness,
    readySummary:
      '4 of 4 setup checks are ready. Repo, deploy rules, line cook instructions, and recent activity are all visible.',
    rows: {
      ...DEFAULT_PROJECT_DETAIL_TERMINOLOGY.readiness.rows,
      instructions: {
        ...DEFAULT_PROJECT_DETAIL_TERMINOLOGY.readiness.rows.instructions,
        configuredStatus: 'Line cook instructions configured',
        missingStatus: 'Line cook instructions missing',
        configuredDescription: 'Instructions saved for dispatched line cooks.',
        missingDescription: 'Add line cook instructions so workers inherit project-specific rules.',
      },
    },
  },
};

const DEFAULT_PROJECT_EDIT_TERMINOLOGY: ProjectEditTerminology = {
  labelsTitle: 'Labels',
  labelsDescription: 'Create, rename, recolor, or remove labels for this project.',
};

const DEFAULT_WORK_LOG_TERMINOLOGY: WorkLogTerminology = {
  loadingMoreLabel: 'Loading more work logs...',
};

export const DEFAULT_TERMINOLOGY: Terminology = {
  task: {
    singular: 'Task',
    singularLower: 'task',
    plural: 'Tasks',
    pluralLower: 'tasks',
  },
  agents: {
    entityType: 'agent',
    singular: 'AI agent',
    singularLower: 'AI agent',
    plural: 'AI agents',
    pluralLower: 'AI agents',
    runStateAttributes: DEFAULT_AGENT_RUN_STATE_ATTRIBUTES,
    runStates: DEFAULT_AGENT_RUN_STATES,
  },
  statuses: {
    inbox: 'Inbox',
    todo: 'Todo',
    hold: 'Hold',
    ready: 'Ready',
    done: 'Done',
    archived: 'Archived',
  },
  boardStatuses: {
    inbox: 'Inbox',
    todo: 'Planned',
    hold: 'Hold',
    ready: 'Ready',
    done: 'Done',
  },
  projectDetail: DEFAULT_PROJECT_DETAIL_TERMINOLOGY,
  projectEdit: DEFAULT_PROJECT_EDIT_TERMINOLOGY,
  workLogs: DEFAULT_WORK_LOG_TERMINOLOGY,
};

export const KITCHEN_TERMINOLOGY: Terminology = {
  task: {
    singular: 'Ticket',
    singularLower: 'ticket',
    plural: 'Tickets',
    pluralLower: 'tickets',
  },
  agents: {
    entityType: 'agent',
    singular: 'Line Cook',
    singularLower: 'line cook',
    plural: 'Line Cooks',
    pluralLower: 'line cooks',
    runStateAttributes: DEFAULT_AGENT_RUN_STATE_ATTRIBUTES,
    runStates: DEFAULT_AGENT_RUN_STATES,
  },
  statuses: {
    inbox: 'Inbox',
    todo: 'Todo',
    hold: "86'd",
    ready: 'Pass',
    done: 'Order Up',
    archived: 'Archived',
  },
  boardStatuses: {
    inbox: 'Inbox',
    todo: 'Planned',
    hold: "86'd",
    ready: 'Pass',
    done: 'Order Up',
  },
  projectDetail: KITCHEN_PROJECT_DETAIL_TERMINOLOGY,
  projectEdit: DEFAULT_PROJECT_EDIT_TERMINOLOGY,
  workLogs: DEFAULT_WORK_LOG_TERMINOLOGY,
};

export function resolveTerminology(enabled: boolean) {
  return enabled ? KITCHEN_TERMINOLOGY : DEFAULT_TERMINOLOGY;
}

export function getAgentEntityType(terminology: Terminology = DEFAULT_TERMINOLOGY) {
  return terminology.agents.entityType ?? DEFAULT_TERMINOLOGY.agents.entityType ?? 'agent';
}

export function getAgentRunStateAttribute(
  runState: AgentRunState,
  terminology: Terminology = DEFAULT_TERMINOLOGY,
) {
  return (
    terminology.agents.runStateAttributes?.[runState] ??
    DEFAULT_TERMINOLOGY.agents.runStateAttributes?.[runState] ??
    runState
  );
}

export function formatAgentRunStateCount(
  count: number,
  runState: AgentRunState,
  terminology: Terminology = DEFAULT_TERMINOLOGY,
) {
  const entityLabel =
    count === 1
      ? (terminology.agents.singularLower ??
        DEFAULT_TERMINOLOGY.agents.singularLower ??
        terminology.agents.pluralLower)
      : terminology.agents.pluralLower;
  const runStateLabel =
    terminology.agents.runStates?.[runState] ??
    DEFAULT_TERMINOLOGY.agents.runStates?.[runState] ??
    runState;

  return `${count} ${entityLabel} ${runStateLabel}`;
}

export function getProjectDetailTerminology(terminology: Terminology = DEFAULT_TERMINOLOGY) {
  return terminology.projectDetail ?? DEFAULT_PROJECT_DETAIL_TERMINOLOGY;
}

export function getProjectEditTerminology(terminology: Terminology = DEFAULT_TERMINOLOGY) {
  return terminology.projectEdit ?? DEFAULT_PROJECT_EDIT_TERMINOLOGY;
}

export function getWorkLogTerminology(terminology: Terminology = DEFAULT_TERMINOLOGY) {
  return terminology.workLogs ?? DEFAULT_WORK_LOG_TERMINOLOGY;
}

function normalizeStatus(value: string | null | undefined) {
  return (value || '').trim();
}

export function getTaskStatusLabel(
  status: string | null | undefined,
  terminology: Terminology = DEFAULT_TERMINOLOGY,
) {
  const normalized = normalizeStatus(status);
  if (!normalized) return 'Unknown';
  if (normalized in terminology.statuses) {
    return terminology.statuses[normalized as TaskStatus];
  }
  return normalized;
}

export function getBoardStatusLabel(
  status: string | null | undefined,
  terminology: Terminology = DEFAULT_TERMINOLOGY,
) {
  const normalized = normalizeStatus(status);
  if (!normalized) return 'Unknown';
  if (normalized in terminology.boardStatuses) {
    return terminology.boardStatuses[normalized as BoardTaskStatus];
  }
  return getTaskStatusLabel(normalized, terminology);
}

function buildStatusLabelAliases() {
  const aliases: Record<string, TaskStatus> = {};

  for (const terminology of [DEFAULT_TERMINOLOGY, KITCHEN_TERMINOLOGY]) {
    for (const [status, label] of Object.entries(terminology.statuses)) {
      aliases[label.toLowerCase()] = status as TaskStatus;
    }
    for (const [status, label] of Object.entries(terminology.boardStatuses)) {
      aliases[label.toLowerCase()] = status as TaskStatus;
    }
  }

  return aliases;
}

const STATUS_LABEL_ALIASES = buildStatusLabelAliases();

export function parseTaskStatusLabel(label: string) {
  const normalized = label.trim();
  if (!normalized) return '';
  return (
    STATUS_LABEL_ALIASES[normalized.toLowerCase()] ?? normalized.toLowerCase().replace(/\s+/g, '_')
  );
}
