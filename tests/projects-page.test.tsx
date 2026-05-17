import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();

  return {
    ...actual,
    SimpleGrid: ({
      children,
      cols,
      spacing: _spacing,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      children: React.ReactNode;
      cols?: number | Partial<Record<'base' | 'sm' | 'md' | 'lg' | 'xl', number>>;
      spacing?: unknown;
    }) => {
      const colMap = typeof cols === 'number' ? { base: cols } : (cols ?? {});

      return (
        <div
          {...props}
          data-simple-grid="true"
          data-cols-base={colMap.base}
          data-cols-sm={colMap.sm}
          data-cols-md={colMap.md}
          data-cols-lg={colMap.lg}
          data-cols-xl={colMap.xl}
        >
          {children}
        </div>
      );
    },
  };
});

const mocked = vi.hoisted(() => {
  const state = {
    projects: [] as Array<{
      id: string;
      name: string;
      projectKey: string;
      description: string | null;
      status: string;
      updatedAt: Date;
      repoUrl?: string | null;
      vercelUrl?: string | null;
      bgImage: string | null;
      bgImageCredit: unknown;
      deletedAt: Date | null;
      projectSettings: Array<{ key: string; value: string }>;
    }>,
    statusCounts: [] as Array<{ projectId: string | null; status: string; _count: { id: number } }>,
    runStateCounts: [] as Array<{
      projectId: string | null;
      runState: string | null;
      _count: { id: number };
    }>,
    latestWorkLogs: [] as Array<{ projectId: string | null; lastWorkedAt: Date | string | null }>,
    projectActivityRows: [] as Array<{
      project_id: string;
      worked_day: string | Date;
      count: number | bigint;
    }>,
    groupedQueryIndex: 0,
  };

  const groupByMock = vi.fn(() => {
    state.groupedQueryIndex += 1;
    if (state.groupedQueryIndex === 1) return Promise.resolve(state.statusCounts);
    if (state.groupedQueryIndex === 2) return Promise.resolve(state.runStateCounts);
    return Promise.resolve(state.latestWorkLogs);
  });
  const whereMock = vi.fn(() => ({ groupBy: groupByMock }));
  const fromMock = vi.fn(() => ({ where: whereMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));

  return {
    state,
    redirect: vi.fn(),
    revalidatePath: vi.fn(),
    getOwnerUserOrNull: vi.fn(),
    requireOwnerUser: vi.fn(),
    getUserSetting: vi.fn(),
    updateProject: vi.fn(),
    writeAuditLog: vi.fn(),
    projectCardMenuProps: vi.fn(),
    projectEditPanelProps: vi.fn(),
    getProjectActivityStatus: vi.fn(() => ({ status: 'healthy' })),
    db: {
      query: {
        projects: {
          findMany: vi.fn(() => Promise.resolve(state.projects)),
          findFirst: vi.fn(),
        },
      },
      select: selectMock,
      execute: vi.fn(() => Promise.resolve(state.projectActivityRows)),
    },
  };
});

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => React.createElement('a', { href, ...props }, children),
}));

vi.mock('next/navigation', () => ({
  redirect: mocked.redirect,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocked.revalidatePath,
}));

