import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { withOwnerDb } from '@/lib/db/rls';
import { taskWorkNodes } from '@/lib/db/schema';
import {
  authenticateWorkGraphRequest,
  handleWorkGraphError,
  workGraphAuditAction,
  workGraphAuditMeta,
  workGraphError,
  workGraphOk,
} from '@/lib/work-graph-api';
import { transitionWorkNode } from '@/lib/work-graph-service';

const transitionSchema = z.object({
  action: z.enum(['start', 'complete', 'fail', 'cancel', 'wait', 'block', 'ready']),
  resultSummary: z.string().optional().nullable(),
  result_summary: z.string().optional().nullable(),
  waitingReason: z.string().optional().nullable(),
  waiting_reason: z.string().optional().nullable(),
  decisionPrompt: z.string().optional().nullable(),
  decision_prompt: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function GET(req: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  try {
    const auth = await authenticateWorkGraphRequest(req);
    if (!auth) return workGraphError('unauthorized', 'Unauthorized', 401);
    const { nodeId } = await params;

    return withOwnerDb(auth.ownerId, async (client) => {
      const node = await client.query.taskWorkNodes.findFirst({
        where: and(eq(taskWorkNodes.ownerId, auth.ownerId), eq(taskWorkNodes.id, nodeId)),
      });
      if (!node) return workGraphError('not_found', 'Work node not found', 404);
      return workGraphOk({ node });
    });
  } catch (error) {
    return handleWorkGraphError(error);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  try {
    const auth = await authenticateWorkGraphRequest(req);
    if (!auth) return workGraphError('unauthorized', 'Unauthorized', 401);
    const parsed = transitionSchema.safeParse(await req.json());
    if (!parsed.success) return workGraphError('invalid_request', 'Invalid request', 400);
    const { nodeId } = await params;

    return withOwnerDb(auth.ownerId, async (client) => {
      const input = parsed.data;
      const node = await transitionWorkNode({
        client,
        ownerId: auth.ownerId,
        nodeId,
        action: input.action,
        resultSummary: input.result_summary ?? input.resultSummary,
        waitingReason: input.waiting_reason ?? input.waitingReason,
        decisionPrompt: input.decision_prompt ?? input.decisionPrompt,
        metadata: input.metadata,
        actorLabel: auth.tokenName ?? auth.ownerEmail,
      });
      await writeAuditLog(
        {
          ownerId: auth.ownerId,
          action: workGraphAuditAction('work_node.transitioned', auth),
          targetType: 'work_node',
          targetId: nodeId,
          meta: { ...workGraphAuditMeta(auth), action: input.action },
        },
        client,
      );

      return workGraphOk({ node });
    });
  } catch (error) {
    return handleWorkGraphError(error);
  }
}
