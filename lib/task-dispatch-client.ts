import type { TaskDispatchObjective } from '@/lib/openclaw-command';

export async function queueClaudeCodeDispatch(params: {
  taskKey: string;
  engine?: string | null;
  branchName?: string | null;
  objective?: TaskDispatchObjective | null;
  askHint?: string | null;
}) {
  const response = await fetch('/api/dispatch/claude-code', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      taskKey: params.taskKey,
      engine: params.engine ?? '',
      branchName: params.branchName ?? '',
      objective: params.objective ?? 'default',
      askHint: params.askHint ?? '',
    }),
  });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    return {
      ok: false as const,
      error: body?.error || 'Failed to queue Claude Code dispatch',
    };
  }

  return { ok: true as const };
}

export async function queueClaudeCodeInsightDispatch(params: {
  projectKey: string;
  engine?: string | null;
  branchName?: string | null;
  insightPromptB64: string;
}) {
  const response = await fetch('/api/dispatch/claude-code/insight', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      projectKey: params.projectKey,
      engine: params.engine ?? '',
      branchName: params.branchName ?? '',
      insightPromptB64: params.insightPromptB64,
    }),
  });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    return {
      ok: false as const,
      error: body?.error || 'Failed to queue Claude Code insight dispatch',
    };
  }

  return { ok: true as const };
}
