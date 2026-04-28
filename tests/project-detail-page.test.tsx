import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  getOwnerUserOrNull: vi.fn(),
  getUserSetting: vi.fn(),
  listProjectTaskLabels: vi.fn(),
  listProjectTaskLabelUsageCounts: vi.fn(),
  listWorkLogsPage: vi.fn(),
  notFound: vi.fn(),
  projectEditPanelProps: vi.fn(),
  projectsFindFirst: vi.fn(),
  redirect: vi.fn(),
  requireOwnerUser: vi.fn(),
  resolveAgentInstructions: vi.fn(),
  resolveDeployStrategyConfig: vi.fn(),
  resolveProjectByKey: vi.fn(),
  revalidatePath: vi.fn(),
  tasksFindMany: vi.fn(),
  updateProject: vi.fn(),
  writeAuditLog: vi.fn(),
  db: {
    query: {
      projects: {
        findFirst: vi.fn(),
      },
      tasks: {
        findMany: vi.fn(),
      },
    },
  },
}));

vi.mock('@mantine/core', () => ({
  Anchor: ({ children, href }: { children: React.ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
  Badge: ({
    children,
    color,
    variant,
  }: {
    children: React.ReactNode;
    color?: string;
    variant?: string;
  }) => (
    <div data-color={color ?? ''} data-variant={variant ?? ''}>
      {children}
    </div>
  ),
  Breadcrumbs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    component,
    href,
    rel,
    target,
  }: {
    children: React.ReactNode;
    component?: string;
    href?: string;
    rel?: string;
    target?: string;
  }) =>
    component === 'a' ? (
      <a href={href} rel={rel} target={target}>
        {children}
      </a>
    ) : (
      <button type="button">{children}</button>
    ),
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Paper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SimpleGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ThemeIcon: ({ children, color }: { children: React.ReactNode; color?: string }) => (
    <div data-color={color ?? ''}>{children}</div>
  ),
  Title: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconClipboardList: () => null,
  IconCloud: () => null,
  IconFlag: () => null,
  IconLink: () => null,
  IconListCheck: () => null,
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn(),
  isNull: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocked.revalidatePath,
}));
vi.mock('next/navigation', () => ({
  notFound: mocked.notFound,
  redirect: mocked.redirect,
}));

vi.mock('@/app/components/empty-state', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}));

vi.mock('@/app/components/link-button', () => ({
  LinkButton: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/app/components/markdown-viewer', () => ({
  MarkdownViewer: ({ markdown }: { markdown: string | null }) => (
    <div data-testid="markdown-viewer">{markdown}</div>
  ),
}));

vi.mock('@/app/components/metrics.module.css', () => ({
  default: { metricTile: 'metricTile' },
}));

vi.mock('@/app/components/panels.module.css', () => ({
  default: { heroPanel: 'heroPanel', sectionPanel: 'sectionPanel' },
}));

vi.mock('@/app/components/panels/agent-instructions-panel', () => ({
  AgentInstructionsPanel: () => <div data-testid="agent-instructions-panel" />,
}));

vi.mock('@/app/components/panels/deploy-settings-panel', () => ({
  DeploySettingsPanel: () => <div data-testid="deploy-settings-panel" />,
}));

vi.mock('@/app/components/panels/project-labels-panel', () => ({
  ProjectLabelsPanel: ({
    labels,
  }: {
    labels: Array<{ id: string; name: string; color: string; usageCount: number }>;
  }) => (
    <div
      data-testid="project-labels-panel"
      data-label-count={String(labels.length)}
      data-label-names={labels.map((label) => label.name).join(',')}
      data-label-usage={labels.map((label) => `${label.name}:${label.usageCount}`).join(',')}
    />
  ),
}));

vi.mock('@/app/components/panels/project-edit-panel', () => ({
  ProjectEditPanel: (props: {
    selectedProject: { name: string } | null;
    updateProjectAction: (prevState: unknown, formData: FormData) => Promise<unknown>;
  }) => {
    mocked.projectEditPanelProps(props);
    return (
      <div data-testid="project-edit-panel" data-project-name={props.selectedProject?.name ?? ''} />
    );
  },
}));

vi.mock('@/app/components/project-hero-menu', () => ({
  ProjectHeroMenu: ({
    workLogHref,
    editProjectHref,
    integrationHref,
  }: {
    workLogHref: string;
    editProjectHref: string;
    integrationHref?: string;
  }) => (
    <div
      data-testid="project-hero-menu"
      data-work-log-href={workLogHref}
      data-edit-project-href={editProjectHref}
      data-integration-href={integrationHref ?? ''}
    />
  ),
}));

vi.mock('@/app/components/project-work-log-timeline', () => ({
  ProjectWorkLogTimeline: () => <div data-testid="project-work-log-timeline" />,
}));

