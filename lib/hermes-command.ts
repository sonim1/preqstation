import { normalizeAgentModel } from '@/lib/agent-model-catalog';
import { normalizeEngineKey } from '@/lib/engine-icons';
import {
  encodeDispatchPromptMetadata,
  resolveTaskDispatchVerb,
  type TaskDispatchObjective,
} from '@/lib/openclaw-command';

export function normalizeHermesBotUsername(value: string | null | undefined) {
  const normalized = normalizeFieldValue(value);
  const withoutAt = normalized.startsWith('@') ? normalized.slice(1) : normalized;
  return withoutAt;
}

export function formatHermesBotUsername(value: string | null | undefined) {
  const botUsername = normalizeHermesBotUsername(value);
  return botUsername ? `@${botUsername}` : '';
}

export function buildHermesDispatchTrigger(botUsername: string | null | undefined) {
  const botMention = formatHermesBotUsername(botUsername);
  return botMention ? `/preqstation_dispatch${botMention}` : '/preqstation_dispatch';
}

function normalizeFieldValue(value: string | null | undefined) {
  return value?.replace(/\r?\n/g, ' ').trim() ?? '';
}

function formatFieldValue(value: string) {
  if (!/[\s"\\]/.test(value)) return value;
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function appendField(lines: string[], key: string, value: string | null | undefined) {
  const normalized = normalizeFieldValue(value);
  if (normalized) {
    lines.push(`${key}=${formatFieldValue(normalized)}`);
  }
}

function buildHermesCommand(botUsername: string | null | undefined, fields: string[]) {
  return [buildHermesDispatchTrigger(botUsername), fields.join(' ')].join(' ');
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
  commentId?: string | null;
  botUsername?: string | null;
  model?: string | null;
}) {
  const taskKey = params.taskKey.trim();
  const objective = params.objective ?? 'default';
  const resolvedObjective = resolveTaskDispatchVerb(params.status.trim(), objective);
  const engineKey = normalizeEngineKey(params.engineKey) ?? 'codex';
  const fields = [
    `project_key=${getProjectKeyFromTaskKey(taskKey)}`,
    `task_key=${taskKey}`,
    `objective=${resolvedObjective}`,
    `engine=${engineKey}`,
  ];

  appendField(fields, 'model', normalizeAgentModel(params.model));
  appendField(fields, 'branch_name', params.branchName);
  if (resolvedObjective === 'ask') {
    appendField(fields, 'ask_hint', params.askHint);
  }
  if (resolvedObjective === 'comment') {
    appendField(fields, 'comment_id', params.commentId);
  }

  return buildHermesCommand(params.botUsername, fields);
}

export function buildHermesProjectInsightCommand(params: {
  projectKey: string;
  engineKey?: string | null;
  branchName?: string | null;
  insightPrompt?: string | null;
  botUsername?: string | null;
  model?: string | null;
}) {
  const projectKey = normalizeProjectKey(params.projectKey);
  const engineKey = normalizeEngineKey(params.engineKey) ?? 'codex';
  const fields = [`project_key=${projectKey}`, 'objective=insight', `engine=${engineKey}`];

  appendField(fields, 'model', normalizeAgentModel(params.model));
  appendField(fields, 'branch_name', params.branchName);
  appendField(
    fields,
    'insight_prompt_b64',
    params.insightPrompt ? encodeDispatchPromptMetadata(params.insightPrompt) : null,
  );

  return buildHermesCommand(params.botUsername, fields);
}

export function buildHermesQaCommand(params: {
  projectKey: string;
  engineKey?: string | null;
  branchName?: string | null;
  qaRunId?: string | null;
  qaTaskKeys?: string[] | null;
  botUsername?: string | null;
  model?: string | null;
}) {
  const projectKey = normalizeProjectKey(params.projectKey);
  const engineKey = normalizeEngineKey(params.engineKey) ?? 'codex';
  const qaTaskKeys = Array.isArray(params.qaTaskKeys)
    ? params.qaTaskKeys
        .map((taskKey) => normalizeFieldValue(taskKey))
        .filter(Boolean)
        .join(',')
    : '';
  const fields = [`project_key=${projectKey}`, 'objective=qa', `engine=${engineKey}`];

  appendField(fields, 'model', normalizeAgentModel(params.model));
  appendField(fields, 'branch_name', params.branchName);
  appendField(fields, 'qa_run_id', params.qaRunId);
  appendField(fields, 'qa_task_keys', qaTaskKeys);

  return buildHermesCommand(params.botUsername, fields);
}
