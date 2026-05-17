import { Container, SimpleGrid, Stack, TextInput } from '@mantine/core';
import { IconActivity, IconFolderPlus, IconSearch } from '@tabler/icons-react';
import { and, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { EmptyState } from '@/app/components/empty-state';
import { LinkButton } from '@/app/components/link-button';
import { ProjectEditPanel } from '@/app/components/panels/project-edit-panel';
import {
  PROJECT_EDIT_PANEL_FULLSCREEN_STORAGE_KEY,
  PROJECT_EDIT_PANEL_RESIZE_STORAGE_KEY,
} from '@/app/components/project-edit-modal';
import { TaskPanelModal } from '@/app/components/task-panel-modal';
import { WorkspacePageHeader } from '@/app/components/workspace-page-header';
import { updateProject as runUpdateProjectAction } from '@/lib/actions/project-actions';
import { writeAuditLog } from '@/lib/audit';
import { withOwnerDb } from '@/lib/db/rls';
import { projects, taskLabels, tasks, workLogs } from '@/lib/db/schema';
import { getOwnerUserOrNull, requireOwnerUser } from '@/lib/owner';
import { getProjectActivityStatus } from '@/lib/project-activity';
import { normalizeProjectKey } from '@/lib/project-key';
import { ACTIVE_PROJECT_STATUS, PAUSED_PROJECT_STATUS } from '@/lib/project-meta';
import { resolveTerminology } from '@/lib/terminology';
import { getUserSetting, SETTING_KEYS } from '@/lib/user-settings';

import { ProjectPortfolioCard, type ProjectPortfolioCardSummary } from './project-portfolio-card';
import { ProjectsOfflineHydrator } from './projects-offline-hydrator';
import styles from './projects-page.module.css';

const DAY_MS = 86_400_000;
type ProjectsSearchParams = {
  panel?: string | string[];
  projectKey?: string | string[];
  q?: string | string[];
  status?: string | string[];
};

type ProjectsPageProps = {
  searchParams?: Promise<ProjectsSearchParams>;
};

type WorkspaceActivity = { date: string; count: number };
type ProjectFilterStatus = 'all' | 'live' | 'active' | 'paused' | 'archived';

function getLastQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.at(-1) ?? '';
  return value ?? '';
}

function getProjectFilterStatus(value: string): ProjectFilterStatus {
  switch (value.toLowerCase()) {
    case 'live':
    case 'active':
    case 'paused':
    case 'archived':
      return value.toLowerCase() as ProjectFilterStatus;
    default:
      return 'all';
  }
}

function toValidDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatUtcDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatRelativeActivity(value: Date, now: Date) {
  const diffMs = Math.max(0, now.getTime() - value.getTime());
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diffMs / DAY_MS);
  if (days < 7) return `${days}d ago`;

  return `${Math.floor(days / 7)}w ago`;
}

function getRecentUtcDates(now: Date, length: number) {
  return Array.from({ length }, (_, index) => {
    const date = new Date(now);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (length - 1 - index));
    return formatUtcDate(date);
  });
}

function toDateKey(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return formatUtcDate(value);

  const normalized = value.trim();
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatUtcDate(parsed);
}

function getRepoLabel(repoUrl: string | null | undefined, projectKey: string) {
  if (!repoUrl) return projectKey;

  try {
    const parsed = new URL(repoUrl);
    const [owner, repo] = parsed.pathname.replace(/^\/|\/$/g, '').split('/');
    if (owner && repo) return `${owner}/${repo}`;
  } catch {
    return projectKey;
  }

  return projectKey;
}

