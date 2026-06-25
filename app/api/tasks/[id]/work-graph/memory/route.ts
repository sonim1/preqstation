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
import { appendWorkflowMemory } from '@/lib/work-graph-service';

const memorySchema = z.object({
  appendMarkdown: z.string().optional(),
  append_markdown: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateWorkGraphRequest(req);
    if (!auth) return workGraphError('unauthorized', 'Unauthorized', 401);
    const parsed = memorySchema.safeParse(await req.json());
    if (!parsed.success) return workGraphError('invalid_request', 'Invalid request', 400);
    const appendMarkdown = parsed.data.append_markdown ?? parsed.data.appendMarkdown ?? '';
    const { id } = await params;

    return withOwnerDb(auth.ownerId, async (client) => {
      const task = await resolveTaskForWorkGraph({ client, ownerId: auth.ownerId, identifier: id });
      if (!task) return workGraphError('not_found', 'Task not found', 404);

      const result = await appendWorkflowMemory({
        client,
        ownerId: auth.ownerId,
        taskId: task.id,
        appendMarkdown,
        actorLabel: auth.tokenName ?? auth.ownerEmail,
      });
      await writeAuditLog(
        {
          ownerId: auth.ownerId,
          action: workGraphAuditAction('work_graph.memory_appended', auth),
          targetType: 'work_graph',
          targetId: task.taskKey,
          meta: workGraphAuditMeta(auth),
        },
        client,
      );

      return workGraphOk({ task: result });
    });
  } catch (error) {
    return handleWorkGraphError(error);
  }
}
