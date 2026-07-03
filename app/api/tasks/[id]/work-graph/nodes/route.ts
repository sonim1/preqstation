import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { withOwnerDb } from '@/lib/db/rls';
import {
  authenticateWorkGraphRequest,
  handleWorkGraphError,
  resolveTaskForWorkGraph,
  workGraphAuditAction,
  workGraphAuditMeta,
  workGraphError,
  workGraphOk,
} from '@/lib/work-graph-api';
import { createWorkNode } from '@/lib/work-graph-service';

const createNodeSchema = z.object({
  type: z.string().trim().min(1),
  title: z.string().trim().min(1),
  body: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  parent_id: z.string().optional().nullable(),
  runtimeTarget: z.string().optional().nullable(),
  runtime_target: z.string().optional().nullable(),
  engine: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  actorKind: z.string().optional().nullable(),
  actor_kind: z.string().optional().nullable(),
  actorLabel: z.string().optional().nullable(),
  actor_label: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
  idempotency_key: z.string().optional().nullable(),
  sortOrder: z.string().optional().nullable(),
  sort_order: z.string().optional().nullable(),
  waitingReason: z.string().optional().nullable(),
  waiting_reason: z.string().optional().nullable(),
  decisionPrompt: z.string().optional().nullable(),
  decision_prompt: z.string().optional().nullable(),
  resultSummary: z.string().optional().nullable(),
  result_summary: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  dependencyIds: z.array(z.string()).optional(),
  dependency_ids: z.array(z.string()).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateWorkGraphRequest(req);
    if (!auth) return workGraphError('unauthorized', 'Unauthorized', 401);
    const parsed = createNodeSchema.safeParse(await req.json());
    if (!parsed.success) return workGraphError('invalid_request', 'Invalid request', 400);
    const { id } = await params;

    return withOwnerDb(auth.ownerId, async (client) => {
      const task = await resolveTaskForWorkGraph({ client, ownerId: auth.ownerId, identifier: id });
      if (!task) return workGraphError('not_found', 'Task not found', 404);

      const input = parsed.data;
      const result = await createWorkNode({
        client,
        ownerId: auth.ownerId,
        taskId: task.id,
        input: {
          type: input.type,
          title: input.title,
          body: input.body,
          status: input.status,
          parentId: input.parent_id ?? input.parentId,
          runtimeTarget: input.runtime_target ?? input.runtimeTarget,
          engine: input.engine,
          model: input.model,
          actorKind: input.actor_kind ?? input.actorKind,
          actorLabel: input.actor_label ?? input.actorLabel ?? auth.tokenName,
          idempotencyKey: input.idempotency_key ?? input.idempotencyKey,
          sortOrder: input.sort_order ?? input.sortOrder,
          waitingReason: input.waiting_reason ?? input.waitingReason,
          decisionPrompt: input.decision_prompt ?? input.decisionPrompt,
          resultSummary: input.result_summary ?? input.resultSummary,
          metadata: input.metadata,
          dependencyIds: input.dependency_ids ?? input.dependencyIds,
        },
      });
      await writeAuditLog(
        {
          ownerId: auth.ownerId,
          action: workGraphAuditAction('work_node.created', auth),
          targetType: 'work_node',
          targetId: result.node.id,
          meta: { ...workGraphAuditMeta(auth), taskKey: task.taskKey },
        },
        client,
      );

      return workGraphOk(result, { status: result.created ? 201 : 200 });
    });
  } catch (error) {
    return handleWorkGraphError(error);
  }
}
