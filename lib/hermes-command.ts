import { normalizeEngineKey } from '@/lib/engine-icons';
import {
  encodeDispatchPromptMetadata,
  resolveTaskDispatchVerb,
  type TaskDispatchObjective,
} from '@/lib/openclaw-command';

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

function normalizeProjectKey(projectKey: string) {
  return projectKey.trim().toUpperCase();
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

export function buildHermesProjectInsightCommand(params: {
  projectKey: string;
  engineKey?: string | null;
  branchName?: string | null;
  insightPrompt?: string | null;
  botUsername?: string | null;
}) {
  const projectKey = normalizeProjectKey(params.projectKey);
  const botUsername = normalizeFieldValue(params.botUsername) || DEFAULT_HERMES_BOT_USERNAME;
  const engineKey = normalizeEngineKey(params.engineKey) ?? 'codex';
  const lines = [
    `/preq_dispatch@${botUsername}`,
    `project_key=${projectKey}`,
    'objective=insight',
    `engine=${engineKey}`,
  ];

  appendField(lines, 'branch_name', params.branchName);
  appendField(
    lines,
    'insight_prompt_b64',
    params.insightPrompt ? encodeDispatchPromptMetadata(params.insightPrompt) : null,
  );

  return lines.join('\n');
}

export function buildHermesQaCommand(params: {
  projectKey: string;
  engineKey?: string | null;
  branchName?: string | null;
  qaRunId?: string | null;
  qaTaskKeys?: string[] | null;
  botUsername?: string | null;
}) {
  const projectKey = normalizeProjectKey(params.projectKey);
  const botUsername = normalizeFieldValue(params.botUsername) || DEFAULT_HERMES_BOT_USERNAME;
  const engineKey = normalizeEngineKey(params.engineKey) ?? 'codex';
  const qaTaskKeys = Array.isArray(params.qaTaskKeys)
    ? params.qaTaskKeys
        .map((taskKey) => normalizeFieldValue(taskKey))
        .filter(Boolean)
        .join(',')
    : '';
  const lines = [
    `/preq_dispatch@${botUsername}`,
    `project_key=${projectKey}`,
    'objective=qa',
    `engine=${engineKey}`,
  ];

  appendField(lines, 'branch_name', params.branchName);
  appendField(lines, 'qa_run_id', params.qaRunId);
  appendField(lines, 'qa_task_keys', qaTaskKeys);

  return lines.join('\n');
}
