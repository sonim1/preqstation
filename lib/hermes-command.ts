import { normalizeEngineKey } from '@/lib/engine-icons';
import { resolveTaskDispatchVerb, type TaskDispatchObjective } from '@/lib/openclaw-command';

const DEFAULT_HERMES_BOT_USERNAME = 'PreqHermesBot';

function normalizeFieldValue(value: string | null | undefined) {
  return value?.replace(/\r?\n/g, ' ').trim() ?? '';
}

function appendField(lines: string[], key: string, value: string | null | undefined) {
  const normalized = normalizeFieldValue(value);
  if (normalized) {
    lines.push(`${key}=${normalized}`);
  }
}

function getProjectKeyFromTaskKey(taskKey: string) {
  return taskKey.split('-', 1)[0]?.trim().toUpperCase() || taskKey.trim().toUpperCase();
}

export function buildHermesTaskCommand(params: {
  taskKey: string;
  status: string;
  engineKey?: string | null;
  branchName?: string | null;
  objective?: TaskDispatchObjective | null;
  askHint?: string | null;
  botUsername?: string | null;
}) {
  const taskKey = params.taskKey.trim();
  const botUsername = normalizeFieldValue(params.botUsername) || DEFAULT_HERMES_BOT_USERNAME;
  const objective = params.objective ?? 'default';
  const resolvedObjective = resolveTaskDispatchVerb(params.status.trim(), objective);
  const engineKey = normalizeEngineKey(params.engineKey) ?? 'codex';
  const lines = [
    `/preq_dispatch@${botUsername}`,
    `project_key=${getProjectKeyFromTaskKey(taskKey)}`,
    `task_key=${taskKey}`,
    `objective=${resolvedObjective}`,
    `engine=${engineKey}`,
  ];

  appendField(lines, 'branch_name', params.branchName);
  if (resolvedObjective === 'ask') {
    appendField(lines, 'ask_hint', params.askHint);
  }

  return lines.join('\n');
}
