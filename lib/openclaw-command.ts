import { normalizeEngineKey } from '@/lib/engine-icons';

export const TASK_DISPATCH_OBJECTIVES = [
  'default',
  'plan',
  'implement',
  'ask',
  'review',
  'qa',
] as const;
export type TaskDispatchObjective = (typeof TASK_DISPATCH_OBJECTIVES)[number];
export const PROJECT_DISPATCH_OBJECTIVES = ['insight'] as const;
export type ProjectDispatchObjective = (typeof PROJECT_DISPATCH_OBJECTIVES)[number];

export function normalizeTelegramCommandMessage(message: string) {
  const trimmed = message.trim();
  if (trimmed.startsWith('!')) return trimmed;
  return `!${trimmed}`;
}

function quoteMessageValue(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ').trim()}"`;
}

export function encodeDispatchPromptMetadata(value: string) {
  const normalized = value.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return '';

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(normalized, 'utf8').toString('base64');
  }

  const bytes = new TextEncoder().encode(normalized);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function appendCommandMetadata(
  command: string,
  metadata: Record<string, string | null | undefined>,
) {
  const parts = Object.entries(metadata)
    .map(([key, value]) => [key, value?.trim() ?? ''] as const)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${quoteMessageValue(value)}`);

  if (parts.length === 0) return normalizeTelegramCommandMessage(command);
  return normalizeTelegramCommandMessage(`${command} ${parts.join(' ')}`);
}

export function resolveOpenClawTaskVerb(status: string) {
  switch (status) {
    case 'inbox':
      return 'plan';
    case 'todo':
    case 'hold':
      return 'implement';
    case 'ready':
      return 'review';
    case 'done':
    case 'archived':
      return 'status';
    default:
      return 'status';
  }
}

export function resolveTaskDispatchVerb(
  status: string,
  objective: TaskDispatchObjective = 'default',
) {
  if (objective !== 'default') {
    return objective;
  }

  return resolveOpenClawTaskVerb(status);
}

export function buildOpenClawTaskCommand(params: {
  taskKey: string;
  status: string;
  engineKey?: string | null;
  branchName?: string | null;
  objective?: TaskDispatchObjective | null;
  askHint?: string | null;
}) {
  const taskKey = params.taskKey.trim();
  const status = params.status.trim();
  const engineKey = normalizeEngineKey(params.engineKey) ?? 'codex';
  const objective = params.objective ?? 'default';
  const command = `/skill preqstation-dispatch ${resolveTaskDispatchVerb(status, objective)} ${taskKey} using ${engineKey}`;
  return appendCommandMetadata(command, {
    branch_name: params.branchName,
    ask_hint: objective === 'ask' ? params.askHint : null,
  });
}

export function buildOpenClawQaCommand(params: {
  projectKey: string;
  engineKey?: string | null;
  branchName?: string | null;
  qaRunId?: string | null;
  qaTaskKeys?: string[] | null;
}) {
  const projectKey = params.projectKey.trim();
  const engineKey = normalizeEngineKey(params.engineKey) ?? 'codex';
  const command = `/skill preqstation-dispatch qa ${projectKey} using ${engineKey}`;
  const qaTaskKeys = Array.isArray(params.qaTaskKeys)
    ? params.qaTaskKeys
        .map((taskKey) => taskKey.trim())
        .filter(Boolean)
        .join(',')
    : '';
  return appendCommandMetadata(command, {
    branch_name: params.branchName,
    qa_run_id: params.qaRunId,
    qa_task_keys: qaTaskKeys,
  });
}

export function buildOpenClawProjectCommand(params: {
  projectKey: string;
  objective?: ProjectDispatchObjective | null;
  engineKey?: string | null;
  branchName?: string | null;
  insightPrompt?: string | null;
}) {
  const projectKey = params.projectKey.trim().toUpperCase();
  const objective = params.objective ?? 'insight';
  const engineKey = normalizeEngineKey(params.engineKey) ?? 'codex';
  const command = `/skill preqstation-dispatch ${objective} ${projectKey} using ${engineKey}`;

  return appendCommandMetadata(command, {
    branch_name: params.branchName,
    insight_prompt_b64: params.insightPrompt
      ? encodeDispatchPromptMetadata(params.insightPrompt)
      : null,
  });
}
