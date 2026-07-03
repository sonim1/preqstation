import { withOwnerDb } from '@/lib/db/rls';
import {
  authenticateWorkGraphRequest,
  handleWorkGraphError,
  resolveTaskForWorkGraph,
  workGraphError,
  workGraphOk,
} from '@/lib/work-graph-api';
import { getWorkGraph } from '@/lib/work-graph-service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateWorkGraphRequest(req);
    if (!auth) return workGraphError('unauthorized', 'Unauthorized', 401);
    const { id } = await params;

    return withOwnerDb(auth.ownerId, async (client) => {
      const task = await resolveTaskForWorkGraph({ client, ownerId: auth.ownerId, identifier: id });
      if (!task) return workGraphError('not_found', 'Task not found', 404);

      const graph = await getWorkGraph({ client, ownerId: auth.ownerId, taskId: task.id });
      return workGraphOk(graph);
    });
  } catch (error) {
    return handleWorkGraphError(error);
  }
}
