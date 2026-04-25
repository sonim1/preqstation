import { Container, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconFolderPlus } from '@tabler/icons-react';
import { and, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { EmptyState } from '@/app/components/empty-state';
import { LinkButton } from '@/app/components/link-button';
import { OpenClawGuide } from '@/app/components/openclaw-guide';
import panelStyles from '@/app/components/panels.module.css';
import { ProjectEditPanel } from '@/app/components/panels/project-edit-panel';
import { TaskPanelModal } from '@/app/components/task-panel-modal';
import { WorkspacePageHeader } from '@/app/components/workspace-page-header';
import { updateProject as runUpdateProjectAction } from '@/lib/actions/project-actions';
import { writeAuditLog } from '@/lib/audit';
import { withOwnerDb } from '@/lib/db/rls';
import { projects, taskLabels, tasks, workLogs } from '@/lib/db/schema';
import { getOwnerUserOrNull, requireOwnerUser } from '@/lib/owner';
import { getProjectActivityStatus } from '@/lib/project-activity';
import { getProjectPortfolioBgUrl } from '@/lib/project-backgrounds';
import { normalizeProjectKey } from '@/lib/project-key';
import { ACTIVE_PROJECT_STATUS, PAUSED_PROJECT_STATUS } from '@/lib/project-meta';
import { resolveTerminology } from '@/lib/terminology';
import { getUserSetting, SETTING_KEYS } from '@/lib/user-settings';

import { ProjectPortfolioCard, type ProjectPortfolioCardSummary } from './project-portfolio-card';
import styles from './projects-page.module.css';

const DAY_MS = 86_400_000;
const WEEK_MS = DAY_MS * 7;

type ProjectsPageProps = {
  searchParams?: Promise<{ panel?: string; projectKey?: string }>;
};

type WeeklyActivity = { date: string; count: number };

function toValidDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatUtcDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getRecentUtcDates(now: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (6 - index));
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

function getProjectPosture(params: {
  projectStatus: string;
  lastActivityAt: Date;
  now: Date;
  openTaskCount: number;
  readyCount: number;
  holdCount: number;
  health: string;
}) {
  if (params.projectStatus === PAUSED_PROJECT_STATUS) {
    return {
      tone: 'quiet' as const,
      bucket: 'quiet' as const,
    };
  }

  const ageMs = Math.max(0, params.now.getTime() - params.lastActivityAt.getTime());

  if (params.health === 'critical' || params.health === 'warning' || ageMs > 3 * DAY_MS) {
    return {
      tone: 'drifting' as const,
      bucket: 'drifting' as const,
    };
  }

  if (params.openTaskCount >= 6 || params.holdCount >= 2) {
    return {
      tone: 'heavy' as const,
      bucket: 'heavy' as const,
    };
  }

  return {
    tone: 'steady' as const,
    bucket: 'recent' as const,
  };
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps = {}) {
  const queryParams = await (searchParams ??
    Promise.resolve<{ panel?: string; projectKey?: string }>({}));
  const owner = await getOwnerUserOrNull();
  if (!owner) redirect('/login?reason=auth');

  const nonDeletedProjectFilter = or(
    isNull(tasks.projectId),
    sql`EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.deleted_at IS NULL)`,
  );

  const now = new Date();
  const activityWindowStart = formatUtcDate(new Date(now.getTime() - 6 * DAY_MS));
  const [allProjects, statusCounts, latestWorkLogs, weeklyProjectActivityRows, kitchenMode] =
    await withOwnerDb(owner.id, async (client) =>
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
  const activePanel = queryParams.panel === 'project-edit' ? 'project-edit' : null;
  const editingProjectKey = normalizeProjectKey(queryParams.projectKey || '');
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

  const lastWorkedAtByProjectId = new Map(
    latestWorkLogs.map((row) => [row.projectId, toValidDate(row.lastWorkedAt)] as const),
  );
  const activityDays = getRecentUtcDates(now);
  const weeklyActivityByProjectId = new Map<string, Map<string, number>>();
  for (const row of weeklyProjectActivityRows) {
    const dateKey = toDateKey(row.worked_day);
    if (!row.project_id || !dateKey) continue;

    const current = weeklyActivityByProjectId.get(row.project_id) ?? new Map<string, number>();
    current.set(dateKey, Number(row.count));
    weeklyActivityByProjectId.set(row.project_id, current);
  }

  const projectSummaries = allProjects
    .map((project) => {
      const counts = countsByProjectId.get(project.id) ?? {};
      const inboxCount = counts.inbox ?? 0;
      const todoCount = counts.todo ?? 0;
      const holdCount = counts.hold ?? 0;
      const readyCount = counts.ready ?? 0;
      const openTaskCount = inboxCount + todoCount + holdCount + readyCount;
      const lastWorkedAt = lastWorkedAtByProjectId.get(project.id) ?? null;
      const lastActivityAt = lastWorkedAt ?? toValidDate(project.updatedAt) ?? now;
      const health = getProjectActivityStatus({
        projectStatus: project.status,
        lastWorkedAt,
        now,
      });
      const posture = getProjectPosture({
        projectStatus: project.status,
        lastActivityAt,
        now,
        openTaskCount,
        readyCount,
        holdCount,
        health: health.status,
      });
      const weeklyActivity: WeeklyActivity[] = activityDays.map((date) => ({
        date,
        count: weeklyActivityByProjectId.get(project.id)?.get(date) ?? 0,
      }));

      return {
        project,
        holdCount,
        readyCount,
        openTaskCount,
        lastActivityAt,
        posture,
        weeklyActivity,
        weeklyActivityTotal: weeklyActivity.reduce((sum, point) => sum + point.count, 0),
      };
    })
    .sort((a, b) => {
      const activityDelta = b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
      if (activityDelta !== 0) return activityDelta;
      return a.project.name.localeCompare(b.project.name);
    });

  const totalProjectCount = projectSummaries.length;
  const activeProjectCount = projectSummaries.filter(
    (summary) => summary.project.status === ACTIVE_PROJECT_STATUS,
  ).length;
  const touchedThisWeekCount = projectSummaries.filter(
    (summary) => now.getTime() - summary.lastActivityAt.getTime() <= WEEK_MS,
  ).length;
  const resumeProjects = projectSummaries.filter(
    (summary) => summary.project.status !== PAUSED_PROJECT_STATUS,
  );
  const quietProjects = projectSummaries.filter(
    (summary) => summary.project.status === PAUSED_PROJECT_STATUS,
  );
  const featuredSummary = resumeProjects[0] ?? quietProjects[0] ?? null;
  const featuredProjectId = featuredSummary?.project.id ?? null;
  const readyNextProjectCount = resumeProjects.filter((summary) => summary.readyCount > 0).length;
  const driftingProjectCount = resumeProjects.filter(
    (summary) => summary.posture.tone === 'drifting',
  ).length;

  function toProjectCardSummary(
    summary: (typeof projectSummaries)[number],
    slot: ProjectPortfolioCardSummary['slot'],
  ): ProjectPortfolioCardSummary {
    const backgroundUrl = getProjectPortfolioBgUrl(summary.project.bgImage);

    return {
      id: summary.project.id,
      name: summary.project.name,
      projectKey: summary.project.projectKey,
      isPaused: summary.project.status === PAUSED_PROJECT_STATUS,
      description: summary.project.description?.trim() || 'No description yet.',
      posture: summary.posture,
      openTaskCount: summary.openTaskCount,
      readyCount: summary.readyCount,
      holdCount: summary.holdCount,
      openLabel: `Open ${terminology.task.plural}`,
      readyLabel: terminology.statuses.ready,
      holdLabel: terminology.statuses.hold,
      repoUrl: summary.project.repoUrl,
      vercelUrl: summary.project.vercelUrl,
      detailsHref: `/project/${summary.project.projectKey}`,
      editHref: `/projects?panel=project-edit&projectKey=${summary.project.projectKey}`,
      backgroundUrl,
      backgroundMode: backgroundUrl ? 'image' : 'fallback',
      weeklyActivity: summary.weeklyActivity,
      weeklyActivityTotal: summary.weeklyActivityTotal,
      slot,
    };
  }

  const featuredCard = featuredSummary ? toProjectCardSummary(featuredSummary, 'lead') : null;
  const resumeCards = resumeProjects
    .filter((summary) => summary.project.id !== featuredProjectId)
    .map((summary, index) => toProjectCardSummary(summary, index === 0 ? 'support' : 'lane'));
  const quietCards = quietProjects
    .filter((summary) => summary.project.id !== featuredProjectId)
    .map((summary) => toProjectCardSummary(summary, 'quiet'));
  const summaryStrip = [
    { label: 'Live projects', value: activeProjectCount },
    { label: 'Ready next', value: readyNextProjectCount },
    { label: 'Drifting', value: driftingProjectCount },
    { label: 'Touched in 7d', value: touchedThisWeekCount },
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

  return (
    <Container
      className="dashboard-root"
      fluid
      px={{ base: 'sm', sm: 'md', lg: 'lg', xl: 'xl' }}
      py={{ base: 'md', sm: 'xl' }}
    >
      <Stack gap="md" className="dashboard-stack">
        <WorkspacePageHeader
          title="Projects"
          description="Resume where work last moved. Keep the whole portfolio visible."
        />

        <div className={styles.topGrid}>
          <Paper
            withBorder
            radius="md"
            p={{ base: 'sm', sm: 'lg' }}
            className={`${panelStyles.sectionPanel} ${styles.topSection}`}
          >
            <Stack gap="lg">
              <div className={styles.topBar}>
                <Group justify="flex-end" align="center" wrap="wrap" className={styles.topActions}>
                  <LinkButton href="/dashboard?panel=project">New Project</LinkButton>
                </Group>
              </div>

              <div className={styles.summaryStrip}>
                {summaryStrip.map((item) => (
                  <div key={item.label} className={styles.summaryPill}>
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              <div className={styles.guideWrap}>
                <OpenClawGuide
                  projects={projectSummaries.map((summary) => ({
                    projectKey: summary.project.projectKey,
                    name: summary.project.name,
                    repoUrl: summary.project.repoUrl,
                  }))}
                />
              </div>
            </Stack>
          </Paper>

          {featuredCard ? (
            <div className={styles.topFeature} data-portfolio-featured="true">
              <ProjectPortfolioCard
                card={featuredCard}
                deleteAction={deleteProject}
                pauseAction={pauseProject}
              />
            </div>
          ) : null}
        </div>

        {totalProjectCount === 0 ? (
          <EmptyState
            icon={<IconFolderPlus size={24} />}
            title="No projects yet"
            description={`Create your first project to start tracking ${terminology.task.pluralLower} and progress.`}
            action={<LinkButton href="/dashboard?panel=project">Create Project</LinkButton>}
          />
        ) : (
          <>
            {resumeCards.length > 0 ? (
              <section className={styles.portfolioSection} data-project-section="resume">
                <div className={styles.mosaic}>
                  {resumeCards.map((card) => (
                    <ProjectPortfolioCard
                      key={card.id}
                      card={card}
                      deleteAction={deleteProject}
                      pauseAction={pauseProject}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section className={styles.portfolioSection} data-project-section="quiet">
              <div className={styles.sectionHead}>
                <div>
                  <Title component="h2" order={2} size="h4">
                    Quiet edge
                  </Title>
                  <Text c="dimmed" size="sm">
                    Paused projects stay within reach without competing with the active lane.
                  </Text>
                </div>
                <span className={styles.sectionCount}>{quietCards.length}</span>
              </div>

              {quietCards.length > 0 ? (
                <div className={styles.quietLane}>
                  {quietCards.map((card) => (
                    <ProjectPortfolioCard
                      key={card.id}
                      card={card}
                      deleteAction={deleteProject}
                      pauseAction={pauseProject}
                    />
                  ))}
                </div>
              ) : (
                <p className={styles.sectionEmpty}>No paused projects right now.</p>
              )}
            </section>
          </>
        )}
      </Stack>

      {activePanel === 'project-edit' && editingProject ? (
        <TaskPanelModal opened={true} title="Edit Project" closeHref="/projects" size="58rem">
          <ProjectEditPanel selectedProject={editingProject} updateProjectAction={updateProject} />
        </TaskPanelModal>
      ) : null}
    </Container>
  );
}
