import { normalizeEngineKey } from '@/lib/engine-icons';
import {
  buildHermesProjectInsightCommand,
  buildHermesQaCommand,
  buildHermesTaskCommand,
} from '@/lib/hermes-command';
import {
  buildOpenClawProjectCommand,
  buildOpenClawQaCommand,
  buildOpenClawTaskCommand,
  type TaskDispatchObjective,
} from '@/lib/openclaw-command';
import type { TaskDispatchTarget } from '@/lib/task-dispatch';

type TelegramTaskDispatchTarget = Extract<TaskDispatchTarget, 'telegram' | 'hermes-telegram'>;
type ProjectDispatchTarget = TaskDispatchTarget;
type TelegramProjectDispatchTarget = Extract<ProjectDispatchTarget, 'telegram' | 'hermes-telegram'>;

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
  return buildProjectInsightDispatchMessage({
    projectKey,
    engine,
    branchName,
    insightPrompt,
    dispatchTarget: 'telegram',
  });
}

export function buildProjectInsightDispatchMessage({
  projectKey,
  engine,
  branchName,
  insightPrompt,
  dispatchTarget = 'telegram',
}: BuildProjectInsightTelegramMessageParams & {
  dispatchTarget?: ProjectDispatchTarget | null;
}) {
  if (dispatchTarget === 'hermes-telegram') {
    return buildHermesProjectInsightCommand({
      projectKey,
      engineKey: normalizeEngineKey(engine) ?? 'codex',
      branchName,
      insightPrompt,
    });
  }

  return buildOpenClawProjectCommand({
    projectKey,
    engineKey: normalizeEngineKey(engine) ?? 'codex',
    branchName,
    insightPrompt,
  });
}

export function buildProjectQaDispatchMessage(params: {
  projectKey: string;
  engine?: string | null;
  branchName?: string | null;
  qaRunId?: string | null;
  qaTaskKeys?: string[] | null;
  dispatchTarget?: ProjectDispatchTarget | null;
}) {
  if (params.dispatchTarget === 'hermes-telegram') {
    return buildHermesQaCommand({
      projectKey: params.projectKey,
      engineKey: normalizeEngineKey(params.engine) ?? 'codex',
      branchName: params.branchName,
      qaRunId: params.qaRunId,
      qaTaskKeys: params.qaTaskKeys,
    });
  }

  return buildOpenClawQaCommand({
    projectKey: params.projectKey,
    engineKey: normalizeEngineKey(params.engine) ?? 'codex',
    branchName: params.branchName,
    qaRunId: params.qaRunId,
    qaTaskKeys: params.qaTaskKeys,
  });
}

export async function sendProjectInsightTelegramMessage(
  projectKey: string,
  message: string,
  dispatchTarget: TelegramProjectDispatchTarget = 'telegram',
) {
  const response = await fetch('/api/telegram/send/insight', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      projectKey,
      message,
      ...(dispatchTarget === 'telegram' ? {} : { dispatchTarget }),
    }),
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