function getActivityLevel(count: number, peak: number) {
  if (count <= 0 || peak <= 0) return 0;
  const ratio = count / peak;
  if (ratio >= 0.8) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps = {}) {
  const queryParams = await (searchParams ?? Promise.resolve<ProjectsSearchParams>({}));
  const owner = await getOwnerUserOrNull();
  if (!owner) redirect('/login?reason=auth');

  const nonDeletedProjectFilter = or(
    isNull(tasks.projectId),
    sql`EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.deleted_at IS NULL)`,
  );

  const now = new Date();
  const activityWindowStart = formatUtcDate(new Date(now.getTime() - 29 * DAY_MS));
  const [
    allProjects,
    statusCounts,
    runStateCounts,
    latestWorkLogs,
    projectActivityRows,
    kitchenMode,
  ] = await withOwnerDb(owner.id, async (client) =>
    Promise.all([
      client.query.projects.findMany({
        where: and(eq(projects.ownerId, owner.id), isNull(projects.deletedAt)),
        orderBy: [desc(projects.updatedAt)],
        limit: 50,
      }),
      client
        .select({
          projectId: tasks.projectId,
          status: tasks.status,
          _count: { id: sql<number>`count(*)::int` },
        })
        .from(tasks)
        .where(and(eq(tasks.ownerId, owner.id), nonDeletedProjectFilter))
        .groupBy(tasks.projectId, tasks.status),
      client
        .select({
          projectId: tasks.projectId,
          runState: tasks.runState,
          _count: { id: sql<number>`count(*)::int` },
        })
        .from(tasks)
        .where(and(eq(tasks.ownerId, owner.id), isNotNull(tasks.runState), nonDeletedProjectFilter))
        .groupBy(tasks.projectId, tasks.runState),
      client
        .select({
          projectId: workLogs.projectId,
          lastWorkedAt: sql<Date>`max(${workLogs.workedAt})`,
        })
        .from(workLogs)
        .where(and(eq(workLogs.ownerId, owner.id), isNotNull(workLogs.projectId)))
        .groupBy(workLogs.projectId),
      client.execute<{ project_id: string; worked_day: string | Date; count: number | bigint }>(
        sql`
            select
              ${workLogs.projectId} as project_id,
              (${workLogs.workedAt} at time zone 'UTC')::date as worked_day,
              count(*)::int as count
            from ${workLogs}
            where ${workLogs.ownerId} = ${owner.id}
              and ${workLogs.projectId} is not null
              and (${workLogs.workedAt} at time zone 'UTC')::date >= ${activityWindowStart}::date
            group by ${workLogs.projectId}, worked_day
            order by ${workLogs.projectId} asc, worked_day asc
          `,
      ),
      getUserSetting(owner.id, SETTING_KEYS.KITCHEN_MODE, client),
    ]),
  );

  const terminology = resolveTerminology(kitchenMode === 'true');
  const panelParam = getLastQueryValue(queryParams.panel);
  const projectKeyParam = getLastQueryValue(queryParams.projectKey);
  const searchQuery = getLastQueryValue(queryParams.q).trim();
  const normalizedSearchQuery = searchQuery.toLowerCase();
  const selectedProjectFilter = getProjectFilterStatus(getLastQueryValue(queryParams.status));
  const activePanel = panelParam === 'project-edit' ? 'project-edit' : null;
  const editingProjectKey = normalizeProjectKey(projectKeyParam);
  const editingProject =
    activePanel === 'project-edit' && editingProjectKey
      ? (allProjects.find((project) => project.projectKey === editingProjectKey) ?? null)
      : null;

  const countsByProjectId = new Map<string, Record<string, number>>();
  for (const row of statusCounts) {
    if (!row.projectId) continue;
    const current = countsByProjectId.get(row.projectId) ?? {};
    current[row.status] = row._count.id;
    countsByProjectId.set(row.projectId, current);
  }

  const runStatesByProjectId = new Map<string, Record<string, number>>();
  for (const row of runStateCounts) {
    if (!row.projectId || !row.runState) continue;
    const current = runStatesByProjectId.get(row.projectId) ?? {};
    current[row.runState] = row._count.id;
    runStatesByProjectId.set(row.projectId, current);
  }

  const lastWorkedAtByProjectId = new Map(
    latestWorkLogs.map((row) => [row.projectId, toValidDate(row.lastWorkedAt)] as const),
  );
  const activityDays = getRecentUtcDates(now, 30);
  const workspaceActivityByDate = new Map<string, number>();
  for (const row of projectActivityRows) {
    const dateKey = toDateKey(row.worked_day);
    if (!row.project_id || !dateKey) continue;

    const count = Number(row.count);
    workspaceActivityByDate.set(dateKey, (workspaceActivityByDate.get(dateKey) ?? 0) + count);
  }

  const projectSummaries = allProjects
    .map((project) => {
      const counts = countsByProjectId.get(project.id) ?? {};
      const inboxCount = counts.inbox ?? 0;
      const todoCount = counts.todo ?? 0;
      const holdCount = counts.hold ?? 0;
      const readyCount = counts.ready ?? 0;
      const doneCount = counts.done ?? 0;
      const runStates = runStatesByProjectId.get(project.id) ?? {};
      const runningCount = runStates.running ?? 0;
      const queuedCount = runStates.queued ?? 0;
      const openTaskCount = inboxCount + todoCount + holdCount + readyCount;
      const lastWorkedAt = lastWorkedAtByProjectId.get(project.id) ?? null;
      const lastActivityAt = lastWorkedAt ?? toValidDate(project.updatedAt) ?? now;
      const health = getProjectActivityStatus({
        projectStatus: project.status,
        lastWorkedAt,
        now,
      });
      const ageMs = Math.max(0, now.getTime() - lastActivityAt.getTime());
      const tone =
        project.status === PAUSED_PROJECT_STATUS
          ? ('paused' as const)
          : runningCount > 0
            ? ('live' as const)
            : queuedCount > 0
              ? ('queued' as const)
              : health.status === 'critical' || health.status === 'warning' || ageMs > 3 * DAY_MS
                ? ('stale' as const)
                : ('active' as const);

      return {
        project,
        openTaskCount,
        runningCount,
        queuedCount,
        doneCount,
        lastActivityAt,
        tone,
      };
    })
    .sort((a, b) => {
      const rank = (summary: {
        project: { status: string };
        runningCount: number;
        queuedCount: number;
      }) => {
        if (summary.runningCount > 0) return 0;
        if (summary.queuedCount > 0) return 1;
        if (summary.project.status !== PAUSED_PROJECT_STATUS) return 2;
        return 3;
      };
      const rankDelta = rank(a) - rank(b);
      if (rankDelta !== 0) return rankDelta;
      const activityDelta = b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
      if (activityDelta !== 0) return activityDelta;
      return a.project.name.localeCompare(b.project.name);
    });

  const totalProjectCount = projectSummaries.length;
  const activeProjectCount = projectSummaries.filter(
    (summary) => summary.project.status === ACTIVE_PROJECT_STATUS,
  ).length;
  const pausedProjectCount = projectSummaries.filter(
    (summary) => summary.project.status === PAUSED_PROJECT_STATUS,
  ).length;
  const liveProjectCount = projectSummaries.filter((summary) => summary.runningCount > 0).length;
  const queuedAgentCount = projectSummaries.reduce((sum, summary) => sum + summary.queuedCount, 0);
  const runningAgentCount = projectSummaries.reduce(
    (sum, summary) => sum + summary.runningCount,
    0,
  );
  const activeAgentCount = runningAgentCount + queuedAgentCount;
  const filteredProjectSummaries = projectSummaries.filter((summary) => {
    const matchesStatus =
      selectedProjectFilter === 'all' ||
      (selectedProjectFilter === 'live' && summary.runningCount > 0) ||
      (selectedProjectFilter === 'active' &&
        summary.project.status === ACTIVE_PROJECT_STATUS) ||
      (selectedProjectFilter === 'paused' &&
        summary.project.status === PAUSED_PROJECT_STATUS);

    if (!matchesStatus) return false;
    if (!normalizedSearchQuery) return true;

    const repoLabel = getRepoLabel(summary.project.repoUrl, summary.project.projectKey);
    return [
      summary.project.name,
      summary.project.projectKey,
      summary.project.description ?? '',
      repoLabel,
    ].some((value) => value.toLowerCase().includes(normalizedSearchQuery));
  });
  const workspaceActivity: WorkspaceActivity[] = activityDays.map((date) => ({
    date,
    count: workspaceActivityByDate.get(date) ?? 0,
  }));
  const workspaceActivityTotal = workspaceActivity.reduce((sum, point) => sum + point.count, 0);
  const workspaceActivityPeak = workspaceActivity.reduce(
    (peak, point) => Math.max(peak, point.count),
    0,
  );
  const peakIndex = workspaceActivity.findIndex((point) => point.count === workspaceActivityPeak);
  const workspacePeakLabel =
    workspaceActivityPeak > 0 && peakIndex >= 0
      ? `peak d-${activityDays.length - 1 - peakIndex}`
      : 'peak d-0';

  function toProjectCardSummary(
    summary: (typeof projectSummaries)[number],
  ): ProjectPortfolioCardSummary {
    return {
      id: summary.project.id,
      name: summary.project.name,
      projectKey: summary.project.projectKey,
      isPaused: summary.project.status === PAUSED_PROJECT_STATUS,
      description: summary.project.description?.trim() || 'No description yet.',
      tone: summary.tone,
      statusLabel:
        summary.project.status === PAUSED_PROJECT_STATUS
          ? 'Paused'
          : summary.runningCount > 0
            ? 'Active'
            : 'Active',
      openTaskCount: summary.openTaskCount,
      runningCount: summary.runningCount,
      queuedCount: summary.queuedCount,
      doneCount: summary.doneCount,
      openLabel: 'OPEN',
      repoLabel: getRepoLabel(summary.project.repoUrl, summary.project.projectKey),
      repoUrl: summary.project.repoUrl,
      vercelUrl: summary.project.vercelUrl,
      detailsHref: `/project/${summary.project.projectKey}`,
      editHref: `/projects?panel=project-edit&projectKey=${summary.project.projectKey}`,
      lastActivityLabel: `Last activity ${formatRelativeActivity(summary.lastActivityAt, now)}`,
    };
  }

  const rosterCards = filteredProjectSummaries.map((summary) => toProjectCardSummary(summary));
  const filterChips = [
    {
      label: 'All',
      value: totalProjectCount,
      filter: 'all' as const,
      active: selectedProjectFilter === 'all',
    },
    {
      label: 'Live',
      value: liveProjectCount,
      filter: 'live' as const,
      active: selectedProjectFilter === 'live',
    },
    {
      label: 'Active',
      value: activeProjectCount,
      filter: 'active' as const,
      active: selectedProjectFilter === 'active',
    },
    {
      label: 'Paused',
      value: pausedProjectCount,
      filter: 'paused' as const,
      active: selectedProjectFilter === 'paused',
    },
    {
      label: 'Archived',
      value: 0,
      filter: 'archived' as const,
      active: selectedProjectFilter === 'archived',
    },
  ];

  async function deleteProject(formData: FormData) {
    'use server';
    const ownerUser = await requireOwnerUser();
    const projectId = String(formData.get('projectId') || '').trim();
    if (!projectId) return;

    await withOwnerDb(ownerUser.id, async (client) => {
      const existing = await client.query.projects.findFirst({
        where: and(
          eq(projects.id, projectId),
          eq(projects.ownerId, ownerUser.id),
          isNull(projects.deletedAt),
        ),
        columns: { id: true },
      });

      if (!existing) return;

      let deletedTodosCount = 0;
      let deletedWorkLogsCount = 0;
      let deletedLabelsCount = 0;
      await client
        .update(projects)
        .set({ deletedAt: new Date() })
        .where(eq(projects.id, existing.id));
      const deletedTodos = await client
        .delete(tasks)
        .where(and(eq(tasks.ownerId, ownerUser.id), eq(tasks.projectId, existing.id)))
        .returning({ id: tasks.id });
      const deletedLogs = await client
        .delete(workLogs)
        .where(and(eq(workLogs.ownerId, ownerUser.id), eq(workLogs.projectId, existing.id)))
        .returning({ id: workLogs.id });
      const deletedLabels = await client
        .delete(taskLabels)
        .where(and(eq(taskLabels.ownerId, ownerUser.id), eq(taskLabels.projectId, existing.id)))
        .returning({ id: taskLabels.id });
      deletedTodosCount = deletedTodos.length;
      deletedWorkLogsCount = deletedLogs.length;
      deletedLabelsCount = deletedLabels.length;

      await writeAuditLog(
        {
          ownerId: ownerUser.id,
          action: 'project.deleted',
          targetType: 'project',
          targetId: existing.id,
          meta: {
            deletedTodos: deletedTodosCount,
            deletedWorkLogs: deletedWorkLogsCount,
            deletedLabels: deletedLabelsCount,
          },
        },
        client,
      );
    });

    revalidatePath('/');
    revalidatePath('/projects');
  }

  async function pauseProject(formData: FormData) {
    'use server';
    const ownerUser = await requireOwnerUser();
    const projectId = String(formData.get('projectId') || '').trim();
    if (!projectId) return;

    const result = await runUpdateProjectAction({
      ownerId: ownerUser.id,
      projectId,
      status: PAUSED_PROJECT_STATUS,
    });

    if (!result.ok) return;

    if (result.data.changed) {
      await withOwnerDb(ownerUser.id, async (client) =>
        writeAuditLog(
          {
            ownerId: ownerUser.id,
            action: 'project.updated',
            targetType: 'project',
            targetId: result.data.id,
            meta: {
              projectKey: result.data.projectKey,
              status: PAUSED_PROJECT_STATUS,
            },
          },
          client,
        ),
      );
    }

    revalidatePath(`/project/${result.data.projectKey}`);
    revalidatePath('/projects');
    revalidatePath('/dashboard');
    revalidatePath(`/board/${result.data.projectKey}`);
  }

  async function updateProject(_prevState: unknown, formData: FormData) {
    'use server';
    const ownerUser = await requireOwnerUser();
    if (!editingProject) {
      return { ok: false as const, message: 'Project not found.' };
    }

    const priorityRaw = String(formData.get('priority') || '').trim();
    const result = await runUpdateProjectAction({
      ownerId: ownerUser.id,
      projectId: String(formData.get('projectId') || editingProject.id),
      name: String(formData.get('name') || ''),
      status: String(formData.get('status') || ''),
      priority: priorityRaw ? parseInt(priorityRaw, 10) : undefined,
      descriptionMd: String(formData.get('descriptionMd') || ''),
      bgImage: String(formData.get('bgImage') || ''),
      bgImageCredit: String(formData.get('bgImageCredit') || ''),
      repoUrl: String(formData.get('repoUrl') || ''),
      vercelUrl: String(formData.get('vercelUrl') || ''),
    });

    if (!result.ok) {
      return { ok: false as const, message: result.message ?? 'Failed to update project.' };
    }

    if (result.data.changed) {
      await withOwnerDb(ownerUser.id, async (client) =>
        writeAuditLog(
          {
            ownerId: ownerUser.id,
            action: 'project.updated',
            targetType: 'project',
            targetId: result.data.id,
            meta: { projectKey: result.data.projectKey },
          },
          client,
        ),
      );
    }

    revalidatePath(`/project/${editingProject.projectKey}`);
    revalidatePath('/projects');
    revalidatePath('/dashboard');
    revalidatePath(`/board/${editingProject.projectKey}`);
    return { ok: true as const };
  }

  const projectsOfflineSnapshot = {
    filterChips,
    rosterCards,
    workspaceActivity,
    workspaceActivityTotal,
    workspacePeakLabel,
  };

  return (
    <Container
      className="dashboard-root"
      fluid
      px={{ base: 'sm', sm: 'md', lg: 'lg', xl: 'xl' }}
      py={{ base: 'md', sm: 'xl' }}
    >
      <ProjectsOfflineHydrator snapshot={projectsOfflineSnapshot}>
        <Stack gap="md" className="dashboard-stack">
          <div className={styles.rosterHeader}>
            <WorkspacePageHeader
              title={`Projects roster · ${totalProjectCount} repos`}
              description="Workspace activity, live agent state, and repo readiness at a glance."
            />
            <div className={styles.rosterActions}>
              <LinkButton href="/dashboard?panel=project" size="compact-sm">
                New project
              </LinkButton>
            </div>
          </div>

          <section className={styles.activityPanel} data-projects-activity-heatmap="true">
            <div className={styles.activityHeader}>
              <span className={styles.activityTitle}>
                <IconActivity size={16} />
                Workspace activity
                <span aria-hidden="true">·</span>
                <span>last 30 days</span>
                <span aria-hidden="true">·</span>
                <span>
                  {totalProjectCount} project{totalProjectCount === 1 ? '' : 's'}
                </span>
              </span>
              <span className={styles.activityMeta}>
                <strong>{workspaceActivityTotal}</strong> logs
                <span>{workspacePeakLabel}</span>
              </span>
            </div>
            <div
              className={styles.activityHeatmap}
              role="img"
              aria-label="Workspace activity across the last 30 days"
            >
              {workspaceActivity.map((point) => (
                <span
                  key={point.date}
                  className={styles.activityDay}
                  data-activity-level={getActivityLevel(point.count, workspaceActivityPeak)}
                  data-projects-activity-day={point.date}
                  title={`${point.date}: ${point.count} logs`}
                />
              ))}
            </div>
            <div className={styles.activityLegend} aria-hidden="true">
              <span>30 days ago</span>
              <span>today</span>
            </div>
          </section>

          <form className={styles.toolbar} method="GET">
            {activePanel ? <input type="hidden" name="panel" value={activePanel} /> : null}
            {editingProjectKey ? (
              <input type="hidden" name="projectKey" value={editingProjectKey} />
            ) : null}
            {selectedProjectFilter !== 'all' ? (
              <input type="hidden" name="status" value={selectedProjectFilter} />
            ) : null}
            <TextInput
              aria-label="Find a project"
              className={styles.searchInput}
              defaultValue={searchQuery}
              leftSection={<IconSearch size={14} />}
              name="q"
              placeholder="Find a project"
              size="xs"
              variant="filled"
            />
            <div className={styles.filterChips} aria-label="Project filters">
              {filterChips.map((chip) => (
                <button
                  key={chip.label}
                  aria-pressed={chip.active}
                  className={styles.filterChip}
                  data-active={chip.active}
                  name="status"
                  type="submit"
                  value={chip.filter === 'all' ? '' : chip.filter}
                >
                  {chip.label} {chip.value}
                </button>
              ))}
            </div>
            <span className={styles.agentStatus} data-active={activeAgentCount > 0}>
              {activeAgentCount} agents running
            </span>
          </form>

          {totalProjectCount === 0 ? (
            <EmptyState
              icon={<IconFolderPlus size={24} />}
              title="No projects yet"
              description={`Create your first project to start tracking ${terminology.task.pluralLower} and progress.`}
              action={<LinkButton href="/dashboard?panel=project">Create Project</LinkButton>}
            />
          ) : rosterCards.length === 0 ? (
            <EmptyState
              icon={<IconSearch size={24} />}
              title="No matching projects"
              description="Adjust the search or project filter to see more repos."
              action={<LinkButton href="/projects">Clear filters</LinkButton>}
            />
          ) : (
            <section className={styles.portfolioSection} data-project-section="roster">
              <SimpleGrid
                cols={{ base: 1, md: 2, xl: 3 }}
                spacing="sm"
                className={styles.rosterGrid}
              >
                {rosterCards.map((card) => (
                  <ProjectPortfolioCard
                    key={card.id}
                    card={card}
                    deleteAction={deleteProject}
                    pauseAction={pauseProject}
                  />
                ))}
              </SimpleGrid>
            </section>
          )}
        </Stack>
      </ProjectsOfflineHydrator>

      {activePanel === 'project-edit' && editingProject ? (
        <TaskPanelModal
          opened={true}
          title="Edit Project"
          closeHref="/projects"
          size="58rem"
          fullscreenStorageKey={PROJECT_EDIT_PANEL_FULLSCREEN_STORAGE_KEY}
          resizableStorageKey={PROJECT_EDIT_PANEL_RESIZE_STORAGE_KEY}
        >
          <ProjectEditPanel selectedProject={editingProject} updateProjectAction={updateProject} />
        </TaskPanelModal>
      ) : null}
    </Container>
  );
}
