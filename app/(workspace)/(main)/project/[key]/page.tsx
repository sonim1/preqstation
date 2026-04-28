import {
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconClipboardList, IconCloud, IconFlag, IconLink } from '@tabler/icons-react';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';

import { EmptyState } from '@/app/components/empty-state';
import { LinkButton } from '@/app/components/link-button';
import { MarkdownViewer } from '@/app/components/markdown-viewer';
import metricStyles from '@/app/components/metrics.module.css';
import panelStyles from '@/app/components/panels.module.css';
import { AgentInstructionsPanel } from '@/app/components/panels/agent-instructions-panel';
import { DeploySettingsPanel } from '@/app/components/panels/deploy-settings-panel';
import { ProjectLabelsPanel } from '@/app/components/panels/project-labels-panel';
import { ProjectEditModal } from '@/app/components/project-edit-modal';
import { ProjectHeroMenu } from '@/app/components/project-hero-menu';
import { ProjectWorkLogTimeline } from '@/app/components/project-work-log-timeline';
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
import { getOwnerUserOrNull, requireOwnerUser } from '@/lib/owner';
import { getProjectActivityStatus } from '@/lib/project-activity';
import { isProjectStatus, PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS } from '@/lib/project-meta';
import { resolveProjectByKey } from '@/lib/project-resolve';
import { resolveAgentInstructions, resolveDeployStrategyConfig } from '@/lib/project-settings';
import { listProjectTaskLabels, listProjectTaskLabelUsageCounts } from '@/lib/task-labels';
import { normalizeTaskLabelColor, parseTaskLabelColor } from '@/lib/task-meta';
import { resolveTerminology } from '@/lib/terminology';
import { getUserSetting, SETTING_KEYS } from '@/lib/user-settings';
import { listWorkLogsPage } from '@/lib/work-log-list';
import { PROJECT_WORK_LOG_PAGE_SIZE } from '@/lib/work-log-pagination';

import { ProjectSectionAnchorOffset } from './project-section-anchor-offset';

type ProjectDetailPageProps = {
  params: Promise<{ key: string }>;
  searchParams?: Promise<{ panel?: string }>;
};

const DEPLOY_STRATEGY_LABELS = {
  direct_commit: 'Direct Commit',
  feature_branch: 'Feature Branch',
  none: 'None',
} as const;

