import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { dispatchRequests } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';
import { normalizeEngineKey } from '@/lib/engine-icons';

export const DISPATCH_REQUEST_SCOPES = ['task', 'project'] as const;
export type DispatchRequestScope = (typeof DISPATCH_REQUEST_SCOPES)[number];

export const DISPATCH_REQUEST_OBJECTIVES = [
  'ask',
  'plan',
  'implement',
  'review',
  'qa',
  'insight',
] as const;
export type DispatchRequestObjective = (typeof DISPATCH_REQUEST_OBJECTIVES)[number];

export const DISPATCH_REQUEST_STATES = ['queued', 'dispatched', 'failed'] as const;
export type DispatchRequestState = (typeof DISPATCH_REQUEST_STATES)[number];

export const DISPATCH_REQUEST_TARGETS = ['claude-code-channel'] as const;
export type DispatchRequestTarget = (typeof DISPATCH_REQUEST_TARGETS)[number];

export type DispatchRequestPromptMetadata = {
  askHint?: string | null;
  insightPromptB64?: string | null;
};

function normalizeProjectKey(projectKey: string) {
  return projectKey.trim().toUpperCase();
}

function normalizeTaskKey(taskKey: string | null | undefined) {
  const normalized = taskKey?.trim().toUpperCase() ?? '';
  return normalized || null;
}

function normalizePromptMetadata(metadata: DispatchRequestPromptMetadata | null | undefined) {
  if (!metadata) {
    return null;
  }

  const askHint = metadata.askHint?.trim() ?? '';
  const insightPromptB64 = metadata.insightPromptB64?.trim() ?? '';
  if (!askHint && !insightPromptB64) {
    return null;
  }

  return {
    ...(askHint ? { askHint } : {}),
    ...(insightPromptB64 ? { insightPromptB64 } : {}),
  };
}

export async function createDispatchRequest(
  params: {
    ownerId: string;
    scope: DispatchRequestScope;
    objective: DispatchRequestObjective;
    projectKey: string;
    taskKey?: string | null;
    engine?: string | null;
    dispatchTarget?: DispatchRequestTarget | null;
    branchName?: string | null;
    promptMetadata?: DispatchRequestPromptMetadata | null;
    now?: Date;
  },
  client: DbClientOrTx = db,
) {
  const now = params.now ?? new Date();
  const [request] = await client
    .insert(dispatchRequests)
    .values({
      ownerId: params.ownerId,
      scope: params.scope,
      objective: params.objective,
      projectKey: normalizeProjectKey(params.projectKey),
      taskKey: normalizeTaskKey(params.taskKey),
      engine: normalizeEngineKey(params.engine) ?? null,
      dispatchTarget: params.dispatchTarget ?? 'claude-code-channel',
      branchName: params.branchName?.trim() || null,
      promptMetadata: normalizePromptMetadata(params.promptMetadata),
      state: 'queued',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return request ?? null;
}

export async function listDispatchRequests(
  params: {
    ownerId: string;
    dispatchTarget?: DispatchRequestTarget | null;
    state?: DispatchRequestState | null;
    objective?: DispatchRequestObjective | null;
    limit?: number;
  },
  client: DbClientOrTx = db,
) {
  const conditions = [eq(dispatchRequests.ownerId, params.ownerId)];
  if (params.dispatchTarget) {
    conditions.push(eq(dispatchRequests.dispatchTarget, params.dispatchTarget));
  }
  if (params.state) {
    conditions.push(eq(dispatchRequests.state, params.state));
  }
  if (params.objective) {
    conditions.push(eq(dispatchRequests.objective, params.objective));
  }

  const query = client
    .select()
    .from(dispatchRequests)
    .where(and(...conditions))
    .orderBy(asc(dispatchRequests.createdAt));

  if (typeof params.limit === 'number') {
    return query.limit(params.limit);
  }

  return query;
}

export async function updateDispatchRequestState(
  params: {
    ownerId: string;
    requestId: string;
    state: DispatchRequestState;
    errorMessage?: string | null;
    now?: Date;
  },
  client: DbClientOrTx = db,
) {
  const now = params.now ?? new Date();
  const [request] = await client
    .update(dispatchRequests)
    .set({
      state: params.state,
      errorMessage: params.errorMessage?.trim() || null,
      dispatchedAt: params.state === 'dispatched' ? now : null,
      failedAt: params.state === 'failed' ? now : null,
      updatedAt: now,
    })
    .where(
      and(eq(dispatchRequests.ownerId, params.ownerId), eq(dispatchRequests.id, params.requestId)),
    )
    .returning();

  return request ?? null;
}
