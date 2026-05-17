import {
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconClipboardList,
  IconExternalLink,
  IconLayoutKanban,
  IconPlus,
  IconRocket,
} from '@tabler/icons-react';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';

import { DashboardYearlyHeatmap } from '@/app/components/dashboard-yearly-heatmap';
import { EmptyState } from '@/app/components/empty-state';
import { LinkButton } from '@/app/components/link-button';
import panelStyles from '@/app/components/panels.module.css';
import { ProjectWorkLogTimeline } from '@/app/components/project-work-log-timeline';
import { SectionTitleWithIcon } from '@/app/components/section-title-with-icon';
import { TaskStatusBar } from '@/app/components/task-status-bar';
import {
  updateProject as runUpdateProjectAction,
  updateProjectAgentInstructions as runUpdateProjectAgentInstructionsAction,
  updateProjectDeploySettings as runUpdateProjectDeploySettingsAction,
} from '@/lib/actions/project-actions';
import { writeAuditLog } from '@/lib/audit';
import { TODO_LABEL_NAME_MAX_LENGTH } from '@/lib/content-limits';
import { withOwnerDb } from '@/lib/db/rls';
import { projects, taskLabels, tasks } from '@/lib/db/schema';
import { githubRepoIdToUrl } from '@/lib/github-repo';
import { getOwnerUserOrNull, requireOwnerUser } from '@/lib/owner';
import { getProjectActivityStatus } from '@/lib/project-activity';
import { isProjectStatus, PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS } from '@/lib/project-meta';
import { resolveProjectByKey } from '@/lib/project-resolve';
import { resolveAgentInstructions, resolveDeployStrategyConfig } from '@/lib/project-settings';
import { listProjectTaskLabels, listProjectTaskLabelUsageCounts } from '@/lib/task-labels';
import { normalizeTaskLabelColor, parseTaskLabelColor } from '@/lib/task-meta';
import {
  formatAgentRunStateCount,
  getAgentEntityType,
  getAgentRunStateAttribute,
  getProjectDetailTerminology,
  resolveTerminology,
} from '@/lib/terminology';
import { getUserSetting, SETTING_KEYS } from '@/lib/user-settings';
import { listProjectWorkLogYearActivity, listWorkLogsPage } from '@/lib/work-log-list';
import { PROJECT_WORK_LOG_PAGE_SIZE } from '@/lib/work-log-pagination';

import {
  ProjectDetailEditPanelButton,
  ProjectDetailEditPanelProvider,
} from './project-detail-edit-panel';
import styles from './project-detail-page.module.css';

type ProjectDetailPageProps = {
  params: Promise<{ key: string }>;
  searchParams?: Promise<{ panel?: string }>;
};

type ProjectDetailStatusTone = 'active' | 'archived' | 'live' | 'paused' | 'queued' | 'stale';

function projectStatusBadge(status: string) {
  if (!isProjectStatus(status)) {
    return { color: 'gray', label: status };
  }

  return {
    color: PROJECT_STATUS_COLORS[status],
    label: PROJECT_STATUS_LABELS[status],
  };
}

function getProjectDetailStatusTone({
  activityStatus,
  projectStatus,
  queuedTaskCount,
  runningTaskCount,
}: {
  activityStatus: string;
  projectStatus: string;
  queuedTaskCount: number;
  runningTaskCount: number;
}): ProjectDetailStatusTone {
  if (projectStatus === 'done') return 'archived';
  if (projectStatus === 'paused') return 'paused';
  if (runningTaskCount > 0) return 'live';
  if (queuedTaskCount > 0) return 'queued';
  if (activityStatus === 'critical' || activityStatus === 'warning') return 'stale';
  return 'active';
}

function toValidDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatUtcDate(value: Date | string | null | undefined) {
  const parsed = toValidDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

function formatHeroDescription(value: string | null) {
  const normalized = (value ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || 'Project details, delivery status, and recent work in one place.';
}

function joinWithAnd(values: string[]) {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function describeDeployStrategy(
  config: ReturnType<typeof resolveDeployStrategyConfig>,
  copy: ReturnType<typeof getProjectDetailTerminology>,
) {
  const strategyLabel = copy.deployStrategies[config.strategy];
  if (config.strategy === 'feature_branch') {
    const reviewNote = config.commit_on_review
      ? copy.deployCopy.pushBeforeReview
      : copy.deployCopy.reviewBeforePush;
    return config.auto_pr
      ? `${strategyLabel} ${copy.deployCopy.toBranch} ${config.default_branch}. ${copy.deployCopy.autoCreatePr} ${reviewNote.toLowerCase()}`
      : `${strategyLabel} ${copy.deployCopy.toBranch} ${config.default_branch}. ${reviewNote}`;
  }

  return config.commit_on_review
    ? `${strategyLabel} ${copy.deployCopy.toBranch} ${config.default_branch}. ${copy.deployCopy.pushBeforeReview}`
    : `${strategyLabel} ${copy.deployCopy.toBranch} ${config.default_branch}. ${copy.deployCopy.reviewBeforePush}`;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const owner = await getOwnerUserOrNull();
  if (!owner) redirect('/login?reason=auth');

  const { key } = await params;
  const resolved = await withOwnerDb(owner.id, async (client) =>
    resolveProjectByKey(owner.id, key, client),
  );
  if (!resolved) notFound();

  const [
    project,
    kitchenMode,
    todos,
    rawLabels,
    labelUsageCounts,
    projectWorkLogPage,
    projectWorkLogYearActivity,
  ] = await withOwnerDb(owner.id, async (client) => {
    const timeZonePromise = getUserSetting(owner.id, SETTING_KEYS.TIMEZONE, client);

    return Promise.all([
      client.query.projects.findFirst({
        where: and(
          eq(projects.id, resolved.id),
          eq(projects.ownerId, owner.id),
          isNull(projects.deletedAt),
        ),
        with: {
          projectSettings: {
            columns: { key: true, value: true },
          },
        },
      }),
      getUserSetting(owner.id, SETTING_KEYS.KITCHEN_MODE, client),
      client.query.tasks.findMany({
        where: and(eq(tasks.ownerId, owner.id), eq(tasks.projectId, resolved.id)),
        orderBy: [asc(tasks.status), asc(tasks.sortOrder), desc(tasks.createdAt)],
        with: {
          label: {
            columns: { id: true, name: true, color: true },
          },
        },
      }),
      listProjectTaskLabels(owner.id, resolved.id, client),
      listProjectTaskLabelUsageCounts(owner.id, resolved.id, client),
      listWorkLogsPage({
        ownerId: owner.id,
        projectId: resolved.id,
        limit: PROJECT_WORK_LOG_PAGE_SIZE,
        client,
      }),
      timeZonePromise.then((timeZone) =>
        listProjectWorkLogYearActivity({
          ownerId: owner.id,
          projectId: resolved.id,
          timeZone,
          client,
        }),
      ),
    ]);
  });

  const labelUsageCountById = new Map(
    labelUsageCounts.map((row) => [row.labelId, row.usageCount] as const),
  );
  const labels = rawLabels.map((label) => ({
    ...label,
    usageCount: labelUsageCountById.get(label.id) ?? 0,
  }));

  if (!project) notFound();
  const projectId = project.id;
  const projectKey = project.projectKey;
  const closeHref = `/project/${projectKey}`;
  const projectStatus = projectStatusBadge(project.status);
  const dashboardClassName = 'dashboard-root';
  const terminology = resolveTerminology(kitchenMode === 'true');
  const projectDetailCopy = getProjectDetailTerminology(terminology);
  const boardHref = `/board/${projectKey}`;
  const newTaskHref = `/dashboard?panel=task&projectId=${projectId}`;
  const newWorkLogHref = `/dashboard?panel=worklog&projectId=${projectId}`;

  const openTaskCount = todos.filter(
    (t) =>
      t.status === 'inbox' || t.status === 'todo' || t.status === 'hold' || t.status === 'ready',
  ).length;
  const runningTaskCount = todos.filter((t) => t.runState === 'running').length;
  const queuedTaskCount = todos.filter((t) => t.runState === 'queued').length;
  const doneTaskCount = todos.filter((t) => t.status === 'done').length;
  const runningAgentLabel = formatAgentRunStateCount(runningTaskCount, 'running', terminology);
  const projectHeroDescription = formatHeroDescription(project.description);

  const agentInstructions = resolveAgentInstructions(project.projectSettings);
  const deployStrategy = resolveDeployStrategyConfig(project.projectSettings);
  const selectedProjectForEdit = {
    id: projectId,
    name: project.name,
    projectKey,
    description: project.description,
    status: project.status,
    priority: project.priority,
    bgImage: project.bgImage,
    bgImageCredit: project.bgImageCredit,
    repoUrl: project.repoUrl,
    vercelUrl: project.vercelUrl,
  };
  const labelManagement = {
    labels,
    taskSingularLower: terminology.task.singularLower,
    taskPluralLower: terminology.task.pluralLower,
  };
  const configurationManagement = {
    projectId,
    projectName: project.name,
    agentInstructions,
    deployStrategy,
  };
  const trimmedAgentInstructions = agentInstructions?.trim() ?? '';
  const hasAgentInstructions = trimmedAgentInstructions.length > 0;
  const repoHref = githubRepoIdToUrl(project.repoUrl);
  const hasRepo = Boolean(repoHref);
  const latestWorkLog = projectWorkLogPage.workLogs[0] ?? null;
  const lastWorkedAt = toValidDate(latestWorkLog?.workedAt);
  const lastProjectUpdate = toValidDate(project.updatedAt);
  const activityStatus = getProjectActivityStatus({
    projectStatus: project.status,
    lastWorkedAt,
  });
  const detailStatusTone = getProjectDetailStatusTone({
    activityStatus: activityStatus.status,
    projectStatus: project.status,
    queuedTaskCount,
    runningTaskCount,
  });
  const hasRecentActivity =
    lastWorkedAt !== null &&
    (activityStatus.status === 'healthy' || activityStatus.status === 'warning');
  const setupReadyCount =
    [hasRepo, hasAgentInstructions, hasRecentActivity].filter(Boolean).length + 1;
  const missingSetupItems = [
    hasRepo ? null : projectDetailCopy.setupItems.repository,
    hasAgentInstructions ? null : projectDetailCopy.setupItems.agentInstructions,
    hasRecentActivity ? null : projectDetailCopy.setupItems.recentActivity,
  ].filter((value): value is string => Boolean(value));
  const setupBadgeColor =
    setupReadyCount === 4 ? 'green' : setupReadyCount === 0 ? 'red' : 'yellow';
  const setupBadgeLabel =
    setupReadyCount === 4
      ? projectDetailCopy.readiness.badges.dispatchReady
      : setupReadyCount === 0
        ? projectDetailCopy.readiness.badges.setupMissing
        : projectDetailCopy.readiness.badges.needsAttention;
  const recentActivityBadgeColor =
    !lastWorkedAt || activityStatus.status === 'inactive'
      ? 'gray'
      : activityStatus.status === 'healthy'
        ? 'green'
        : activityStatus.status === 'warning'
          ? 'yellow'
          : 'red';
  const setupSummary =
    setupReadyCount === 4
      ? projectDetailCopy.readiness.readySummary
      : `${setupReadyCount} of 4 ${projectDetailCopy.readiness.summaryPrefix} ${projectDetailCopy.readiness.summaryNextPrefix} ${joinWithAnd(missingSetupItems)}.`;
  const recentActivityDescription = !lastWorkedAt
    ? `${projectDetailCopy.recentActivity.noWorkLogsYet} ${projectDetailCopy.recentActivity.lastProjectUpdate} ${formatUtcDate(lastProjectUpdate) ?? projectDetailCopy.recentActivity.unknownDate}.`
    : activityStatus.status === 'critical'
      ? `${projectDetailCopy.recentActivity.staleWorkLog} ${projectDetailCopy.recentActivity.lastRecordedWork} ${formatUtcDate(lastWorkedAt)}.`
      : `${projectDetailCopy.recentActivity.lastRecordedWork} ${formatUtcDate(lastWorkedAt)}.`;
  const readinessRows = [
    {
      id: 'repository',
      label: projectDetailCopy.readiness.rows.repository.label,
      status: hasRepo
        ? projectDetailCopy.readiness.rows.repository.connectedStatus
        : projectDetailCopy.readiness.rows.repository.missingStatus,
      color: hasRepo ? 'blue' : 'gray',
      description: hasRepo
        ? projectDetailCopy.readiness.rows.repository.connectedDescription
        : projectDetailCopy.readiness.rows.repository.missingDescription,
    },
    {
      id: 'deployment',
      label: projectDetailCopy.readiness.rows.deployment.label,
      status: projectDetailCopy.deployStrategies[deployStrategy.strategy],
      color: 'blue',
      description: describeDeployStrategy(deployStrategy, projectDetailCopy),
    },
    {
      id: 'instructions',
      label: projectDetailCopy.readiness.rows.instructions.label,
      status: hasAgentInstructions
        ? projectDetailCopy.readiness.rows.instructions.configuredStatus
        : projectDetailCopy.readiness.rows.instructions.missingStatus,
      color: hasAgentInstructions ? 'blue' : 'gray',
      description: hasAgentInstructions
        ? projectDetailCopy.readiness.rows.instructions.configuredDescription
        : projectDetailCopy.readiness.rows.instructions.missingDescription,
    },
    {
      id: 'activity',
      label: projectDetailCopy.readiness.rows.activity.label,
      status: lastWorkedAt
        ? activityStatus.label
        : projectDetailCopy.readiness.rows.activity.noWorkLogsStatus,
      color: recentActivityBadgeColor,
      description: recentActivityDescription,
    },
  ];

  async function createLabel(_prevState: unknown, formData: FormData) {
    'use server';
    const ownerUser = await requireOwnerUser();

    const name = String(formData.get('name') || '').trim();
    const rawColor = String(formData.get('color') || '').trim();
    const color = rawColor ? normalizeTaskLabelColor(rawColor) : parseTaskLabelColor(rawColor);
    if (!name || name.length > TODO_LABEL_NAME_MAX_LENGTH) {
      return {
        ok: false as const,
        field: 'name' as const,
        message: 'Please enter a valid label name.',
      };
    }
    if (!color) {
      return {
        ok: false as const,
        field: 'color' as const,
        message: 'Please choose a valid label color.',
      };
    }

    const result = await withOwnerDb(ownerUser.id, async (client) => {
      const existing = await client.query.taskLabels.findFirst({
        where: and(
          eq(taskLabels.ownerId, ownerUser.id),
          eq(taskLabels.projectId, projectId),
          eq(taskLabels.name, name),
        ),
        columns: { id: true },
      });
      if (existing) {
        return {
          ok: false as const,
          field: 'name' as const,
          message: 'A label with the same name already exists in this project.',
        };
      }

      const [label] = await client
        .insert(taskLabels)
        .values({
          ownerId: ownerUser.id,
          projectId,
          name,
          color,
        })
        .returning();

      await writeAuditLog(
        {
          ownerId: ownerUser.id,
          action: 'todo_label.created',
          targetType: 'todo_label',
          targetId: label.id,
          meta: { projectId },
        },
        client,
      );

      return { ok: true as const };
    });
    if (!result.ok) return result;

    revalidatePath(`/project/${projectKey}`);
    revalidatePath(`/board/${projectKey}`);
    revalidatePath('/dashboard');
    return result;
  }

  async function updateLabel(_prevState: unknown, formData: FormData) {
    'use server';
    const ownerUser = await requireOwnerUser();

    const id = String(formData.get('id') || '').trim();
    const name = String(formData.get('name') || '').trim();
    const rawColor = String(formData.get('color') || '').trim();
    const color = rawColor ? normalizeTaskLabelColor(rawColor) : parseTaskLabelColor(rawColor);
    if (!id || !name || name.length > TODO_LABEL_NAME_MAX_LENGTH) {
      return {
        ok: false as const,
        field: 'name' as const,
        message: 'Please enter a valid label name.',
      };
    }
    if (!color) {
      return {
        ok: false as const,
        field: 'color' as const,
        message: 'Please choose a valid label color.',
      };
    }

    const result = await withOwnerDb(ownerUser.id, async (client) => {
      const duplicate = await client.query.taskLabels.findFirst({
        where: and(
          eq(taskLabels.ownerId, ownerUser.id),
          eq(taskLabels.projectId, projectId),
          eq(taskLabels.name, name),
        ),
        columns: { id: true },
      });
      if (duplicate && duplicate.id !== id) {
        return {
          ok: false as const,
          field: 'name' as const,
          message: 'A label with the same name already exists in this project.',
        };
      }

      const updated = await client
        .update(taskLabels)
        .set({ name, color })
        .where(
          and(
            eq(taskLabels.id, id),
            eq(taskLabels.ownerId, ownerUser.id),
            eq(taskLabels.projectId, projectId),
          ),
        )
        .returning({ id: taskLabels.id });

      if (updated.length > 0) {
        await writeAuditLog(
          {
            ownerId: ownerUser.id,
            action: 'todo_label.updated',
            targetType: 'todo_label',
            targetId: id,
            meta: { projectId },
          },
          client,
        );
      }

      return { ok: true as const };
    });
    if (!result.ok) return result;

    revalidatePath(`/project/${projectKey}`);
    revalidatePath(`/board/${projectKey}`);
    revalidatePath('/dashboard');
    return result;
  }

  async function deleteLabel(_prevState: unknown, formData: FormData) {
    'use server';
    const ownerUser = await requireOwnerUser();

    const id = String(formData.get('id') || '').trim();
    if (!id) return { ok: false as const, message: 'Label to delete not found.' };

    await withOwnerDb(ownerUser.id, async (client) => {
      const deleted = await client
        .delete(taskLabels)
        .where(
          and(
            eq(taskLabels.id, id),
            eq(taskLabels.ownerId, ownerUser.id),
            eq(taskLabels.projectId, projectId),
          ),
        )
        .returning({ id: taskLabels.id });

      if (deleted.length > 0) {
        await writeAuditLog(
          {
            ownerId: ownerUser.id,
            action: 'todo_label.deleted',
            targetType: 'todo_label',
            targetId: id,
            meta: { projectId },
          },
          client,
        );
      }
    });

    revalidatePath(`/project/${projectKey}`);
    revalidatePath(`/board/${projectKey}`);
    revalidatePath('/dashboard');
    return { ok: true as const };
  }

  async function updateProject(_prevState: unknown, formData: FormData) {
    'use server';
    const ownerUser = await requireOwnerUser();
    const priorityRaw = String(formData.get('priority') || '').trim();

    const result = await runUpdateProjectAction({
      ownerId: ownerUser.id,
      projectId,
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
      return {
        ok: false as const,
        message: result.message || 'Failed to update project.',
      };
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

    revalidatePath(`/project/${projectKey}`);
    revalidatePath('/projects');
    revalidatePath('/dashboard');
    revalidatePath(`/board/${projectKey}`);
    return { ok: true as const };
  }

  async function updateAgentInstructions(_prevState: unknown, formData: FormData) {
    'use server';
    const ownerUser = await requireOwnerUser();

    const instructions = String(formData.get('agent_instructions') || '');

    const result = await runUpdateProjectAgentInstructionsAction({
      ownerId: ownerUser.id,
      projectId,
      instructions,
    });
    if (!result.ok) {
      return {
        ok: false as const,
        message: result.message || 'Failed to save agent instructions.',
      };
    }

    await withOwnerDb(ownerUser.id, async (client) =>
      writeAuditLog(
        {
          ownerId: ownerUser.id,
          action: 'project.agent_instructions.updated',
          targetType: 'project',
          targetId: result.data.id,
          meta: { agent_instructions: result.data.instructions },
        },
        client,
      ),
    );

    revalidatePath(`/project/${projectKey}`);
    revalidatePath('/dashboard');
    return { ok: true as const, message: 'Agent instructions saved.' };
  }

  async function updateDeploySettings(_prevState: unknown, formData: FormData) {
    'use server';
    const ownerUser = await requireOwnerUser();

    const strategy = String(formData.get('deploy_strategy') || '').trim();
    const defaultBranch = String(formData.get('deploy_default_branch') || '').trim();
    const autoPr = String(formData.get('deploy_auto_pr') || '').trim();
    const commitOnReview = String(formData.get('deploy_commit_on_review') || '').trim();
    const squashMerge = String(formData.get('deploy_squash_merge') || '').trim();

    const result = await runUpdateProjectDeploySettingsAction({
      ownerId: ownerUser.id,
      projectId,
      strategy,
      defaultBranch,
      autoPr,
      commitOnReview,
      squashMerge,
    });
    if (!result.ok) {
      return {
        ok: false as const,
        message: result.message || 'Failed to save deployment settings.',
      };
    }

    await withOwnerDb(ownerUser.id, async (client) =>
      writeAuditLog(
        {
          ownerId: ownerUser.id,
          action: 'project.deploy_settings.updated',
          targetType: 'project',
          targetId: result.data.id,
          meta: { deploy_strategy: result.data.settings },
        },
        client,
      ),
    );

    revalidatePath(`/project/${projectKey}`);
    revalidatePath('/dashboard');
    return { ok: true as const, message: 'Deployment strategy saved.' };
  }

  return (
    <ProjectDetailEditPanelProvider
      closeHref={closeHref}
      selectedProject={selectedProjectForEdit}
      updateProjectAction={updateProject}
      labelManagement={labelManagement}
      createLabelAction={createLabel}
      updateLabelAction={updateLabel}
      deleteLabelAction={deleteLabel}
      configurationManagement={configurationManagement}
      updateAgentInstructionsAction={updateAgentInstructions}
      updateDeploySettingsAction={updateDeploySettings}
    >
      <Container
        className={dashboardClassName}
        fluid
        px={{ base: 'sm', sm: 'md', lg: 'lg', xl: 'xl' }}
        py={{ base: 'md', sm: 'xl' }}
      >
        <Stack gap="md" className="dashboard-stack">
          <Breadcrumbs mb="xs">
            <Anchor href="/dashboard" size="sm">
              Dashboard
            </Anchor>
            <Anchor href="/projects" size="sm">
              Projects
            </Anchor>
            <Text size="sm" c="dimmed">
              {project.name}
            </Text>
          </Breadcrumbs>
          <Paper
            withBorder
            radius="lg"
            p={{ base: 'md', sm: 'xl' }}
            className={`${panelStyles.heroPanel} ${styles.detailHero}`}
            data-project-detail-roster="true"
          >
            <Stack gap="lg">
              <div className={styles.detailHeroLayout} data-project-detail-hero-layout="true">
                <Stack gap="lg" className={styles.detailHeroContent}>
                  <Stack gap="sm">
                    <Group gap="xs" className={styles.detailEyebrow}>
                      <span
                        className={styles.detailStatusDot}
                        data-project-status-tone={detailStatusTone}
                        aria-hidden="true"
                      />
                      <Text size="xs" fw={700} tt="uppercase" className={styles.detailEyebrowText}>
                        {projectKey.toUpperCase()}
                      </Text>
                      <Badge
                        color={runningTaskCount > 0 ? 'blue' : 'gray'}
                        variant="light"
                        data-entity-type={getAgentEntityType(terminology)}
                        data-entity-state={getAgentRunStateAttribute('running', terminology)}
                      >
                        {runningAgentLabel}
                      </Badge>
                      <Badge color={projectStatus.color} variant="outline">
                        {projectStatus.label}
                      </Badge>
                    </Group>
                    <Title order={1} className={styles.detailHeroTitle}>
                      {project.name}
                    </Title>
                    <Text className={styles.detailHeroDescription}>{projectHeroDescription}</Text>
                  </Stack>

                  <Group gap="sm" wrap="wrap" className={styles.detailHeroActions}>
                    <LinkButton
                      href={boardHref}
                      leftSection={<IconLayoutKanban size={16} />}
                      className={styles.detailPrimaryAction}
                    >
                      Open Kanban
                    </LinkButton>
                    <LinkButton
                      href={newTaskHref}
                      variant="default"
                      leftSection={<IconPlus size={16} />}
                    >
                      {`New ${terminology.task.singularLower}`}
                    </LinkButton>
                    {hasRepo ? (
                      <Button
                        component="a"
                        href={repoHref ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="subtle"
                        leftSection={<IconExternalLink size={16} />}
                      >
                        Open repo
                      </Button>
                    ) : (
                      <ProjectDetailEditPanelButton
                        variant="subtle"
                        leftSection={<IconExternalLink size={16} />}
                      >
                        Add repo
                      </ProjectDetailEditPanelButton>
                    )}
                  </Group>
                </Stack>

                <div className={styles.detailMetrics} data-project-detail-metrics="true">
                  <div className={styles.detailMetric}>
                    <span>OPEN</span>
                    <strong>{openTaskCount}</strong>
                  </div>
                  <div className={styles.detailMetric}>
                    <span>RUNNING</span>
                    <strong>{runningTaskCount}</strong>
                  </div>
                  <div className={styles.detailMetric}>
                    <span>QUEUED</span>
                    <strong>{queuedTaskCount}</strong>
                  </div>
                  <div className={styles.detailMetric}>
                    <span>DONE</span>
                    <strong>{doneTaskCount}</strong>
                  </div>
                </div>
              </div>
            </Stack>
          </Paper>

          <section id="project-activity" className={panelStyles.sectionAnchor}>
            <Stack gap="md">
              <Paper
                withBorder
                radius="lg"
                p={{ base: 'md', sm: 'lg' }}
                className={`${panelStyles.sectionPanel} ${styles.pipelinePanel}`}
              >
                <SectionTitleWithIcon icon={IconLayoutKanban} mb="sm">
                  {`${terminology.task.plural} · this project`}
                </SectionTitleWithIcon>
                <TaskStatusBar tasks={todos} boardHref={boardHref} newTaskHref={newTaskHref} />
              </Paper>

              <div className={styles.activityEvidence} data-project-detail-activity-panel="true">
                <DashboardYearlyHeatmap
                  data={projectWorkLogYearActivity}
                  title="Activity · last 365 days"
                  variant="projectDetail"
                  rangeLabel="last 365d"
                />

                <Paper
                  withBorder
                  radius="lg"
                  p={{ base: 'md', sm: 'lg' }}
                  className={`${panelStyles.sectionPanel} ${styles.readinessPanel}`}
                >
                  <Group justify="space-between" align="flex-start" gap="xs" mb="sm">
                    <SectionTitleWithIcon icon={IconRocket}>
                      {projectDetailCopy.readiness.sectionTitle}
                    </SectionTitleWithIcon>
                    <Badge color={setupBadgeColor} variant="light">
                      {setupBadgeLabel}
                    </Badge>
                  </Group>
                  <Stack gap="sm">
                    <Text size="sm" className={styles.readinessSummary}>
                      {setupSummary}
                    </Text>

                    <div
                      className={styles.readinessTable}
                      role="table"
                      aria-label={projectDetailCopy.readiness.tableLabel}
                      data-readiness-table="true"
                    >
                      {readinessRows.map((row) => (
                        <div
                          key={row.id}
                          className={styles.readinessRow}
                          role="row"
                          data-readiness-check={row.id}
                        >
                          <Text
                            component="div"
                            size="xs"
                            fw={700}
                            tt="uppercase"
                            className={styles.readinessKey}
                            role="cell"
                          >
                            {row.label}
                          </Text>
                          <div className={styles.readinessStatus} role="cell">
                            <Badge color={row.color} variant="light">
                              {row.status}
                            </Badge>
                          </div>
                          <Text
                            component="div"
                            size="sm"
                            className={styles.readinessCopy}
                            role="cell"
                          >
                            {row.description}
                          </Text>
                        </div>
                      ))}
                    </div>

                    <Group gap="xs" wrap="wrap">
                      {hasRepo ? (
                        <Button
                          component="a"
                          href={repoHref ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="subtle"
                          size="compact-xs"
                        >
                          Open repo
                        </Button>
                      ) : (
                        <ProjectDetailEditPanelButton variant="subtle" size="compact-xs">
                          Add repo
                        </ProjectDetailEditPanelButton>
                      )}
                      <ProjectDetailEditPanelButton variant="subtle" size="compact-xs">
                        Edit Details
                      </ProjectDetailEditPanelButton>
                    </Group>
                  </Stack>
                </Paper>
              </div>

              <Paper
                withBorder
                radius="lg"
                p={{ base: 'md', sm: 'lg' }}
                className={panelStyles.sectionPanel}
              >
                <SectionTitleWithIcon icon={IconClipboardList} mb="sm">
                  Recent work log
                </SectionTitleWithIcon>
                <ProjectWorkLogTimeline
                  projectId={projectId}
                  initialLogs={projectWorkLogPage.workLogs}
                  initialNextOffset={projectWorkLogPage.nextOffset}
                  emptyText="No work logs in this project."
                  emptyState={
                    <EmptyState
                      icon={<IconClipboardList size={24} />}
                      title="No work logs in this project"
                      description="Record your progress by logging work."
                      action={
                        <LinkButton href={newWorkLogHref} size="compact-xs" variant="default">
                          New Work Log
                        </LinkButton>
                      }
                    />
                  }
                />
              </Paper>
            </Stack>
          </section>
        </Stack>
      </Container>
    </ProjectDetailEditPanelProvider>
  );
}