vi.mock('@/app/components/task-panel-modal', () => ({
  TaskPanelModal: ({
    children,
    title,
    closeHref,
    size,
  }: {
    children: React.ReactNode;
    title: string;
    closeHref: string;
    size?: string;
  }) => (
    <div
      data-testid="task-panel-modal"
      data-title={title}
      data-close-href={closeHref}
      data-size={size ?? ''}
    >
      {children}
    </div>
  ),
}));

vi.mock('@/app/components/task-status-bar', () => ({
  TaskStatusBar: () => <div data-testid="task-status-bar" />,
}));

vi.mock('@/lib/actions/project-actions', () => ({
  updateProject: mocked.updateProject,
  updateProjectAgentInstructions: vi.fn(),
  updateProjectDeploySettings: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: mocked.writeAuditLog,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback(mocked.db),
}));

vi.mock('@/lib/db/schema', () => ({
  projects: {},
  tasks: {},
}));

vi.mock('@/lib/owner', () => ({
  getOwnerUserOrNull: mocked.getOwnerUserOrNull,
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/project-meta', () => ({
  ACTIVE_PROJECT_STATUS: 'active',
  isProjectStatus: (value: string) => value === 'active' || value === 'paused' || value === 'done',
  PROJECT_STATUS_COLORS: { active: 'blue', paused: 'yellow', done: 'gray' },
  PROJECT_STATUS_LABELS: { active: 'Active', paused: 'Paused', done: 'Done' },
}));

vi.mock('@/lib/project-resolve', () => ({
  resolveProjectByKey: mocked.resolveProjectByKey,
}));

vi.mock('@/lib/project-settings', () => ({
  resolveAgentInstructions: mocked.resolveAgentInstructions,
  resolveDeployStrategyConfig: mocked.resolveDeployStrategyConfig,
}));

vi.mock('@/lib/task-labels', () => ({
  listProjectTaskLabels: mocked.listProjectTaskLabels,
  listProjectTaskLabelUsageCounts: mocked.listProjectTaskLabelUsageCounts,
}));

vi.mock('@/lib/terminology', () => ({
  resolveTerminology: vi.fn(() => ({
    task: { singular: 'Task', singularLower: 'task', plural: 'Tasks', pluralLower: 'tasks' },
  })),
}));

vi.mock('@/lib/user-settings', () => ({
  SETTING_KEYS: { KITCHEN_MODE: 'kitchenMode' },
  getUserSetting: mocked.getUserSetting,
}));

vi.mock('@/lib/work-log-list', () => ({
  listWorkLogsPage: mocked.listWorkLogsPage,
}));

vi.mock('@/lib/work-log-pagination', () => ({
  PROJECT_WORK_LOG_PAGE_SIZE: 20,
}));

import ProjectDetailPage from '@/app/(workspace)/(main)/project/[key]/page';