vi.mock('@/app/components/empty-state', () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('@/app/components/link-button', () => ({
  LinkButton: ({ children, href }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/app/components/project-card-menu', () => ({
  ProjectCardMenu: (props: {
    editHref: string;
    projectId: string;
    projectName: string;
    canPause?: boolean;
    pauseFormId?: string | null;
  }) => {
    mocked.projectCardMenuProps(props);
    return (
      <button
        type="button"
        data-edit-href={props.editHref}
        data-project-id={props.projectId}
        data-project-name={props.projectName}
        data-can-pause={props.canPause ? 'true' : 'false'}
        data-pause-form-id={props.pauseFormId ?? ''}
      >
        menu
      </button>
    );
  },
}));

vi.mock('@/app/components/task-panel-modal', () => ({
  TaskPanelModal: ({
    children,
    title,
    closeHref,
    fullscreenStorageKey,
    resizableStorageKey,
  }: {
    children: React.ReactNode;
    title: string;
    closeHref: string;
    fullscreenStorageKey?: string;
    resizableStorageKey?: string;
  }) => (
    <div
      data-testid="task-panel-modal"
      data-title={title}
      data-close-href={closeHref}
      data-fullscreen-storage-key={fullscreenStorageKey ?? ''}
      data-resizable-storage-key={resizableStorageKey ?? ''}
    >
      {children}
    </div>
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

vi.mock('@/lib/actions/project-actions', () => ({
  updateProject: mocked.updateProject,
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: mocked.writeAuditLog,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback(mocked.db),
}));

vi.mock('@/lib/owner', () => ({
  getOwnerUserOrNull: mocked.getOwnerUserOrNull,
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/project-activity', () => ({
  getProjectActivityStatus: mocked.getProjectActivityStatus,
}));

vi.mock('@/lib/user-settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/user-settings')>('@/lib/user-settings');
  return {
    ...actual,
    getUserSetting: mocked.getUserSetting,
  };
});

import ProjectsPage from '@/app/(workspace)/(main)/projects/page';

const projectsPageCss = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/projects/projects-page.module.css'),
  'utf8',
);
const projectsPageSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/projects/page.tsx'),
  'utf8',
);
const projectsRosterClientPath = path.join(
  process.cwd(),
  'app/(workspace)/(main)/projects/projects-roster-client.tsx',
);
const projectsRosterClientSource = fs.existsSync(projectsRosterClientPath)
  ? fs.readFileSync(projectsRosterClientPath, 'utf8')
  : '';
const projectPortfolioCardSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/projects/project-portfolio-card.tsx'),
  'utf8',
);

describe('app/(workspace)/(main)/projects/page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T14:00:00Z'));
    vi.clearAllMocks();
    mocked.state.groupedQueryIndex = 0;
    mocked.getOwnerUserOrNull.mockResolvedValue({ id: 'owner-1' });
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.getUserSetting.mockResolvedValue('false');
    mocked.state.projects = [
      {
        id: 'project-1',
        name: 'PreqStation Core',
        projectKey: 'PREQ',
        description: 'Task control plane, Kanban workflow, REST API, and HTTP MCP server.',
        status: 'active',
        updatedAt: new Date('2026-03-13T10:00:00Z'),
        repoUrl: 'https://github.com/sonim1/preqstation',
        vercelUrl: 'https://preqstation.vercel.app',
        bgImage: 'mountains',
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
    ];
    mocked.state.statusCounts = [
      { projectId: 'project-1', status: 'todo', _count: { id: 6 } },
      { projectId: 'project-1', status: 'ready', _count: { id: 1 } },
      { projectId: 'project-1', status: 'done', _count: { id: 2 } },
    ];
    mocked.state.runStateCounts = [
      { projectId: 'project-1', runState: 'running', _count: { id: 1 } },
      { projectId: 'project-1', runState: 'queued', _count: { id: 1 } },
    ];
    mocked.state.latestWorkLogs = [
      { projectId: 'project-1', lastWorkedAt: new Date('2026-03-14T12:00:00Z') },
    ];
    mocked.state.projectActivityRows = [
      { project_id: 'project-1', worked_day: '2026-03-12', count: 2 },
      { project_id: 'project-1', worked_day: '2026-03-14', count: 3 },
    ];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the projects body as a reference-style roster with a 30 day bar chart', async () => {
    mocked.state.projects.push(
      {
        id: 'project-2',
        name: 'PreqStation Skill',
        projectKey: 'PSKL',
        description: 'Worker runtime setup for Claude Code, Codex, and Gemini.',
        status: 'active',
        updatedAt: new Date('2026-03-13T12:00:00Z'),
        repoUrl: 'https://github.com/sonim1/preqstation-skill',
        vercelUrl: null,
        bgImage: null,
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
      {
        id: 'project-3',
        name: 'PreqStation Dispatcher',
        projectKey: 'DISP',
        description: 'Operator-host setup and dispatch.',
        status: 'paused',
        updatedAt: new Date('2026-03-08T10:00:00Z'),
        repoUrl: 'https://github.com/sonim1/preqstation-dispatcher',
        vercelUrl: null,
        bgImage: null,
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
    );
    mocked.state.statusCounts.push(
      { projectId: 'project-2', status: 'todo', _count: { id: 2 } },
      { projectId: 'project-2', status: 'done', _count: { id: 1 } },
      { projectId: 'project-3', status: 'todo', _count: { id: 2 } },
      { projectId: 'project-3', status: 'done', _count: { id: 1 } },
    );
    mocked.state.runStateCounts.push({
      projectId: 'project-2',
      runState: 'running',
      _count: { id: 1 },
    });
    mocked.state.latestWorkLogs.push(
      { projectId: 'project-2', lastWorkedAt: new Date('2026-03-14T11:46:00Z') },
      { projectId: 'project-3', lastWorkedAt: new Date('2026-03-12T12:00:00Z') },
    );

    const page = await ProjectsPage();
    const html = renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);

    expect(html).toContain('Projects roster · 3 repos');
    expect(html).toContain('Workspace activity');
    expect(html).toContain('last 30 days');
    expect(html).toContain('3 projects');
    expect(html).toContain('New project');
    expect(html).toContain('data-projects-activity-chart="bar"');
    expect(html).toContain('data-projects-activity-range="desktop-30-mobile-7"');
    expect(html.match(/data-projects-activity-bar=/g)).toHaveLength(30);
    expect(html.match(/data-projects-activity-mobile-hidden="true"/g)).toHaveLength(23);
    expect(html).toContain('data-projects-activity-bar="2026-03-14"');
    expect(html).toContain('aria-label="2026-03-14: 3 work logs"');
    expect(html).toContain('2026-03-14 · 3 work logs');
    expect(html).not.toContain('data-projects-activity-heatmap="true"');
    expect(html).toContain('<strong>5</strong> logs');
    expect(html).toContain('Find a project');
    expect(html).toContain('All 3');
    expect(html).toContain('Active 2');
    expect(html).toContain('Paused 1');
    expect(html).toContain('Archived 0');
    expect(html).not.toContain('value="live"');
    expect(html).toContain('data-project-roster-card="true"');
    expect(html).toContain('data-project-card-tone="live"');
    expect(html).toContain('data-project-card-tone="paused"');
    expect(html).toContain('PREQ');
    expect(html).toContain('PreqStation Core');
    expect(html).toContain('sonim1/preqstation');
    expect(html).toContain('Last activity 2h ago');
    expect(html).toContain('OPEN');
    expect(html).toContain('RUNNING');
    expect(html).toContain('QUEUED');
    expect(html).toContain('DONE');
    expect(html).not.toContain('DONE · 7D');
    expect(html).toContain('data-project-section="roster"');
    expect(html).not.toContain('data-portfolio-featured="true"');
    expect(html).not.toContain('Quiet edge');
    expect(html).not.toContain('data-project-card-background="image"');
  });

  it('filters the roster by fuzzy search across project fields and status query params', async () => {
    mocked.state.projects.push(
      {
        id: 'project-2',
        name: 'PreqStation Skill',
        projectKey: 'PSKL',
        description: 'Worker runtime setup for Claude Code, Codex, and Gemini.',
        status: 'active',
        updatedAt: new Date('2026-03-13T12:00:00Z'),
        repoUrl: 'https://github.com/sonim1/preqstation-skill',
        vercelUrl: null,
        bgImage: null,
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
      {
        id: 'project-3',
        name: 'PreqStation Dispatcher',
        projectKey: 'DISP',
        description: 'Operator-host setup and dispatch.',
        status: 'paused',
        updatedAt: new Date('2026-03-08T10:00:00Z'),
        repoUrl: 'https://github.com/sonim1/preqstation-dispatcher',
        vercelUrl: null,
        bgImage: null,
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
    );
    mocked.state.statusCounts.push(
      { projectId: 'project-2', status: 'todo', _count: { id: 2 } },
      { projectId: 'project-3', status: 'todo', _count: { id: 2 } },
    );
    mocked.state.runStateCounts = [
      { projectId: 'project-1', runState: 'running', _count: { id: 1 } },
      { projectId: 'project-2', runState: 'queued', _count: { id: 1 } },
    ];
    mocked.state.latestWorkLogs.push(
      { projectId: 'project-2', lastWorkedAt: new Date('2026-03-14T11:46:00Z') },
      { projectId: 'project-3', lastWorkedAt: new Date('2026-03-12T12:00:00Z') },
    );

    const page = await ProjectsPage({
      searchParams: Promise.resolve({ q: 'gthb wrkr', status: 'active' }),
    });
    const html = renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);

    expect(html).toContain('data-project-filter-mode="client"');
    expect(html).not.toContain('method="GET"');
    expect(html).toContain('value="gthb wrkr"');
    expect(html).toContain('value="active"');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('value="live"');
    expect(html).not.toContain('PreqStation Core');
    expect(html).toContain('PreqStation Skill');
    expect(html).not.toContain('PreqStation Dispatcher');
    expect(fs.existsSync(projectsRosterClientPath)).toBe(true);
    expect(projectsPageSource).not.toContain('method="GET"');
    expect(projectsRosterClientSource).toContain('window.history.replaceState');
    expect(projectsRosterClientSource).toContain('type="button"');
  });

  it('searches project vercel URLs as part of the unified project index', async () => {
    const page = await ProjectsPage({
      searchParams: Promise.resolve({ q: 'vercel app' }),
    });
    const html = renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);

    expect(html).toContain('value="vercel app"');
    expect(html).toContain('PreqStation Core');
    expect(html).not.toContain('No matching projects');
  });

  it('keeps active projects in recent-change order before paused and archived projects', async () => {
    mocked.state.projects = [
      {
        id: 'project-1',
        name: 'Older Active',
        projectKey: 'OLD',
        description: 'Older active repo.',
        status: 'active',
        updatedAt: new Date('2026-03-10T10:00:00Z'),
        repoUrl: 'https://github.com/sonim1/older-active',
        vercelUrl: null,
        bgImage: null,
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
      {
        id: 'project-2',
        name: 'Newest Active',
        projectKey: 'NEW',
        description: 'Newest active repo.',
        status: 'active',
        updatedAt: new Date('2026-03-14T10:00:00Z'),
        repoUrl: 'https://github.com/sonim1/newest-active',
        vercelUrl: null,
        bgImage: null,
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
      {
        id: 'project-3',
        name: 'Paused Recent',
        projectKey: 'PAUS',
        description: 'Paused should be muted and after active projects.',
        status: 'paused',
        updatedAt: new Date('2026-03-15T10:00:00Z'),
        repoUrl: 'https://github.com/sonim1/paused-recent',
        vercelUrl: null,
        bgImage: null,
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
      {
        id: 'project-4',
        name: 'Archived Recent',
        projectKey: 'ARCH',
        description: 'Archived should be muted and last.',
        status: 'done',
        updatedAt: new Date('2026-03-16T10:00:00Z'),
        repoUrl: 'https://github.com/sonim1/archived-recent',
        vercelUrl: null,
        bgImage: null,
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
    ];
    mocked.state.runStateCounts = [
      { projectId: 'project-1', runState: 'running', _count: { id: 1 } },
    ];
    mocked.state.latestWorkLogs = [];

    const page = await ProjectsPage();
    const html = renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);

    expect(html).toContain('All 4');
    expect(html).toContain('Active 2');
    expect(html).toContain('Paused 1');
    expect(html).toContain('Archived 1');
    expect(html.indexOf('Newest Active')).toBeLessThan(html.indexOf('Older Active'));
    expect(html.indexOf('Older Active')).toBeLessThan(html.indexOf('Paused Recent'));
    expect(html.indexOf('Paused Recent')).toBeLessThan(html.indexOf('Archived Recent'));
    expect(html).toContain('data-project-card-tone="paused"');
    expect(html).toContain('data-project-card-tone="archived"');
    expect(html).toContain('Archived</span>');
  });

  it('filters paused and archived projects from the project filter chips', async () => {
    mocked.state.projects.push(
      {
        id: 'project-2',
        name: 'Paused Project',
        projectKey: 'PAUS',
        description: 'Paused repo.',
        status: 'paused',
        updatedAt: new Date('2026-03-13T12:00:00Z'),
        repoUrl: 'https://github.com/sonim1/paused-project',
        vercelUrl: null,
        bgImage: null,
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
      {
        id: 'project-3',
        name: 'Archived Project',
        projectKey: 'ARCH',
        description: 'Archived repo.',
        status: 'done',
        updatedAt: new Date('2026-03-12T12:00:00Z'),
        repoUrl: 'https://github.com/sonim1/archived-project',
        vercelUrl: null,
        bgImage: null,
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
    );

    const pausedPage = await ProjectsPage({
      searchParams: Promise.resolve({ status: 'paused' }),
    });
    const pausedHtml = renderToStaticMarkup(<MantineProvider>{pausedPage}</MantineProvider>);
    expect(pausedHtml).toContain('value="paused"');
    expect(pausedHtml).toContain('Paused Project');
    expect(pausedHtml).not.toContain('PreqStation Core');
    expect(pausedHtml).not.toContain('Archived Project');

    mocked.state.groupedQueryIndex = 0;
    const archivedPage = await ProjectsPage({
      searchParams: Promise.resolve({ status: 'archived' }),
    });
    const archivedHtml = renderToStaticMarkup(<MantineProvider>{archivedPage}</MantineProvider>);
    expect(archivedHtml).toContain('value="archived"');
    expect(archivedHtml).toContain('Archived Project');
    expect(archivedHtml).not.toContain('PreqStation Core');
    expect(archivedHtml).not.toContain('Paused Project');
  });

  it('marks the agent status indicator inactive when no agents are running or queued', async () => {
    mocked.state.runStateCounts = [];

    const page = await ProjectsPage();
    const html = renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);

    expect(html).toContain('data-active="false">0 agents running');
    expect(projectsPageCss).toMatch(
      /\.agentStatus\[data-active=['"]false['"]\]::before\s*\{[\s\S]*display:\s*none;/,
    );
  });

  it('pauses a project in place from the projects route', async () => {
    mocked.updateProject.mockResolvedValue({
      ok: true,
      data: { id: 'project-1', projectKey: 'PREQ', changed: true },
    });

    const page = await ProjectsPage();
    renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);

    const projectCardMenuProps = mocked.projectCardMenuProps.mock.calls[0]?.[0] as {
      canPause: boolean;
      pauseFormId: string | null;
    };

    expect(projectCardMenuProps.canPause).toBe(true);
    expect(projectCardMenuProps.pauseFormId).toBe('pause-project-project-1');
    expect(projectsPageSource).toContain('status: PAUSED_PROJECT_STATUS');
    expect(projectsPageSource).toContain("action: 'project.updated'");
  });

  it('deletes project-owned labels alongside tasks and work logs', () => {
    expect(projectsPageSource).toContain('.delete(taskLabels)');
    expect(projectsPageSource).toContain('deletedLabels');
  });

  it('keeps project edit on the projects route', async () => {
    const page = await ProjectsPage({
      searchParams: Promise.resolve({ panel: 'project-edit', projectKey: 'PREQ' }),
    });
    const html = renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);

    expect(mocked.projectCardMenuProps).toHaveBeenCalledWith(
      expect.objectContaining({
        editHref: '/projects?panel=project-edit&projectKey=PREQ',
      }),
    );
    expect(html).toContain('data-testid="task-panel-modal"');
    expect(html).toContain('data-title="Edit Project"');
    expect(html).toContain('data-close-href="/projects"');
    expect(html).toContain('data-testid="project-edit-panel"');
    expect(html).toContain('data-project-name="PreqStation Core"');
  });

  it('updates the selected project in place without redirecting to the dashboard', async () => {
    mocked.updateProject.mockResolvedValue({
      ok: true,
      data: { id: 'project-1', projectKey: 'PREQ', changed: true },
    });

    const page = await ProjectsPage({
      searchParams: Promise.resolve({ panel: 'project-edit', projectKey: 'PREQ' }),
    });
    renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);

    const projectEditPanelProps = mocked.projectEditPanelProps.mock.calls[0]?.[0] as {
      updateProjectAction: (prevState: unknown, formData: FormData) => Promise<unknown>;
    };
    const formData = new FormData();
    formData.set('projectId', 'project-1');
    formData.set('name', 'PreqStation Updated');
    formData.set('status', 'active');
    formData.set('priority', '3');
    formData.set('descriptionMd', 'Updated');
    formData.set('bgImage', 'mountains');
    formData.set('bgImageCredit', '');
    formData.set('repoUrl', 'https://github.com/sonim1/preqstation');
    formData.set('vercelUrl', 'https://preqstation.vercel.app');

    const result = await projectEditPanelProps.updateProjectAction(null, formData);

    expect(mocked.updateProject).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      projectId: 'project-1',
      name: 'PreqStation Updated',
      status: 'active',
      priority: 3,
      descriptionMd: 'Updated',
      bgImage: 'mountains',
      bgImageCredit: '',
      repoUrl: 'https://github.com/sonim1/preqstation',
      vercelUrl: 'https://preqstation.vercel.app',
    });
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'project.updated',
        targetType: 'project',
        targetId: 'project-1',
        meta: { projectKey: 'PREQ' },
      }),
      mocked.db,
    );
    expect(mocked.revalidatePath).toHaveBeenCalledWith('/project/PREQ');
    expect(mocked.revalidatePath).toHaveBeenCalledWith('/projects');
    expect(mocked.revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(mocked.revalidatePath).toHaveBeenCalledWith('/board/PREQ');
    expect(mocked.redirect).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('keeps the roster CSS compact and avoids the old image portfolio treatment', () => {
    expect(projectsPageCss).toMatch(/\.activityPanel\s*\{/);
    expect(projectsPageCss).toMatch(/\.activityBarChart\s*\{/);
    expect(projectsPageCss).toMatch(/grid-template-columns:\s*repeat\(30,\s*minmax\(0,\s*1fr\)\);/);
    expect(projectsPageCss).toMatch(
      /@media \(max-width: 47\.99375em\)\s*\{[\s\S]*\.activityBarChart\s*\{[\s\S]*grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\);/,
    );
    expect(projectsPageCss).toMatch(
      /\.activityBarWrap\[data-projects-activity-mobile-hidden=['"]true['"]\]\s*\{[\s\S]*display:\s*none;/,
    );
    expect(projectsPageCss).toMatch(
      /\.activityRangeMobile\s*\{[\s\S]*display:\s*none;[\s\S]*@media \(max-width: 47\.99375em\)\s*\{[\s\S]*\.activityRangeDesktop\s*\{[\s\S]*display:\s*none;/,
    );
    expect(projectsPageCss).toMatch(/\.activityBarWrap:hover\s+\.activityTooltip/);
    expect(projectsPageCss).toMatch(/height:\s*var\(--activity-bar-height\);/);
    expect(projectsPageCss).toMatch(/\.activityBar\s*\{[\s\S]*max-width:\s*none;/);
    expect(projectsPageCss).not.toContain('max-width: 1.35rem;');
    expect(projectsPageCss).not.toContain('max-width: 0.85rem;');
    expect(projectsPageCss).toMatch(/\.rosterGrid\s*\{[\s\S]*min-width:\s*0;/);
    expect(projectsPageCss).toMatch(/\.projectCard\s*\{[\s\S]*min-height:\s*13rem;/);
    expect(projectsPageCss).toMatch(/\.projectCard\[data-project-card-tone=['"]archived['"]\]/);
    expect(projectsPageCss).toMatch(/\.projectCard\[data-project-card-tone=['"]paused['"]\]/);
    expect(projectsPageCss).not.toContain('--card-image');
    expect(projectsPageCss).not.toMatch(/\.projectCard::before\s*\{/);
    expect(projectPortfolioCardSource).toContain('data-project-roster-card="true"');
    expect(projectPortfolioCardSource).toContain('card.isArchived');
    expect(projectPortfolioCardSource).toContain('card.runningCount');
    expect(projectPortfolioCardSource).toContain('card.queuedCount');
    expect(projectPortfolioCardSource).toContain('card.doneCount');
    expect(projectPortfolioCardSource).not.toContain('ProjectCardWorklogSparkline');
  });
});