function projectStatusBadge(status: string) {
  if (!isProjectStatus(status)) {
    return { color: 'gray', label: status };
  }

  return {
    color: PROJECT_STATUS_COLORS[status],
    label: PROJECT_STATUS_LABELS[status],
  };
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

function joinWithAnd(values: string[]) {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function describeDeployStrategy(config: ReturnType<typeof resolveDeployStrategyConfig>) {
  const strategyLabel = DEPLOY_STRATEGY_LABELS[config.strategy];
  if (config.strategy === 'none') {
    return 'Choose a deployment strategy in Configuration before dispatching work.';
  }

  if (config.strategy === 'feature_branch') {
    const reviewNote = config.commit_on_review
      ? 'Push before review.'
      : 'Review can happen before push.';
    return config.auto_pr
      ? `${strategyLabel} to ${config.default_branch}. Auto-create a PR and ${reviewNote.toLowerCase()}`
      : `${strategyLabel} to ${config.default_branch}. ${reviewNote}`;
  }

  return config.commit_on_review
    ? `${strategyLabel} to ${config.default_branch}. Push before review.`
    : `${strategyLabel} to ${config.default_branch}. Review can happen before push.`;
}

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const owner = await getOwnerUserOrNull();
  if (!owner) redirect('/login?reason=auth');

  const { key } = await params;
  const panelParams = searchParams ? await searchParams : {};
  const resolved = await withOwnerDb(owner.id, async (client) =>
    resolveProjectByKey(owner.id, key, client),
  );
  if (!resolved) notFound();

  const [project, kitchenMode, todos, rawLabels, labelUsageCounts, projectWorkLogPage] =
    await withOwnerDb(owner.id, async (client) =>
      Promise.all([
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
      ]),
    );

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
  const activePanel = panelParams.panel === 'project-edit' ? 'project-edit' : null;
  const closeHref = `/project/${projectKey}`;
  const projectStatus = projectStatusBadge(project.status);
  const dashboardClassName = 'dashboard-root';
  const terminology = resolveTerminology(kitchenMode === 'true');
  const boardHref = `/board/${projectKey}`;
  const newTaskHref = `/dashboard?panel=task&projectId=${projectId}`;
  const newWorkLogHref = `/dashboard?panel=worklog&projectId=${projectId}`;
  const editProjectHref = `/project/${projectKey}?panel=project-edit`;

  const openTaskCount = todos.filter(
    (t) =>
      t.status === 'inbox' || t.status === 'todo' || t.status === 'hold' || t.status === 'ready',
  ).length;
  const openTaskLabel = openTaskCount === 1 ? terminology.task.singular : terminology.task.plural;

  const agentInstructions = resolveAgentInstructions(project.projectSettings);
  const deployStrategy = resolveDeployStrategyConfig(project.projectSettings);
  const trimmedAgentInstructions = agentInstructions?.trim() ?? '';
  const hasAgentInstructions = trimmedAgentInstructions.length > 0;
  const hasRepo = Boolean(project.repoUrl);
  const hasDeployStrategy = deployStrategy.strategy !== 'none';
  const latestWorkLog = projectWorkLogPage.workLogs[0] ?? null;
  const lastWorkedAt = toValidDate(latestWorkLog?.workedAt);
  const lastProjectUpdate = toValidDate(project.updatedAt);
  const activityStatus = getProjectActivityStatus({
    projectStatus: project.status,
    lastWorkedAt,
  });
  const hasRecentActivity =
    lastWorkedAt !== null &&
    (activityStatus.status === 'healthy' || activityStatus.status === 'warning');
  const setupReadyCount = [
    hasRepo,
    hasDeployStrategy,
    hasAgentInstructions,
    hasRecentActivity,
  ].filter(Boolean).length;
  const missingSetupItems = [
    hasRepo ? null : 'repository',
    hasDeployStrategy ? null : 'deployment strategy',
    hasAgentInstructions ? null : 'agent instructions',
    hasRecentActivity ? null : 'recent activity',
  ].filter((value): value is string => Boolean(value));
  const setupBadgeColor =
    setupReadyCount === 4 ? 'green' : setupReadyCount === 0 ? 'red' : 'yellow';
  const setupBadgeLabel =
    setupReadyCount === 4
      ? 'Dispatch-ready'
      : setupReadyCount === 0
        ? 'Setup missing'
        : 'Needs attention';
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
      ? '4 of 4 setup checks are ready. Repo, deploy rules, agent instructions, and recent activity are all visible.'
      : `${setupReadyCount} of 4 setup checks are ready. Next: ${joinWithAnd(missingSetupItems)}.`;
  const recentActivityDescription = !lastWorkedAt
    ? `No work logs yet. Last project update ${formatUtcDate(lastProjectUpdate) ?? 'unknown'}.`
    : activityStatus.status === 'critical'
      ? `No work log update in over 7 days. Last recorded work on ${formatUtcDate(lastWorkedAt)}.`
      : `Last recorded work on ${formatUtcDate(lastWorkedAt)}.`;

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
          className={panelStyles.heroPanel}
        >
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <div>
                <Title order={2} size="h3">
                  {project.name}
                </Title>
                <Badge mt={6} variant="outline" color="indigo" w="fit-content">
                  Key {projectKey.toUpperCase()}
                </Badge>
                <Text c="dimmed" size="sm">
                  Project detail and delivery status
                </Text>
              </div>
              <Group gap="xs" wrap="wrap">
                <LinkButton href={boardHref} variant="default">
                  Open Kanban
                </LinkButton>
                <LinkButton href={newTaskHref}>{`New ${terminology.task.singular}`}</LinkButton>
                <LinkButton href={editProjectHref} variant="default">
                  Edit Details
                </LinkButton>
                <ProjectHeroMenu workLogHref={newWorkLogHref} editProjectHref={editProjectHref} />
              </Group>
            </Group>

            <Paper
              withBorder
              p="md"
              radius="md"
              className={metricStyles.metricTile}
              style={{
                borderLeft: `4px solid var(--mantine-color-${setupBadgeColor}-6)`,
              }}
            >
              <Stack gap="xs">
                <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
                  <div>
                    <Text fw={700} size="xs" c="dimmed" tt="uppercase">
                      Setup health
                    </Text>
                    <Title order={3} size="h5">
                      {setupReadyCount === 4 ? 'Ready to dispatch work' : 'Finish project setup'}
                    </Title>
                  </div>
                  <Badge color={setupBadgeColor} variant="light">
                    {setupBadgeLabel}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  {setupSummary}
                </Text>
                <Group gap="xs" wrap="wrap">
                  <Badge color={projectStatus.color} variant="light">
                    {projectStatus.label}
                  </Badge>
                  <Badge color={openTaskCount === 0 ? 'gray' : 'blue'} variant="light">
                    {`${openTaskCount} open ${openTaskLabel}`}
                  </Badge>
                </Group>
              </Stack>
            </Paper>

            <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="sm">
              <Paper
                withBorder
                p="sm"
                radius="md"
                className={metricStyles.metricTile}
                style={{
                  borderLeft: hasRepo
                    ? '3px solid var(--mantine-color-blue-6)'
                    : '3px solid var(--mantine-color-gray-4)',
                }}
              >
                <Group gap="xs" align="flex-start" mb={6}>
                  <ThemeIcon
                    variant="light"
                    color={hasRepo ? 'blue' : 'gray'}
                    size="sm"
                    radius="xl"
                  >
                    <IconLink size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">
                    Repository
                  </Text>
                </Group>
                <Stack gap={8} align="flex-start">
                  <Badge color={hasRepo ? 'blue' : 'gray'} variant="light">
                    {hasRepo ? 'Connected' : 'Missing'}
                  </Badge>
                  <Text size="sm" c="dimmed">
                    {hasRepo
                      ? 'Repository linked for branch and PR work.'
                      : 'Add the repository URL in Edit Details before dispatching coding work.'}
                  </Text>
                  <Button
                    component="a"
                    href={hasRepo ? (project.repoUrl ?? editProjectHref) : editProjectHref}
                    target={hasRepo ? '_blank' : undefined}
                    rel={hasRepo ? 'noopener noreferrer' : undefined}
                    variant="subtle"
                    size="compact-xs"
                  >
                    {hasRepo ? 'Open' : 'Edit Details'}
                  </Button>
                </Stack>
              </Paper>
              <Paper
                withBorder
                p="sm"
                radius="md"
                className={metricStyles.metricTile}
                style={{
                  borderLeft: hasDeployStrategy
                    ? '3px solid var(--mantine-color-blue-6)'
                    : '3px solid var(--mantine-color-gray-4)',
                }}
              >
                <Group gap="xs" align="flex-start" mb={6}>
                  <ThemeIcon
                    variant="light"
                    color={hasDeployStrategy ? 'blue' : 'gray'}
                    size="sm"
                    radius="xl"
                  >
                    <IconCloud size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">
                    Deployment
                  </Text>
                </Group>
                <Stack gap={8} align="flex-start">
                  <Badge color={hasDeployStrategy ? 'blue' : 'gray'} variant="light">
                    {hasDeployStrategy
                      ? DEPLOY_STRATEGY_LABELS[deployStrategy.strategy]
                      : 'Missing'}
                  </Badge>
                  <Text size="sm" c="dimmed">
                    {describeDeployStrategy(deployStrategy)}
                  </Text>
                  {!hasDeployStrategy ? (
                    <Button
                      component="a"
                      href="#project-configuration"
                      variant="subtle"
                      size="compact-xs"
                    >
                      Review settings
                    </Button>
                  ) : null}
                </Stack>
              </Paper>
              <Paper
                withBorder
                p="sm"
                radius="md"
                className={metricStyles.metricTile}
                style={{
                  borderLeft: hasAgentInstructions
                    ? '3px solid var(--mantine-color-blue-6)'
                    : '3px solid var(--mantine-color-gray-4)',
                }}
              >
                <Group gap="xs" align="flex-start" mb={6}>
                  <ThemeIcon
                    variant="light"
                    color={hasAgentInstructions ? 'blue' : 'gray'}
                    size="sm"
                    radius="xl"
                  >
                    <IconClipboardList size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">
                    Agent instructions
                  </Text>
                </Group>
                <Stack gap={8} align="flex-start">
                  <Badge color={hasAgentInstructions ? 'blue' : 'gray'} variant="light">
                    {hasAgentInstructions ? 'Configured' : 'Missing'}
                  </Badge>
                  <Text size="sm" c="dimmed">
                    {hasAgentInstructions
                      ? 'Instructions saved for dispatched agents.'
                      : 'Add agent instructions so workers inherit project-specific rules.'}
                  </Text>
                  {!hasAgentInstructions ? (
                    <Button
                      component="a"
                      href="#project-configuration"
                      variant="subtle"
                      size="compact-xs"
                    >
                      Add instructions
                    </Button>
                  ) : null}
                </Stack>
              </Paper>
              <Paper
                withBorder
                p="sm"
                radius="md"
                className={metricStyles.metricTile}
                style={{
                  borderLeft: lastWorkedAt
                    ? `3px solid ${activityStatus.color}`
                    : '3px solid var(--mantine-color-gray-4)',
                }}
              >
                <Group gap="xs" align="flex-start" mb={6}>
                  <ThemeIcon variant="light" color={recentActivityBadgeColor} size="sm" radius="xl">
                    <IconFlag size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">
                    Recent activity
                  </Text>
                </Group>
                <Stack gap={8} align="flex-start">
                  <Badge color={recentActivityBadgeColor} variant="light">
                    {lastWorkedAt ? activityStatus.label : 'No work logs'}
                  </Badge>
                  <Text size="sm" c="dimmed">
                    {recentActivityDescription}
                  </Text>
                  {!hasRecentActivity ? (
                    <Button component="a" href={newWorkLogHref} variant="subtle" size="compact-xs">
                      New Work Log
                    </Button>
                  ) : null}
                </Stack>
              </Paper>
            </SimpleGrid>
          </Stack>
        </Paper>

        <ProjectSectionAnchorOffset />

        <nav aria-label="Project sections" data-project-section-nav="true">
          <Paper
            withBorder
            radius="lg"
            p={{ base: 'sm', sm: 'md' }}
            className={`${panelStyles.sectionPanel} ${panelStyles.sectionNav}`}
          >
            <div className={panelStyles.sectionNavLayout}>
              <div className={panelStyles.sectionNavLinks}>
                <Anchor href="#project-overview" size="sm">
                  Overview
                </Anchor>
                <Anchor href="#project-configuration" size="sm">
                  Configuration
                </Anchor>
                <Anchor href="#project-activity" size="sm">
                  Activity
                </Anchor>
              </div>
              <div className={panelStyles.sectionNavActions}>
                <LinkButton href={boardHref} size="compact-sm" variant="default">
                  Open Kanban
                </LinkButton>
                <LinkButton href={newTaskHref} size="compact-sm">
                  {`New ${terminology.task.singular}`}
                </LinkButton>
                <LinkButton href={newWorkLogHref} size="compact-sm" variant="default">
                  New Work Log
                </LinkButton>
              </div>
            </div>
          </Paper>
        </nav>

        <section id="project-overview" className={panelStyles.sectionAnchor}>
          <Stack gap="md">
            <Group justify="space-between" align="flex-end" wrap="wrap" gap="xs">
              <div>
                <Title order={3}>Overview</Title>
                <Text c="dimmed" size="sm">
                  Keep the current goal and project context in one place.
                </Text>
              </div>
            </Group>
            <Paper
              withBorder
              radius="lg"
              p={{ base: 'md', sm: 'lg' }}
              className={panelStyles.sectionPanel}
            >
              <MarkdownViewer
                markdown={project.description}
                persistence={{ endpoint: `/api/projects/${project.id}`, field: 'description' }}
              />
            </Paper>
          </Stack>
        </section>

        <section id="project-configuration" className={panelStyles.sectionAnchor}>
          <Stack gap="md">
            <Group justify="space-between" align="flex-end" wrap="wrap" gap="xs">
              <div>
                <Title order={3}>Configuration</Title>
                <Text c="dimmed" size="sm">
                  Manage project metadata, labels, and agent behavior together.
                </Text>
              </div>
              <LinkButton href={editProjectHref} variant="default" size="compact-sm">
                Edit Details
              </LinkButton>
            </Group>

            <Paper
              withBorder
              radius="lg"
              p={{ base: 'md', sm: 'lg' }}
              className={panelStyles.sectionPanel}
            >
              <Title order={4} mb="sm">
                Labels
              </Title>
              <Text c="dimmed" size="sm" mb="md">
                Keep labels close to the work they belong to in this project. Each label change
                stays local until you save it.
              </Text>
              <ProjectLabelsPanel
                labels={labels}
                taskSingularLower={terminology.task.singularLower}
                taskPluralLower={terminology.task.pluralLower}
                createLabelAction={createLabel}
                updateLabelAction={updateLabel}
                deleteLabelAction={deleteLabel}
              />
            </Paper>

            <Paper
              withBorder
              radius="lg"
              p={{ base: 'md', sm: 'lg' }}
              className={panelStyles.sectionPanel}
            >
              <Title order={4} mb="sm">
                Agent Instructions
              </Title>
              <Text c="dimmed" size="sm" mb="md">
                Add short project guidance that PREQ agents can read after `preq_get_task`.
                Changes stay local until you save them to the project.
              </Text>
              <AgentInstructionsPanel
                action={updateAgentInstructions}
                projectId={projectId}
                value={agentInstructions}
              />
            </Paper>

            <Paper
              withBorder
              radius="lg"
              p={{ base: 'md', sm: 'lg' }}
              className={panelStyles.sectionPanel}
            >
              <Title order={4} mb="sm">
                Deployment Strategy
              </Title>
              <Text c="dimmed" size="sm" mb="md">
                Configure deployment behavior for external PREQSTATION skills. Changes stay local
                until you save them to the project.
              </Text>
              <DeploySettingsPanel
                action={updateDeploySettings}
                singleProject
                defaultProjectId={projectId}
                projects={[
                  {
                    id: projectId,
                    name: project.name,
                    deployStrategy,
                  },
                ]}
              />
            </Paper>
          </Stack>
        </section>

        <section id="project-activity" className={panelStyles.sectionAnchor}>
          <Stack gap="md">
            <Group align="flex-end" gap="xs">
              <div>
                <Title order={3}>Activity</Title>
                <Text c="dimmed" size="sm">
                  Jump into the board, capture work, and review recent progress.
                </Text>
              </div>
            </Group>

            <Paper
              withBorder
              radius="lg"
              p={{ base: 'md', sm: 'lg' }}
              className={panelStyles.sectionPanel}
            >
              <Title order={4} mb="sm">
                {`${terminology.task.singular} Pipeline`}
              </Title>
              <TaskStatusBar tasks={todos} boardHref={boardHref} newTaskHref={newTaskHref} />
            </Paper>

            <Paper
              withBorder
              radius="lg"
              p={{ base: 'md', sm: 'lg' }}
              className={panelStyles.sectionPanel}
            >
              <Title order={4} mb="sm">
                Work Logs
              </Title>
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

        {activePanel === 'project-edit' ? (
          <ProjectEditModal
            closeHref={closeHref}
            selectedProject={{
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
            }}
            updateProjectAction={updateProject}
          />
        ) : null}
      </Stack>
    </Container>
  );
}
