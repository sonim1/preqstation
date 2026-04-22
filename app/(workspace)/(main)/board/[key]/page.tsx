import { and, asc, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { BoardContent } from '@/app/components/board-content';
import { boardUpdateTask } from '@/lib/actions/board-actions';
import { withOwnerDb } from '@/lib/db/rls';
import { projects, taskLabelAssignments, taskLabels, tasks, workLogs } from '@/lib/db/schema';
import { groupTasksByStatus } from '@/lib/kanban-helpers';
import { getOwnerUserOrNull } from '@/lib/owner';
import { getProjectBoardBgUrl } from '@/lib/project-backgrounds';
import { resolveProjectByKey } from '@/lib/project-resolve';
import {
  getProjectSettings,
  PROJECT_SETTING_KEYS,
  projectSettingsToRecord,
} from '@/lib/project-settings';
import { listProjectQaRuns } from '@/lib/qa-runs';
import { normalizeTaskIdentifier, taskWhereByIdentifier } from '@/lib/task-keys';
import { extractTaskLabels } from '@/lib/task-labels';
import { coerceTaskRunState, taskPriorityOptionData } from '@/lib/task-meta';
import { TASK_BOARD_ORDER } from '@/lib/task-sort-order';
import { getUserSetting, SETTING_KEYS } from '@/lib/user-settings';

type ProjectBoardPageProps = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ panel?: string; taskId?: string }>;
};

const BOARD_AUX_QUERY_TIMEOUT_MS = 800;

async function withBoardAuxFallback<T>(
  promise: Promise<T>,
  fallback: T,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const guardedPromise = promise.catch((error) => {
    console.error(`[board] ${label} failed, using fallback:`, error);
    return fallback;
  });

  const result = await Promise.race([
    guardedPromise,
    new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn(`[board] ${label} timed out, using fallback`);
        resolve(fallback);
      }, BOARD_AUX_QUERY_TIMEOUT_MS);
    }),
  ]);

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  return result;
}

