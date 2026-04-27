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
import {
  IconClipboardList,
  IconCloud,
  IconFlag,
  IconLink,
  IconListCheck,
} from '@tabler/icons-react';
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
import { isProjectStatus, PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS } from '@/lib/project-meta';
import { resolveProjectByKey } from '@/lib/project-resolve';
import { resolveAgentInstructions, resolveDeployStrategyConfig } from '@/lib/project-settings';
import { listProjectTaskLabels, listProjectTaskLabelUsageCounts } from '@/lib/task-labels';
import { normalizeTaskLabelColor, parseTaskLabelColor } from '@/lib/task-meta';
import { resolveTerminology } from '@/lib/terminology';
import { getUserSetting, SETTING_KEYS } from '@/lib/user-settings';
import { listWorkLogsPage } from '@/lib/work-log-list';
import { PROJECT_WORK_LOG_PAGE_SIZE } from '@/lib/work-log-pagination';

type ProjectDetailPageProps = {
  params: Promise<{ key: string }>;
  searchParams?: Promise<{ panel?: string }>;
};

function projectStatusBadge(status: string) {
  if (!isProjectStatus(status)) {
    return { color: 'gray', label: status };
  }

  return {
    color: PROJECT_STATUS_COLORS[status],
    label: PROJECT_STATUS_LABELS[status],
  };
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

  const openTaskCount = todos.filter(
    (t) =>
      t.status === 'inbox' || t.status === 'todo' || t.status === 'hold' || t.status === 'ready',
  ).length;

  const agentInstructions = resolveAgentInstructions(project.projectSettings);
  const deployStrategy = resolveDeployStrategyConfig(project.projectSettings);

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
                <LinkButton href={`/board/${projectKey}`} variant="default">
                  Open Kanban
                </LinkButton>
                <LinkButton href={`/dashboard?panel=task&projectId=${projectId}`}>
                  {`New ${terminology.task.singular}`}
                </LinkButton>
                <ProjectHeroMenu
                  workLogHref={`/dashboard?panel=worklog&projectId=${projectId}`}
                  editProjectHref={`/project/${projectKey}?panel=project-edit`}
                />
              </Group>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="sm">
              <Paper
                withBorder
                p="sm"
                radius="md"
                className={metricStyles.metricTile}
                style={{ borderLeft: `3px solid var(--mantine-color-${projectStatus.color}-6)` }}
              >
                <Group gap="xs" align="flex-start" mb={6}>
                  <ThemeIcon variant="light" color={projectStatus.color} size="sm" radius="xl">
                    <IconFlag size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">
                    Status
                  </Text>
                </Group>
                <Badge color={projectStatus.color} variant="light">
                  {projectStatus.label}
                </Badge>
              </Paper>
              <Paper
                withBorder
                p="sm"
                radius="md"
                className={metricStyles.metricTile}
                style={{
                  borderLeft:
                    openTaskCount === 0
                      ? '3px solid var(--mantine-color-gray-4)'
                      : '3px solid var(--mantine-color-blue-6)',
                }}
              >
                <Group gap="xs" align="flex-start">
                  <ThemeIcon
                    variant="light"
                    color={openTaskCount === 0 ? 'gray' : 'blue'}
                    size="sm"
                    radius="xl"
                  >
                    <IconListCheck size={14} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700} fz="xl" c={openTaskCount === 0 ? 'dimmed' : undefined}>
                      {openTaskCount}
                    </Text>
                    <Text fw={600} size="sm" c="dimmed">
                      {`Open ${terminology.task.plural}`}
                    </Text>
                  </div>
                </Group>
              </Paper>
              <Paper
                withBorder
                p="sm"
                radius="md"
                className={metricStyles.metricTile}
                style={{
                  borderLeft: project.repoUrl
                    ? '3px solid var(--mantine-color-blue-6)'
                    : '3px solid var(--mantine-color-gray-4)',
                }}
              >
                <Group gap="xs" align="flex-start" mb={6}>
                  <ThemeIcon
                    variant="light"
                    color={project.repoUrl ? 'blue' : 'gray'}
                    size="sm"
                    radius="xl"
                  >
                    <IconLink size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">
                    Repo
                  </Text>
                </Group>
                <Group gap="xs" wrap="wrap">
                  <Badge color={project.repoUrl ? 'blue' : 'gray'} variant="light">
                    {project.repoUrl ? 'Linked' : 'Not linked'}
                  </Badge>
                  {project.repoUrl ? (
                    <Button
                      component="a"
                      href={project.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      variant="subtle"
                      size="compact-xs"
                    >
                      Open
                    </Button>
                  ) : null}
                </Group>
              </Paper>
              <Paper
                withBorder
                p="sm"
                radius="md"
                className={metricStyles.metricTile}
                style={{
                  borderLeft: project.vercelUrl
                    ? '3px solid var(--mantine-color-blue-6)'
                    : '3px solid var(--mantine-color-gray-4)',
                }}
              >
                <Group gap="xs" align="flex-start" mb={6}>
                  <ThemeIcon
                    variant="light"
                    color={project.vercelUrl ? 'blue' : 'gray'}
                    size="sm"
                    radius="xl"
                  >
                    <IconCloud size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">
                    Vercel
                  </Text>
                </Group>
                <Group gap="xs" wrap="wrap">
                  <Badge color={project.vercelUrl ? 'blue' : 'gray'} variant="light">
                    {project.vercelUrl ? 'Linked' : 'Not linked'}
                  </Badge>
                  {project.vercelUrl ? (
                    <Button
                      component="a"
                      href={project.vercelUrl}
                      target="_blank"
                      rel="noreferrer"
                      variant="subtle"
                      size="compact-xs"
                    >
                      Open
                    </Button>
                  ) : null}
                </Group>
              </Paper>
            </SimpleGrid>
          </Stack>
        </Paper>

        <Paper
          withBorder
          radius="lg"
          p={{ base: 'md', sm: 'lg' }}
          className={panelStyles.sectionPanel}
        >
          <Title order={3}>Overview</Title>
          <MarkdownViewer
            markdown={project.description}
            persistence={{ endpoint: `/api/projects/${project.id}`, field: 'description' }}
          />
        </Paper>

        <Paper
          withBorder
          radius="lg"
          p={{ base: 'md', sm: 'lg' }}
          className={panelStyles.sectionPanel}
        >
          <Title order={3} mb="sm">
            Labels
          </Title>
          <Text c="dimmed" size="sm" mb="md">
            Keep labels close to the work they belong to in this project.
          </Text>
          <ProjectLabelsPanel
            labels={labels}
            taskPluralLower={terminology.task.plural.toLowerCase()}
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
          <Title order={3} mb="sm">
            Agent Instructions
          </Title>
          <Text c="dimmed" size="sm" mb="md">
            Add short project guidance that PREQ agents can read after `preq_get_task`.
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
          <Title order={3} mb="sm">
            Deployment Strategy
          </Title>
          <Text c="dimmed" size="sm" mb="md">
            Configure deployment behavior for external PREQSTATION skills.
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

        <Paper
          withBorder
          radius="lg"
          p={{ base: 'md', sm: 'lg' }}
          className={panelStyles.sectionPanel}
        >
          <Title order={3} mb="sm">
            {`${terminology.task.singular} Pipeline`}
          </Title>
          <TaskStatusBar
            tasks={todos}
            boardHref={`/board/${projectKey}`}
            newTaskHref={`/dashboard?panel=task&projectId=${projectId}`}
          />
        </Paper>

        <Paper
          withBorder
          radius="lg"
          p={{ base: 'md', sm: 'lg' }}
          className={panelStyles.sectionPanel}
        >
          <Title order={3} mb="sm">
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
                  <LinkButton
                    href={`/dashboard?panel=worklog&projectId=${projectId}`}
                    size="compact-xs"
                    variant="default"
                  >
                    New Work Log
                  </LinkButton>
                }
              />
            }
          />
        </Paper>

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
