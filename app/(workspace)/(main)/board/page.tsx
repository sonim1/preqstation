import { and, asc, desc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { BoardContent } from '@/app/components/board-content';
import { boardUpdateTask } from '@/lib/actions/board-actions';
import { withOwnerDb } from '@/lib/db/rls';
import { projects, taskLabelAssignments, taskLabels, tasks, workLogs } from '@/lib/db/schema';
import { groupTasksByStatus } from '@/lib/kanban-helpers';
import { getOwnerUserOrNull } from '@/lib/owner';
import { normalizeTaskIdentifier, taskWhereByIdentifier } from '@/lib/task-keys';
import { extractTaskLabels, groupTaskLabelsByProjectId } from '@/lib/task-labels';
import { coerceTaskRunState, taskPriorityOptionData } from '@/lib/task-meta';
import { TASK_BOARD_ORDER } from '@/lib/task-sort-order';
import { getUserSetting, SETTING_KEYS } from '@/lib/user-settings';

type BoardPageProps = {
  searchParams: Promise<{ panel?: string; taskId?: string }>;
};

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const params = await searchParams;
  const owner = await getOwnerUserOrNull();
  if (!owner) redirect('/login?reason=auth');

  const activePanel = params.panel === 'task-edit' ? 'task-edit' : null;
  const editingTodoIdentifier = normalizeTaskIdentifier(params.taskId || '');
  const boardHref = '/board';
  const boardTaskScope = [
    eq(tasks.ownerId, owner.id),
    or(
      isNull(tasks.projectId),
      sql`EXISTS (SELECT 1 FROM projects WHERE projects.id = ${tasks.projectId} AND projects.deleted_at IS NULL)`,
    ),
  ] as const;

  const [
    todos,
    archivedCountRows,
    allProjects,
    todoLabels,
    editableTodo,
    telegramEnabledSetting,
    hermesTelegramEnabledSetting,
  ] = await withOwnerDb(owner.id, async (client) =>
    Promise.all([
      client.query.tasks.findMany({
        where: and(...boardTaskScope, ne(tasks.status, 'archived')),
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
        .where(and(...boardTaskScope, eq(tasks.status, 'archived'))),
      client
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(and(eq(projects.ownerId, owner.id), isNull(projects.deletedAt)))
        .orderBy(asc(projects.name)),
      client.query.taskLabels.findMany({
        where: eq(taskLabels.ownerId, owner.id),
        orderBy: [asc(taskLabels.name)],
        columns: { id: true, projectId: true, name: true, color: true },
      }),
      activePanel === 'task-edit' && editingTodoIdentifier
        ? client.query.tasks.findFirst({
            where: taskWhereByIdentifier(owner.id, editingTodoIdentifier),
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
      getUserSetting(owner.id, SETTING_KEYS.HERMES_TELEGRAM_ENABLED, client),
    ]),
  );

  const kanbanTasks = groupTasksByStatus(todos);
  const initialArchivedCount = archivedCountRows[0]?.count ?? 0;
  const taskPriorityOptions = taskPriorityOptionData();
  const telegramEnabled = telegramEnabledSetting === 'true';
  const hermesTelegramEnabled = (hermesTelegramEnabledSetting || telegramEnabledSetting) === 'true';
  const editableTaskLabels = editableTodo ? extractTaskLabels(editableTodo) : [];
  const projectLabelOptionsByProjectId = Object.fromEntries(
    Object.entries(groupTaskLabelsByProjectId(todoLabels)).map(([projectId, labels]) => [
      projectId,
      labels.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color ?? 'blue',
      })),
    ]),
  );

  async function updateTodo(_prevState: unknown, formData: FormData) {
    'use server';
    return boardUpdateTask(_prevState, formData, '/board');
  }

  return (
    <BoardContent
      kanbanTasks={kanbanTasks}
      editHrefBase="/board?panel=task-edit"
      boardHref={boardHref}
      telegramEnabled={telegramEnabled}
      hermesTelegramEnabled={hermesTelegramEnabled}
      projects={allProjects}
      todoLabels={[]}
      projectLabelOptionsByProjectId={projectLabelOptionsByProjectId}
      selectedProject={null}
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
      enginePresets={null}
      readyQaConfig={null}
      initialArchivedCount={initialArchivedCount}
      archiveProjectId={null}
    />
  );
}
