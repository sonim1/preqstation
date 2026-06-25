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
import { initializeWorkGraph } from '@/lib/work-graph-service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateWorkGraphRequest(req);
    if (!auth) return workGraphError('unauthorized', 'Unauthorized', 401);
    const { id } = await params;

    return withOwnerDb(auth.ownerId, async (client) => {
      const task = await resolveTaskForWorkGraph({ client, ownerId: auth.ownerId, identifier: id });
      if (!task) return workGraphError('not_found', 'Task not found', 404);

      const result = await initializeWorkGraph({
        client,
        ownerId: auth.ownerId,
        taskId: task.id,
        actorLabel: auth.tokenName ?? auth.ownerEmail,
      });
      await writeAuditLog(
        {
          ownerId: auth.ownerId,
          action: workGraphAuditAction('work_graph.initialized', auth),
          targetType: 'work_graph',
          targetId: task.taskKey,
          meta: workGraphAuditMeta(auth),
        },
        client,
      );

      return workGraphOk(result, { status: result.created ? 201 : 200 });
    });
  } catch (error) {
    return handleWorkGraphError(error);
  }
}