export default async function ProjectBoardPage({ params, searchParams }: ProjectBoardPageProps) {
  const [{ key }, queryParams] = await Promise.all([params, searchParams]);
  const owner = await getOwnerUserOrNull();
  if (!owner) redirect('/login?reason=auth');

  const resolved = await withOwnerDb(owner.id, async (client) =>
    resolveProjectByKey(owner.id, key, client),
  );
  if (!resolved) notFound();

  const projectId = resolved.id;
  const boardHref = `/board/${resolved.projectKey}`;

  const activePanel = queryParams.panel === 'task-edit' ? 'task-edit' : null;
  const editingTodoIdentifier = normalizeTaskIdentifier(queryParams.taskId || '');

  const [
    todos,
    archivedCountRows,
    allProjects,
    todoLabels,
    editableTodo,
    telegramEnabledSetting,
    qaRuns,
    projectSettings,
  ] = await withOwnerDb(owner.id, async (client) =>
    Promise.all([
      client.query.tasks.findMany({
        where: and(
          eq(tasks.ownerId, owner.id),
          eq(tasks.projectId, projectId),
          ne(tasks.status, 'archived'),
        ),
        orderBy: TASK_BOARD_ORDER,
        with: {
          project: { columns: { id: true, name: true, projectKey: true } },
          label: { columns: { id: true, name: true, color: true } },
          labelAssignments: {
            columns: { position: true },
            orderBy: [asc(taskLabelAssignments.position)],
            with: {
              label: { columns: { id: true, name: true, color: true } },
            },
          },
        },
      }),
      client
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(
          and(
            eq(tasks.ownerId, owner.id),
            eq(tasks.projectId, projectId),
            eq(tasks.status, 'archived'),
          ),
        ),
      client
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(and(eq(projects.ownerId, owner.id), isNull(projects.deletedAt)))
        .orderBy(asc(projects.name)),
      client.query.taskLabels.findMany({
        where: and(eq(taskLabels.ownerId, owner.id), eq(taskLabels.projectId, projectId)),
        orderBy: [asc(taskLabels.name)],
        columns: { id: true, projectId: true, name: true, color: true },
      }),
      activePanel === 'task-edit' && editingTodoIdentifier
        ? client.query.tasks.findFirst({
            where: and(
              taskWhereByIdentifier(owner.id, editingTodoIdentifier),
              eq(tasks.projectId, projectId),
            ),
            columns: {
              id: true,
              taskKey: true,
              title: true,
              branch: true,
              note: true,
              projectId: true,
              taskPriority: true,
              status: true,
              engine: true,
              runState: true,
              runStateUpdatedAt: true,
            },
            with: {
              labelAssignments: {
                columns: { position: true },
                orderBy: [asc(taskLabelAssignments.position)],
                with: {
                  label: { columns: { id: true, name: true, color: true } },
                },
              },
              workLogs: {
                orderBy: [desc(workLogs.workedAt)],
                columns: {
                  id: true,
                  title: true,
                  engine: true,
                  workedAt: true,
                  createdAt: true,
                },
                with: {
                  task: { columns: { engine: true } },
                },
              },
            },
          })
        : Promise.resolve(undefined),
      getUserSetting(owner.id, SETTING_KEYS.TELEGRAM_ENABLED, client),
      withBoardAuxFallback(listProjectQaRuns(projectId, 10, client), [], 'project QA runs'),
      withBoardAuxFallback(
        getProjectSettings(projectId, client),
        projectSettingsToRecord(null),
        'project settings',
      ),
    ]),
  );

  const kanbanTasks = groupTasksByStatus(todos);
  const initialArchivedCount = archivedCountRows[0]?.count ?? 0;
  const taskPriorityOptions = taskPriorityOptionData();
  const boardBgUrl = getProjectBoardBgUrl(resolved.bgImage ?? null);
  const telegramEnabled = telegramEnabledSetting === 'true';
  const editableTaskLabels = editableTodo ? extractTaskLabels(editableTodo) : [];
  const projectLabelOptions = todoLabels.map((label) => ({
    id: label.id,
    name: label.name,
    color: label.color,
  }));

  async function updateTodo(_prevState: unknown, formData: FormData) {
    'use server';
    return boardUpdateTask(_prevState, formData, boardHref, projectId);
  }

  return (
    <BoardContent
      kanbanTasks={kanbanTasks}
      editHrefBase={`/board/${resolved.projectKey}?panel=task-edit`}
      boardHref={boardHref}
      telegramEnabled={telegramEnabled}
      projects={allProjects}
      todoLabels={projectLabelOptions}
      projectLabelOptionsByProjectId={{ [projectId]: projectLabelOptions }}
      selectedProject={{ id: resolved.id, name: resolved.name, projectKey: resolved.projectKey }}
      activePanel={activePanel}
      editableTodo={
        editableTodo
          ? {
              ...editableTodo,
              labelIds: editableTaskLabels.map((label) => label.id),
              labels: editableTaskLabels.map((label) => ({
                id: label.id,
                name: label.name,
                color: label.color ?? null,
              })),
              runState: coerceTaskRunState(editableTodo.runState),
              runStateUpdatedAt: editableTodo.runStateUpdatedAt
                ? editableTodo.runStateUpdatedAt.toISOString()
                : null,
            }
          : null
      }
      taskPriorityOptions={taskPriorityOptions}
      updateTodoAction={updateTodo}
      bgImageUrl={boardBgUrl}
      enginePresets={null}
      initialArchivedCount={initialArchivedCount}
      archiveProjectId={projectId}
      readyQaConfig={{
        projectId,
        projectKey: resolved.projectKey,
        projectName: resolved.name,
        branchName:
          projectSettings[PROJECT_SETTING_KEYS.DEPLOY_DEFAULT_BRANCH] || resolved.projectKey,
        runs: qaRuns,
      }}
    />
  );
}
