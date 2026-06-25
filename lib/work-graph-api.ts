import { and } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { authenticateApiToken } from '@/lib/api-tokens';
import type { DbClientOrTx } from '@/lib/db/types';
import { requireOwnerUser } from '@/lib/owner';
import { taskWhereByIdentifier } from '@/lib/task-keys';
import { WorkGraphServiceError } from '@/lib/work-graph-service';

export const WORK_GRAPH_SCHEMA_VERSION = 'preqstation.v2.0';

export type WorkGraphAuth = {
  ownerId: string;
  ownerEmail: string | null;
  source: 'api_token' | 'session';
  tokenId?: string;
  tokenName?: string;
  userId?: string;
};

export function buildWorkGraphRequestId() {
  return `req_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function workGraphOk(data: unknown, init?: { status?: number; warnings?: string[] }) {
  return NextResponse.json(
    {
      ok: true,
      schema_version: WORK_GRAPH_SCHEMA_VERSION,
      request_id: buildWorkGraphRequestId(),
      data,
      warnings: init?.warnings ?? [],
    },
    { status: init?.status ?? 200 },
  );
}

export function workGraphError(
  code: string,
  message: string,
  status: number,
  details: Record<string, unknown> = {},
) {
  return NextResponse.json(
    {
      ok: false,
      schema_version: WORK_GRAPH_SCHEMA_VERSION,
      request_id: buildWorkGraphRequestId(),
      error: { code, message, details },
    },
    { status },
  );
}

export async function authenticateWorkGraphRequest(req: Request): Promise<WorkGraphAuth | null> {
  const apiAuth = await authenticateApiToken(req);
  if (apiAuth) {
    return {
      ownerId: apiAuth.ownerId,
      ownerEmail: apiAuth.ownerEmail,
      source: 'api_token',
      tokenId: apiAuth.tokenId,
      tokenName: apiAuth.tokenName,
    };
  }

  try {
    const owner = await requireOwnerUser();
    return {
      ownerId: owner.id,
      ownerEmail: owner.email,
      source: 'session',
      userId: owner.id,
    };
  } catch (error) {
    if (error instanceof Response && error.status === 401) return null;
    throw error;
  }
}

export function workGraphAuditMeta(auth: WorkGraphAuth) {
  if (auth.source === 'api_token') {
    return {
      actor: 'api_token',
      tokenId: auth.tokenId,
      tokenName: auth.tokenName,
    };
  }

  return {
    actor: 'session',
    userId: auth.userId,
  };
}

export function workGraphAuditAction(action: string, auth: WorkGraphAuth) {
  return `${action}.${auth.source === 'api_token' ? 'via_api_token' : 'via_session'}`;
}

export async function resolveTaskForWorkGraph(params: {
  client: DbClientOrTx;
  ownerId: string;
  identifier: string;
}) {
  return params.client.query.tasks.findFirst({
    where: and(taskWhereByIdentifier(params.ownerId, params.identifier)),
    columns: {
      id: true,
      taskKey: true,
      projectId: true,
    },
  });
}

export function handleWorkGraphError(error: unknown) {
  if (error instanceof WorkGraphServiceError) {
    return workGraphError(error.code, error.message, error.status, error.details);
  }

  console.error('Work graph API error', error);
  return workGraphError('internal_error', 'Internal server error', 500);
}
