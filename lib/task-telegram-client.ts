import { normalizeEngineKey } from '@/lib/engine-icons';
import { buildHermesTaskCommand } from '@/lib/hermes-command';
import {
  buildOpenClawProjectCommand,
  buildOpenClawTaskCommand,
  type TaskDispatchObjective,
} from '@/lib/openclaw-command';
import type { TaskDispatchTarget } from '@/lib/task-dispatch';

type TelegramTaskDispatchTarget = Extract<TaskDispatchTarget, 'telegram' | 'hermes-telegram'>;

type BuildTaskTelegramMessageParams = {
  taskKey: string;
  status: string;
  engine?: string | null;
  branchName?: string | null;
  objective?: TaskDispatchObjective | null;
  askHint?: string | null;
};

export function buildTaskTelegramMessage({
  taskKey,
  status,
  engine,
  branchName,
  objective,
  askHint,
}: BuildTaskTelegramMessageParams) {
  return buildOpenClawTaskCommand({
    taskKey,
    status,
    engineKey: normalizeEngineKey(engine) ?? 'codex',
    branchName,
    objective,
    askHint,
  });
}

export function buildHermesTaskTelegramMessage({
  taskKey,
  status,
  engine,
  branchName,
  objective,
  askHint,
}: BuildTaskTelegramMessageParams) {
  return buildHermesTaskCommand({
    taskKey,
    status,
    engineKey: normalizeEngineKey(engine) ?? 'codex',
    branchName,
    objective,
    askHint,
  });
}

export async function sendTaskTelegramMessage(
  taskKey: string,
  message: string,
  dispatchTarget: TelegramTaskDispatchTarget = 'telegram',
) {
  const response = await fetch('/api/telegram/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      taskKey,
      message,
      ...(dispatchTarget === 'telegram' ? {} : { dispatchTarget }),
    }),
  });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    return {
      ok: false as const,
      error: body?.error || 'Failed to send Telegram message',
    };
  }

  return { ok: true as const };
}

type BuildProjectInsightTelegramMessageParams = {
  projectKey: string;
  engine?: string | null;
  branchName?: string | null;
  insightPrompt?: string | null;
};

export function buildProjectInsightTelegramMessage({
  projectKey,
  engine,
  branchName,
  insightPrompt,
}: BuildProjectInsightTelegramMessageParams) {
  return buildOpenClawProjectCommand({
    projectKey,
    engineKey: normalizeEngineKey(engine) ?? 'codex',
    branchName,
    insightPrompt,
  });
}

export async function sendProjectInsightTelegramMessage(projectKey: string, message: string) {
  const response = await fetch('/api/telegram/send/insight', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ projectKey, message }),
  });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    return {
      ok: false as const,
      error: body?.error || 'Failed to send Telegram insight message',
    };
  }

  return { ok: true as const };
}
