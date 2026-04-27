import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { taskLabelAssignments, taskLabels, tasks } from '@/lib/db/schema';
import type { DbClientOrTx, DbTransaction } from '@/lib/db/types';
export {
  extractTaskLabels,
  getTaskLabelIdsFromFormData,
  normalizeTaskLabelIds,
  summarizeTaskLabelNames,
  type TaskLabelSummary,
} from '@/lib/task-label-utils';

export async function listProjectTaskLabels(
  ownerId: string,
  projectId: string,
  client: DbClientOrTx = db,
) {
  return client.query.taskLabels.findMany({
    where: and(eq(taskLabels.ownerId, ownerId), eq(taskLabels.projectId, projectId)),
    orderBy: [asc(taskLabels.name)],
    columns: { id: true, projectId: true, name: true, color: true },
  });
}

export async function listProjectTaskLabelUsageCounts(
  ownerId: string,
  projectId: string,
  client: DbClientOrTx = db,
) {
  return client
    .select({
      labelId: taskLabelAssignments.labelId,
      usageCount: sql<number>`count(*)::int`,
    })
    .from(taskLabelAssignments)
    .innerJoin(tasks, eq(taskLabelAssignments.taskId, tasks.id))
    .where(
      and(eq(tasks.ownerId, ownerId), eq(tasks.projectId, projectId), isNull(tasks.archivedAt)),
    )
    .groupBy(taskLabelAssignments.labelId);
}

export async function resolveProjectTaskLabels(
  ownerId: string,
  projectId: string,
  labelIds: string[],
  client: DbClientOrTx = db,
) {
  if (labelIds.length === 0) return [];

  const labels = await client.query.taskLabels.findMany({
    where: and(
      eq(taskLabels.ownerId, ownerId),
      eq(taskLabels.projectId, projectId),
      inArray(taskLabels.id, labelIds),
    ),
    columns: { id: true, projectId: true, name: true, color: true },
  });

  const byId = new Map(labels.map((label) => [label.id, label]));
  return labelIds.map((labelId) => byId.get(labelId)).filter(Boolean) as Array<{
    id: string;
    projectId: string;
    name: string;
    color: string | null;
  }>;
}

export async function resolveOwnedTaskLabels(
  ownerId: string,
  labelIds: string[],
  client: DbClientOrTx = db,
) {
  if (labelIds.length === 0) return [];

  const labels = await client.query.taskLabels.findMany({
    where: and(eq(taskLabels.ownerId, ownerId), inArray(taskLabels.id, labelIds)),
    columns: { id: true, name: true, color: true },
  });

  const byId = new Map(labels.map((label) => [label.id, label]));
  return labelIds.map((labelId) => byId.get(labelId)).filter(Boolean) as Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
}

export async function syncTaskLabelAssignments(
  tx: DbTransaction,
  taskId: string,
  labelIds: string[],
) {
  await tx.delete(taskLabelAssignments).where(eq(taskLabelAssignments.taskId, taskId));

  if (labelIds.length === 0) return;

  await tx.insert(taskLabelAssignments).values(
    labelIds.map((labelId, position) => ({
      taskId,
      labelId,
      position,
    })),
  );
}

export function groupTaskLabelsByProjectId(
  labels: Array<{ projectId: string; id: string; name: string; color: string | null }>,
) {
  return labels.reduce<Record<string, Array<{ id: string; name: string; color: string | null }>>>(
    (acc, label) => {
      if (!acc[label.projectId]) {
        acc[label.projectId] = [];
      }
      acc[label.projectId]?.push({
        id: label.id,
        name: label.name,
        color: label.color,
      });
      return acc;
    },
    {},
  );
}
