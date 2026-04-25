import { Container, Stack } from '@mantine/core';
import { asc, desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { DashboardOperatorDesk } from '@/app/components/dashboard-operator-desk';
import { DashboardPanelDrawer } from '@/app/components/dashboard-panel-drawer';
import { LinkButton } from '@/app/components/link-button';
import { ProjectFormPanel } from '@/app/components/panels/project-form-panel';
import { TaskFormPanel } from '@/app/components/panels/task-form-panel';
import { WorklogFormPanel } from '@/app/components/panels/worklog-form-panel';
import { ProjectEditModal } from '@/app/components/project-edit-modal';
import { EmptyTaskEditPanel, TaskEditPanel } from '@/app/components/task-edit-panel';
import { TaskPanelModal } from '@/app/components/task-panel-modal';
import { WorkspacePageHeader } from '@/app/components/workspace-page-header';
import { getDashboardData } from '@/lib/dashboard';
import { selectOnTheLineTodos } from '@/lib/dashboard-on-the-line';
import { withOwnerDb } from '@/lib/db/rls';
import { taskLabelAssignments, taskLabels, workLogs as workLogsTable } from '@/lib/db/schema';
import { getOwnerUserOrNull } from '@/lib/owner';
import { normalizeTaskIdentifier, taskWhereByIdentifier } from '@/lib/task-keys';
import { extractTaskLabels, groupTaskLabelsByProjectId } from '@/lib/task-labels';
import { coerceTaskRunState, taskPriorityOptionData } from '@/lib/task-meta';
import { resolveTerminology, type Terminology } from '@/lib/terminology';
import { getUserSetting, SETTING_KEYS } from '@/lib/user-settings';

import {
  createProject,
  createTodo,
  createWorkLog,
  toggleTodayFocus,
  updateProject,
  updateTodo,
  updateTodoStatus,
} from './actions';

type HomePageProps = {
  searchParams: Promise<{
    panel?: string;
    projectId?: string;
    taskId?: string;
  }>;
};

const panels = ['project', 'project-edit', 'task', 'task-edit', 'worklog'] as const;
type PanelType = (typeof panels)[number];

function parsePanel(value: string): PanelType | null {
  if (panels.includes(value as PanelType)) return value as PanelType;
  return null;
}

function panelTitle(panel: PanelType, terminology: Terminology) {
  if (panel === 'project') return 'New Project';
  if (panel === 'project-edit') return 'Edit Project';
  if (panel === 'task') return `New ${terminology.task.singular}`;
  if (panel === 'task-edit') return `Edit ${terminology.task.singular}`;
  return 'New Work Log';
}

function buildDashboardHref(options: {
  panel?: string | null;
  projectId?: string;
  taskId?: string;
}) {
  const query = new URLSearchParams();
  if (options.projectId) query.set('projectId', options.projectId);
  if (options.taskId) query.set('taskId', options.taskId);
  if (options.panel) query.set('panel', options.panel);
  const text = query.toString();
  return text ? `/dashboard?${text}` : '/dashboard';
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const activePanel = parsePanel(params.panel || '');
  const selectedProjectId = params.projectId || '';
  const editingTodoIdentifier = normalizeTaskIdentifier(params.taskId || '');
  const owner = await getOwnerUserOrNull();
  if (!owner) redirect('/login?reason=auth');

  const [
    { projects, todos, weeklyActivity, metrics, portfolioOverview },
    allProjectLabels,
    editableTodo,
    telegramEnabledSetting,
    hermesTelegramEnabledSetting,
    kitchenMode,
  ] = await withOwnerDb(owner.id, async (client) => {
    const timeZonePromise = getUserSetting(owner.id, SETTING_KEYS.TIMEZONE, client);

    return Promise.all([
      timeZonePromise.then((value) => getDashboardData(owner.id, client, value)),
      client.query.taskLabels.findMany({
        where: eq(taskLabels.ownerId, owner.id),
        orderBy: [asc(taskLabels.name)],
        columns: { id: true, projectId: true, name: true, color: true },
      }),
      editingTodoIdentifier
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
                  label: {
                    columns: { id: true, name: true, color: true },
                  },
                },
              },
              workLogs: {
                orderBy: [desc(workLogsTable.workedAt)],
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
        : Promise.resolve(null),
      getUserSetting(owner.id, SETTING_KEYS.TELEGRAM_ENABLED, client),
      getUserSetting(owner.id, SETTING_KEYS.HERMES_TELEGRAM_ENABLED, client),
      getUserSetting(owner.id, SETTING_KEYS.KITCHEN_MODE, client),
    ]);
  });
  const telegramEnabled = telegramEnabledSetting === 'true';
  const hermesTelegramEnabled = (hermesTelegramEnabledSetting || telegramEnabledSetting) === 'true';
  const terminology = resolveTerminology(kitchenMode === 'true');
  const selectedProject = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId)
    : null;
  const currentDashboardHref = buildDashboardHref({
    projectId: selectedProjectId || undefined,
  });
  const dashboardClassName = 'dashboard-root';
  const isTaskPanel = activePanel === 'task' || activePanel === 'task-edit';

  const readyTasks = todos.filter((todo) => todo.status === 'ready');
  const onTheLine = selectOnTheLineTodos(todos);
  const taskPriorityOptions = taskPriorityOptionData();
  const editableTaskLabels = editableTodo ? extractTaskLabels(editableTodo) : [];
  const projectLabelOptionsByProjectId = groupTaskLabelsByProjectId(allProjectLabels);
  const editableTodoLabels = editableTodo?.projectId
    ? (projectLabelOptionsByProjectId[editableTodo.projectId] ?? [])
    : [];

  return (
    <Container
      className={dashboardClassName}
      fluid
      px={{ base: 'sm', sm: 'md', lg: 'lg', xl: 'xl' }}
      py={{ base: 'md', sm: 'xl' }}
    >
      <Stack gap="md" className="dashboard-stack is-overview">
        <WorkspacePageHeader
          title="Dashboard"
          description="Today's work, portfolio signals, and the next things that need movement."
        />

        <DashboardOperatorDesk
          portfolioOverview={portfolioOverview}
          terminology={terminology}
          readyCount={readyTasks.length}
          weeklyWorkLogCount={metrics.weeklyDoneCount}
          projectsCount={projects.length}
          repoConnected={metrics.repoConnected}
          vercelConnected={metrics.vercelConnected}
          focusTodos={onTheLine.rows}
          readyTodos={readyTasks}
          weeklyActivity={weeklyActivity}
          selectedProjectId={selectedProjectId || undefined}
          toggleTodayFocusAction={toggleTodayFocus}
          updateTodoStatusAction={updateTodoStatus}
          actions={
            selectedProject ? (
              <LinkButton
                href={buildDashboardHref({ panel: 'project-edit', projectId: selectedProject.id })}
                variant="subtle"
                size="sm"
                style={{ minHeight: 'var(--ui-hit-touch-min)' }}
              >
                Edit Project
              </LinkButton>
            ) : null
          }
        />
      </Stack>

      {activePanel === 'project-edit' ? (
        <ProjectEditModal
          closeHref={currentDashboardHref}
          selectedProject={selectedProject}
          updateProjectAction={updateProject}
        />
      ) : null}

      {activePanel === 'task' ? (
        <TaskPanelModal
          opened={true}
          title={panelTitle(activePanel, terminology)}
          closeHref={currentDashboardHref}
          size="58rem"
        >
          <TaskFormPanel
            createTodoAction={createTodo}
            projects={projects}
            projectLabelsByProjectId={projectLabelOptionsByProjectId}
            taskPriorityOptions={taskPriorityOptions}
            defaultProjectId={selectedProject?.id}
          />
        </TaskPanelModal>
      ) : null}

      {activePanel === 'task-edit' ? (
        editableTodo ? (
          <TaskEditPanel
            key={editableTodo.taskKey}
            closeHref={currentDashboardHref}
            editableTodo={{
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
            }}
            projects={projects}
            todoLabels={editableTodoLabels}
            taskPriorityOptions={taskPriorityOptions}
            updateTodoAction={updateTodo}
            branchName={editableTodo.branch}
            telegramEnabled={telegramEnabled}
            hermesTelegramEnabled={hermesTelegramEnabled}
          />
        ) : (
          <EmptyTaskEditPanel closeHref={currentDashboardHref} size="80rem" />
        )
      ) : null}

      {activePanel && !isTaskPanel && activePanel !== 'project-edit' ? (
        <DashboardPanelDrawer
          opened={true}
          title={panelTitle(activePanel, terminology)}
          closeHref={currentDashboardHref}
        >
          <Stack gap="md">
            <LinkButton
              href={currentDashboardHref}
              variant="default"
              size="sm"
              w="fit-content"
              style={{ minHeight: 'var(--ui-hit-touch-min)' }}
            >
              Close
            </LinkButton>

            {activePanel === 'project' ? (
              <ProjectFormPanel createProjectAction={createProject} />
            ) : null}

            {activePanel === 'worklog' ? (
              <WorklogFormPanel
                createWorkLogAction={createWorkLog}
                projects={projects}
                defaultProjectId={selectedProject?.id}
              />
            ) : null}
          </Stack>
        </DashboardPanelDrawer>
      ) : null}
    </Container>
  );
}