describe('project detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.db.query.projects.findFirst = mocked.projectsFindFirst;
    mocked.db.query.tasks.findMany = mocked.tasksFindMany;
    mocked.getOwnerUserOrNull.mockResolvedValue({ id: 'owner-1' });
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.resolveProjectByKey.mockResolvedValue({
      id: 'project-1',
      name: 'Project One',
      projectKey: 'PROJ',
      bgImage: null,
      bgImageCredit: null,
    });
    mocked.projectsFindFirst.mockResolvedValue({
      id: 'project-1',
      name: 'Project One',
      projectKey: 'PROJ',
      description: 'Ship the next release.',
      status: 'active',
      priority: 2,
      bgImage: null,
      bgImageCredit: null,
      repoUrl: 'https://github.com/example/repo',
      vercelUrl: 'https://example.vercel.app/',
      updatedAt: new Date('2026-04-24T12:00:00.000Z'),
      projectSettings: [],
    });
    mocked.tasksFindMany.mockResolvedValue([]);
    mocked.getUserSetting.mockResolvedValue('false');
    mocked.listWorkLogsPage.mockResolvedValue({
      workLogs: [],
      nextOffset: null,
    });
    mocked.listProjectTaskLabels.mockResolvedValue([
      { id: 'label-1', projectId: 'project-1', name: 'Bug', color: 'red' },
      { id: 'label-2', projectId: 'project-1', name: 'Feature', color: 'blue' },
    ]);
    mocked.listProjectTaskLabelUsageCounts.mockResolvedValue([
      { labelId: 'label-1', usageCount: 3 },
    ]);
    mocked.updateProject.mockResolvedValue({
      ok: true,
      data: { id: 'project-1', projectKey: 'PROJ', changed: true },
    });
    mocked.resolveAgentInstructions.mockReturnValue('Keep it sharp.');
    mocked.resolveDeployStrategyConfig.mockReturnValue({
      strategy: 'direct_commit',
      default_branch: 'main',
      auto_pr: false,
      commit_on_review: true,
      squash_merge: true,
    });
    mocked.writeAuditLog.mockResolvedValue(undefined);
  });

  it('keeps the hero edit target on the project detail route', async () => {
    const html = renderToStaticMarkup(
      await ProjectDetailPage({
        params: Promise.resolve({ key: 'PROJ' }),
      }),
    );

    expect(html).toContain('data-testid="project-hero-menu"');
    expect(html).toContain('data-edit-project-href="/project/PROJ?panel=project-edit"');
    expect(html).toContain('data-work-log-href="/dashboard?panel=worklog&amp;projectId=project-1"');
    expect(html).toContain('data-integration-href=""');
  });

  it('groups the page into anchored overview, configuration, and activity sections', async () => {
    const html = renderToStaticMarkup(
      await ProjectDetailPage({
        params: Promise.resolve({ key: 'PROJ' }),
      }),
    );

    expect(html).toContain('aria-label="Project sections"');
    expect(html).toContain('data-project-section-nav="true"');
    expect(html).toContain('href="#project-overview"');
    expect(html).toContain('href="#project-configuration"');
    expect(html).toContain('href="#project-activity"');
    expect(html).toContain('id="project-overview"');
    expect(html).toContain('id="project-configuration"');
    expect(html).toContain('id="project-activity"');
    expect(html).toContain('>Configuration<');
    expect(html).toContain('>Activity<');
    expect(html).toContain('Edit Details');
    expect(html).toContain('href="/project/PROJ?panel=project-edit"');
    expect(html).toContain('href="/board/PROJ"');
    expect(html).toContain('href="/dashboard?panel=task&amp;projectId=project-1"');
    expect(html).toContain('href="/dashboard?panel=worklog&amp;projectId=project-1"');
  });

  it('renders project editing inside the shared modal shell on the detail route', async () => {
    const html = renderToStaticMarkup(
      await ProjectDetailPage({
        params: Promise.resolve({ key: 'PROJ' }),
        searchParams: Promise.resolve({ panel: 'project-edit' }),
      } as never),
    );

    expect(html).toContain('data-testid="task-panel-modal"');
    expect(html).toContain('data-title="Edit Project"');
    expect(html).toContain('data-close-href="/project/PROJ"');
    expect(html).toContain('data-size="58rem"');
    expect(html).toContain('data-testid="project-edit-panel"');
    expect(html).toContain('data-project-name="Project One"');
  });

  it('renders the project-owned labels panel on the detail page', async () => {
    const html = renderToStaticMarkup(
      await ProjectDetailPage({
        params: Promise.resolve({ key: 'PROJ' }),
      }),
    );

    expect(html).toContain('data-testid="project-labels-panel"');
    expect(html).toContain('data-label-count="2"');
    expect(html).toContain('data-label-names="Bug,Feature"');
    expect(html).toContain('Each label change stays local until you save it.');
    expect(html).toContain('Changes stay local until you save them to the project.');
    expect(html).toContain('data-label-usage="Bug:3,Feature:0"');
    expect(html).toContain('Keep labels close to the work they belong to in this project.');
  });

  it('surfaces a dispatch-ready setup summary when repo, deploy rules, instructions, and recent activity exist', async () => {
    mocked.resolveDeployStrategyConfig.mockReturnValueOnce({
      strategy: 'feature_branch',
      default_branch: 'main',
      auto_pr: true,
      commit_on_review: true,
      squash_merge: false,
    });
    mocked.tasksFindMany.mockResolvedValueOnce([{ status: 'todo' }]);
    mocked.listWorkLogsPage.mockResolvedValueOnce({
      workLogs: [
        {
          id: 'log-1',
          title: 'Shipped detail page improvements',
          detail: null,
          engine: 'codex',
          workedAt: new Date('2026-04-26T10:00:00.000Z'),
        },
      ],
      nextOffset: null,
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T12:00:00.000Z'));

    let html = '';
    try {
      html = renderToStaticMarkup(
        await ProjectDetailPage({
          params: Promise.resolve({ key: 'PROJ' }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }

    expect(html).toContain('Setup health');
    expect(html).toContain('Dispatch-ready');
    expect(html).toContain('4 of 4 setup checks are ready.');
    expect(html).toContain('Repository linked for branch and PR work.');
    expect(html).toContain('Feature Branch to main. Auto-create a PR and push before review.');
    expect(html).toContain('Instructions saved for dispatched agents.');
    expect(html).toContain('Last recorded work on 2026-04-26.');
    expect(html).toContain('1 open Task');
    expect(html).not.toContain('1 open Tasks');
    expect(html).toContain(
      'href="https://github.com/example/repo" rel="noopener noreferrer" target="_blank"',
    );
  });

  it('uses the neutral recent-activity color for inactive projects with work logs', async () => {
    mocked.projectsFindFirst.mockResolvedValueOnce({
      id: 'project-1',
      name: 'Project One',
      projectKey: 'PROJ',
      description: 'Ship the next release.',
      status: 'paused',
      priority: 2,
      bgImage: null,
      bgImageCredit: null,
      repoUrl: 'https://github.com/example/repo',
      vercelUrl: 'https://example.vercel.app/',
      updatedAt: new Date('2026-04-24T12:00:00.000Z'),
      projectSettings: [],
    });
    mocked.listWorkLogsPage.mockResolvedValueOnce({
      workLogs: [
        {
          id: 'log-1',
          title: 'Paused while waiting on feedback',
          detail: null,
          engine: 'codex',
          workedAt: new Date('2026-04-26T10:00:00.000Z'),
        },
      ],
      nextOffset: null,
    });

    const html = renderToStaticMarkup(
      await ProjectDetailPage({
        params: Promise.resolve({ key: 'PROJ' }),
      }),
    );

    expect(html).toContain('data-color="gray" data-variant="light">Inactive - no recent work logs');
    expect(html).not.toContain(
      'data-color="red" data-variant="light">Inactive - no recent work logs',
    );
  });

  it('surfaces explicit next steps when critical setup is missing', async () => {
    mocked.projectsFindFirst.mockResolvedValueOnce({
      id: 'project-1',
      name: 'Project One',
      projectKey: 'PROJ',
      description: 'Ship the next release.',
      status: 'active',
      priority: 2,
      bgImage: null,
      bgImageCredit: null,
      repoUrl: '',
      vercelUrl: '',
      updatedAt: new Date('2026-04-24T12:00:00.000Z'),
      projectSettings: [],
    });
    mocked.resolveAgentInstructions.mockReturnValueOnce(null);
    mocked.resolveDeployStrategyConfig.mockReturnValueOnce({
      strategy: 'direct_commit',
      default_branch: 'main',
      auto_pr: false,
      commit_on_review: true,
      squash_merge: true,
    });

    const html = renderToStaticMarkup(
      await ProjectDetailPage({
        params: Promise.resolve({ key: 'PROJ' }),
      }),
    );

    expect(html).toContain('Needs attention');
    expect(html).toContain('1 of 4 setup checks are ready.');
    expect(html).toContain(
      'Add the repository URL in Edit Details before dispatching coding work.',
    );
    expect(html).toContain('Direct Commit');
    expect(html).toContain('Direct Commit to main. Push before review.');
    expect(html).toContain('Add agent instructions so workers inherit project-specific rules.');
    expect(html).toContain('No work logs yet. Last project update 2026-04-24.');
    expect(html).toContain('href="/project/PROJ?panel=project-edit"');
    expect(html).toContain('href="/dashboard?panel=worklog&amp;projectId=project-1"');
    expect(html).not.toContain('Review settings');
  });

  it('updates the project detail modal in place without redirecting to the dashboard', async () => {
    renderToStaticMarkup(
      await ProjectDetailPage({
        params: Promise.resolve({ key: 'PROJ' }),
        searchParams: Promise.resolve({ panel: 'project-edit' }),
      } as never),
    );

    const projectEditPanelProps = mocked.projectEditPanelProps.mock.calls[0]?.[0] as {
      updateProjectAction: (prevState: unknown, formData: FormData) => Promise<unknown>;
    };
    const formData = new FormData();
    formData.set('projectId', 'project-1');
    formData.set('name', 'Project One Updated');
    formData.set('status', 'active');
    formData.set('priority', '4');
    formData.set('descriptionMd', 'Updated detail');
    formData.set('bgImage', 'mountains');
    formData.set('bgImageCredit', '');
    formData.set('repoUrl', 'https://github.com/example/project-one');
    formData.set('vercelUrl', 'https://project-one.vercel.app');

    const result = await projectEditPanelProps.updateProjectAction(null, formData);

    expect(mocked.updateProject).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      projectId: 'project-1',
      name: 'Project One Updated',
      status: 'active',
      priority: 4,
      descriptionMd: 'Updated detail',
      bgImage: 'mountains',
      bgImageCredit: '',
      repoUrl: 'https://github.com/example/project-one',
      vercelUrl: 'https://project-one.vercel.app',
    });
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'project.updated',
        targetType: 'project',
        targetId: 'project-1',
        meta: { projectKey: 'PROJ' },
      }),
      mocked.db,
    );
    expect(mocked.revalidatePath).toHaveBeenCalledWith('/project/PROJ');
    expect(mocked.revalidatePath).toHaveBeenCalledWith('/projects');
    expect(mocked.revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(mocked.revalidatePath).toHaveBeenCalledWith('/board/PROJ');
    expect(mocked.redirect).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });
});
