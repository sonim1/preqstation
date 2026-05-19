import { Temporal } from '@js-temporal/polyfill';
import { Container, Stack, Title } from '@mantine/core';
import { IconActivity, IconFolders } from '@tabler/icons-react';
import { and, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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
import { resolveDisplayTimeZone } from '@/lib/date-time';
import { withOwnerDb } from '@/lib/db/rls';
import { projects, taskLabels, tasks, workLogs } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';
import { normalizeGithubRepoReference } from '@/lib/github-repo';
import { getOwnerUserOrNull, requireOwnerUser } from '@/lib/owner';
import { getProjectActivityStatus } from '@/lib/project-activity';
import { normalizeProjectKey } from '@/lib/project-key';
import {
  ACTIVE_PROJECT_STATUS,
  DONE_PROJECT_STATUS,
  PAUSED_PROJECT_STATUS,
} from '@/lib/project-meta';
import { resolveTerminology } from '@/lib/terminology';
import { getUserSetting, SETTING_KEYS } from '@/lib/user-settings';

import type { ProjectPortfolioCardSummary } from './project-portfolio-card';
import { getProjectFilterStatus } from './project-roster-filter';
import { ProjectsOfflineHydrator } from './projects-offline-hydrator';
import styles from './projects-page.module.css';
import { ProjectsRosterClient } from './projects-roster-client';
import { WorkspaceActivityChart } from './workspace-activity-chart';

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

type ProjectActivityRow = {
  project_id: string;
  worked_day: string | Date;
  count: number | bigint;
};

type WorkspaceActivity = { date: string; count: number };

function getLastQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.at(-1) ?? '';
  return value ?? '';
}

function getProjectSortRank(status: string) {
  if (status === PAUSED_PROJECT_STATUS) return 1;
  if (status === DONE_PROJECT_STATUS) return 2;
  return 0;
}

function toValidDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatPlainDate(value: Temporal.PlainDate) {
  return `${value.year}-${pad(value.month)}-${pad(value.day)}`;
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

function getRecentDateKeys(now: Date, length: number, timeZone: string) {
  const today = Temporal.Instant.fromEpochMilliseconds(now.getTime())
    .toZonedDateTimeISO(resolveDisplayTimeZone(timeZone))
    .toPlainDate();
  const start = today.subtract({ days: length - 1 });

  return Array.from({ length }, (_, index) => {
    return formatPlainDate(start.add({ days: index }));
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
  return normalizeGithubRepoReference(repoUrl) ?? projectKey;
}

function isMissingProjectActivityRollupRelationError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };

  return (
    maybeError.code === '42P01' ||
    Boolean(
      maybeError.message?.includes('does not exist') &&
      maybeError.message.includes('dashboard_project_work_log_daily'),
    )
  );
}

async function loadProjectActivityRows({
  ownerId,
  startDate,
  timeZone,
  client,
}: {
  ownerId: string;
  startDate: string;
  timeZone: string;
  client: DbClientOrTx;
}) {
  try {
    return await client.execute<ProjectActivityRow>(sql`
      select project_id, bucket_date as worked_day, count
      from dashboard_project_work_log_daily
      where owner_id = ${ownerId}::uuid
        and bucket_date >= ${startDate}::date
      order by project_id asc, bucket_date asc
    `);
  } catch (error) {
    if (!isMissingProjectActivityRollupRelationError(error)) {
      throw error;
    }
  }

  return client.execute<ProjectActivityRow>(sql`
    select
      project_id,
      (worked_at at time zone ${timeZone})::date as worked_day,
      count(*)::int as count
    from work_logs
    where owner_id = ${ownerId}::uuid
      and project_id is not null
      and (worked_at at time zone ${timeZone})::date >= ${startDate}::date
    group by project_id, worked_day
    order by project_id asc, worked_day asc
  `);
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
  const [
    allProjects,
    statusCounts,
    runStateCounts,
    latestWorkLogs,
    projectActivityRows,
    kitchenMode,
    activityTimeZone,
  ] = await withOwnerDb(owner.id, async (client) => {
    const savedTimeZone = await getUserSetting(owner.id, SETTING_KEYS.TIMEZONE, client);
    const resolvedTimeZone = resolveDisplayTimeZone(savedTimeZone);
    const activityWindowStart =
      getRecentDateKeys(now, 30, resolvedTimeZone)[0] ?? formatUtcDate(now);

    return Promise.all([
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
      loadProjectActivityRows({
        ownerId: owner.id,
        startDate: activityWindowStart,
        timeZone: resolvedTimeZone,
        client,
      }),
      getUserSetting(owner.id, SETTING_KEYS.KITCHEN_MODE, client),
      Promise.resolve(resolvedTimeZone),
    ]);
  });

  const terminology = resolveTerminology(kitchenMode === 'true');
  const panelParam = getLastQueryValue(queryParams.panel);
  const projectKeyParam = getLastQueryValue(queryParams.projectKey);
  const searchQuery = getLastQueryValue(queryParams.q).trim();
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
  const activityDays = getRecentDateKeys(now, 30, activityTimeZone);
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
      const updatedAt = toValidDate(project.updatedAt) ?? now;
      const lastActivityAt = lastWorkedAt ?? updatedAt;
      const health = getProjectActivityStatus({
        projectStatus: project.status,
        lastWorkedAt,
        now,
      });
      const ageMs = Math.max(0, now.getTime() - lastActivityAt.getTime());
      const tone =
        project.status === DONE_PROJECT_STATUS
          ? ('archived' as const)
          : project.status === PAUSED_PROJECT_STATUS
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
      const rankDelta = getProjectSortRank(a.project.status) - getProjectSortRank(b.project.status);
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
  const archivedProjectCount = projectSummaries.filter(
    (summary) => summary.project.status === DONE_PROJECT_STATUS,
  ).length;
  const queuedAgentCount = projectSummaries.reduce((sum, summary) => sum + summary.queuedCount, 0);
  const runningAgentCount = projectSummaries.reduce(
    (sum, summary) => sum + summary.runningCount,
    0,
  );
  const activeAgentCount = runningAgentCount + queuedAgentCount;
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
      isArchived: summary.project.status === DONE_PROJECT_STATUS,
      description: summary.project.description?.trim() || 'No description yet.',
      tone: summary.tone,
      statusLabel:
        summary.project.status === DONE_PROJECT_STATUS
          ? 'Archived'
          : summary.project.status === PAUSED_PROJECT_STATUS
            ? 'Paused'
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

  const rosterCards = projectSummaries.map((summary) => toProjectCardSummary(summary));
  const filterChips = [
    {
      label: 'All',
      value: totalProjectCount,
      filter: 'all' as const,
      active: selectedProjectFilter === 'all',
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
      value: archivedProjectCount,
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
              icon={IconFolders}
              title={`Projects roster · ${totalProjectCount} repos`}
              description="Workspace activity, live agent state, and repo readiness at a glance."
            />
            <div className={styles.rosterActions}>
              <LinkButton href="/dashboard?panel=project" size="compact-sm">
                New project
              </LinkButton>
            </div>
          </div>

          <section className={styles.activityPanel}>
            <div className={styles.activityHeader}>
              <Title component="h2" order={3} className={styles.activityTitle}>
                <IconActivity size={16} aria-hidden="true" />
                Workspace activity
                <span aria-hidden="true">·</span>
                <span className={styles.activityRangeDesktop}>last 30 days</span>
                <span className={styles.activityRangeMobile}>last 7 days</span>
                <span aria-hidden="true">·</span>
                <span>
                  {totalProjectCount} project{totalProjectCount === 1 ? '' : 's'}
                </span>
              </Title>
              <span className={styles.activityMeta}>
                <strong>{workspaceActivityTotal}</strong> logs
                <span>{workspacePeakLabel}</span>
              </span>
            </div>
            <WorkspaceActivityChart data={workspaceActivity} peak={workspaceActivityPeak} />
            <div className={styles.activityLegend} aria-hidden="true">
              <span>
                <span className={styles.activityRangeDesktop}>30 days ago</span>
                <span className={styles.activityRangeMobile}>7 days ago</span>
              </span>
              <span>today</span>
            </div>
          </section>

          <ProjectsRosterClient
            allCards={rosterCards}
            deleteProjectAction={deleteProject}
            filterChips={filterChips}
            initialState={{
              activeAgentCount,
              searchQuery,
              selectedProjectFilter,
              terminologyTaskPluralLower: terminology.task.pluralLower,
            }}
            pauseProjectAction={pauseProject}
          />
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
