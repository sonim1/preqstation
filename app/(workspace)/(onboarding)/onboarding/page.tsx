import { and, asc, desc, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { withOwnerDb } from '@/lib/db/rls';
import { mcpConnections, projects, tasks, workLogs } from '@/lib/db/schema';
import { getOwnerUserOrNull } from '@/lib/owner';

import { createOnboardingProject, createOnboardingTask } from './actions';
import { OnboardingWizard } from './onboarding-wizard';

export default async function OnboardingPage() {
  const owner = await getOwnerUserOrNull();
  if (!owner) redirect('/login?reason=auth');

  const { initialProject, initialTask, workerReadiness } = await withOwnerDb(
    owner.id,
    async (client) => {
      const firstProject = await client.query.projects.findFirst({
        where: and(eq(projects.ownerId, owner.id), isNull(projects.deletedAt)),
        orderBy: [asc(projects.createdAt)],
        columns: { id: true, name: true, projectKey: true },
      });

      const [latestTask, activeConnection, recentWorkerLog] = await Promise.all([
        firstProject
          ? client.query.tasks.findFirst({
              where: and(
                eq(tasks.ownerId, owner.id),
                eq(tasks.projectId, firstProject.id),
                isNull(tasks.archivedAt),
              ),
              orderBy: [desc(tasks.createdAt)],
              columns: {
                id: true,
                taskKey: true,
                title: true,
                status: true,
                engine: true,
                runState: true,
              },
            })
          : Promise.resolve(null),
        client.query.mcpConnections.findFirst({
          where: and(
            eq(mcpConnections.ownerId, owner.id),
            isNull(mcpConnections.revokedAt),
            gt(mcpConnections.expiresAt, new Date()),
          ),
          orderBy: [desc(mcpConnections.lastUsedAt), desc(mcpConnections.createdAt)],
          columns: { displayName: true, engine: true, lastUsedAt: true },
        }),
        client.query.workLogs.findFirst({
          where: and(eq(workLogs.ownerId, owner.id), isNotNull(workLogs.engine)),
          orderBy: [desc(workLogs.workedAt), desc(workLogs.createdAt)],
          columns: { title: true, engine: true, workedAt: true },
        }),
      ]);

      let readiness: {
        status: 'ready' | 'missing' | 'unknown';
        label: string;
        detail: string;
      } = {
        status: 'missing' as const,
        label: 'Worker not connected',
        detail:
          'Run the PREQ CLI installer or connect a direct MCP client before expecting execution.',
      };
      if (activeConnection) {
        readiness = {
          status: 'ready',
          label: 'Worker connected',
          detail: `${activeConnection.displayName} is connected for worker execution.`,
        };
      } else if (recentWorkerLog) {
        readiness = {
          status: 'ready',
          label: 'Worker activity found',
          detail: `Recent ${recentWorkerLog.engine} work log confirms a worker has executed work.`,
        };
      } else if (latestTask?.engine || latestTask?.runState) {
        readiness = {
          status: 'unknown',
          label: 'Worker state unknown',
          detail: `${latestTask.taskKey} has worker metadata, but no active connection or recent worker log was found.`,
        };
      }

      return {
        initialProject: firstProject
          ? {
              id: firstProject.id,
              name: firstProject.name,
              projectKey: firstProject.projectKey,
            }
          : null,
        initialTask: latestTask
          ? {
              id: latestTask.id,
              taskKey: latestTask.taskKey,
              title: latestTask.title,
              status: latestTask.status,
            }
          : null,
        workerReadiness: readiness,
      };
    },
  );

  return (
    <OnboardingWizard
      initialProject={initialProject}
      initialTask={initialTask}
      workerReadiness={workerReadiness}
      createProjectAction={createOnboardingProject}
      createTaskAction={createOnboardingTask}
    />
  );
}
