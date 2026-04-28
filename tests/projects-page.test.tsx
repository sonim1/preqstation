import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    return Promise.resolve(
      state.groupedQueryIndex === 1 ? state.statusCounts : state.latestWorkLogs,
    );
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
    projectCardWorklogSparklineProps: vi.fn(),
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

vi.mock('@/app/components/openclaw-guide', () => ({
  OpenClawGuide: () => <div>guide</div>,
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

vi.mock('@/app/components/project-card-worklog-sparkline', () => ({
  ProjectCardWorklogSparkline: (props: {
    data: Array<{ date: string; count: number }>;
    total: number;
  }) => {
    mocked.projectCardWorklogSparklineProps(props);
    return (
      <div
        data-testid="project-card-worklog-sparkline"
        data-total={String(props.total)}
        data-values={props.data.map((point) => point.count).join(',')}
      />
    );
  },
}));

vi.mock('@/app/components/project-health-dot', () => ({
  ProjectHealthDot: () => <div>health</div>,
}));

vi.mock('@/app/components/task-panel-modal', () => ({
  TaskPanelModal: ({
    children,
    title,
    closeHref,
  }: {
    children: React.ReactNode;
    title: string;
    closeHref: string;
  }) => (
    <div data-testid="task-panel-modal" data-title={title} data-close-href={closeHref}>
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

vi.mock('@/lib/db', () => ({
  db: mocked.db,
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
        name: 'Project One',
        projectKey: 'PROJ',
        description: 'A project with a preset background.',
        status: 'active',
        updatedAt: new Date('2026-03-13T10:00:00Z'),
        repoUrl: null,
        vercelUrl: null,
        bgImage: 'mountains',
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
    ];
    mocked.state.statusCounts = [
      { projectId: 'project-1', status: 'todo', _count: { id: 3 } },
      { projectId: 'project-1', status: 'done', _count: { id: 1 } },
    ];
    mocked.state.latestWorkLogs = [
      { projectId: 'project-1', lastWorkedAt: new Date('2026-03-12T10:00:00Z') },
    ];
    mocked.state.projectActivityRows = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render photo credit text on project cards when background credit metadata exists', async () => {
    const page = await ProjectsPage();
    const html = renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);

    expect(html).toContain('Project One');
    expect(html).not.toContain('Photo credit');
    expect(html).not.toContain('Unsplash');
  });

  it('renders resume and quiet portfolio sections with stable card slots', async () => {
    mocked.state.projects = [
      {
        id: 'project-1',
        name: 'Recent Project',
        projectKey: 'RCNT',
        description: 'Image-led project for immediate re-entry.',
        status: 'active',
        updatedAt: new Date('2026-03-14T10:00:00Z'),
        repoUrl: 'https://github.com/example/recent',
        vercelUrl: 'https://recent.vercel.app',
        bgImage: 'mountains',
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
      {
        id: 'project-2',
        name: 'Support Project',
        projectKey: 'SUPP',
        description: 'Second project in the resume lane.',
        status: 'active',
        updatedAt: new Date('2026-03-13T10:00:00Z'),
        repoUrl: null,
        vercelUrl: null,
        bgImage: null,
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
      {
        id: 'project-3',
        name: 'Hold Project',
        projectKey: 'HOLD',
        description: 'Active project with blocked edges.',
        status: 'active',
        updatedAt: new Date('2026-03-12T08:00:00Z'),
        repoUrl: null,
        vercelUrl: null,
        bgImage: null,
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
      {
        id: 'project-4',
        name: 'Drift Project',
        projectKey: 'DRFT',
        description: null,
        status: 'active',
        updatedAt: new Date('2026-03-09T10:00:00Z'),
        repoUrl: null,
        vercelUrl: null,
        bgImage: null,
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
      {
        id: 'project-5',
        name: 'Paused Project',
        projectKey: 'PAUS',
        description: 'Deliberately quiet work.',
        status: 'paused',
        updatedAt: new Date('2026-03-09T10:00:00Z'),
        repoUrl: null,
        vercelUrl: null,
        bgImage: null,
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
    ];
    mocked.state.statusCounts = [
      { projectId: 'project-1', status: 'todo', _count: { id: 5 } },
      { projectId: 'project-1', status: 'ready', _count: { id: 2 } },
      { projectId: 'project-2', status: 'todo', _count: { id: 2 } },
      { projectId: 'project-2', status: 'ready', _count: { id: 1 } },
      { projectId: 'project-3', status: 'todo', _count: { id: 3 } },
      { projectId: 'project-3', status: 'hold', _count: { id: 2 } },
      { projectId: 'project-4', status: 'todo', _count: { id: 1 } },
      { projectId: 'project-5', status: 'hold', _count: { id: 1 } },
    ];
    mocked.state.latestWorkLogs = [
      { projectId: 'project-1', lastWorkedAt: new Date('2026-03-14T12:00:00Z') },
      { projectId: 'project-2', lastWorkedAt: new Date('2026-03-14T08:00:00Z') },
      { projectId: 'project-3', lastWorkedAt: new Date('2026-03-13T10:00:00Z') },
      { projectId: 'project-4', lastWorkedAt: new Date('2026-03-09T09:00:00Z') },
      { projectId: 'project-5', lastWorkedAt: new Date('2026-03-08T10:00:00Z') },
    ];
    mocked.state.projectActivityRows = [
      { project_id: 'project-1', worked_day: '2026-03-11', count: 1 },
      { project_id: 'project-1', worked_day: '2026-03-13', count: 2 },
      { project_id: 'project-1', worked_day: '2026-03-14', count: 3 },
      { project_id: 'project-3', worked_day: '2026-03-12', count: 1 },
    ];

    const page = await ProjectsPage();
    const html = renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);
    const resumeIndex = html.indexOf('data-project-section="resume"');
    const quietIndex = html.indexOf('data-project-section="quiet"');
    const resumeSectionHtml = quietIndex > resumeIndex ? html.slice(resumeIndex, quietIndex) : html;

    expect(html).toContain('Projects');
    expect(html).not.toContain('Prototype D / Momentum Compact');
    expect(html).not.toContain('Portfolio view');
    expect(html).not.toContain('Resume now');
    expect(html).not.toContain(
      'Active work stays up front. Quiet projects stay reachable without crowding the path back into motion.',
    );
    expect(html).not.toContain(
      'Active work stays in recent-worked order with room to scan posture and next moves.',
    );
    expect(html).toContain('Quiet edge');
    expect(html).not.toContain('Resume the right project by image, not by row.');
    expect(html).not.toContain('Momentum Roster');
    expect(html).not.toContain('Radar Matrix');
    expect(html).not.toContain('Open All Boards');
    expect(html).not.toContain('Details');
    expect(html).toContain('<span>Live projects</span>');
    expect(html).toContain('<span>Ready next</span>');
    expect(html).toContain('<span>Drifting</span>');
    expect(html).toContain('<span>Touched in 7d</span>');
    expect(html).not.toContain('<span>Paused</span>');
    expect(html).toContain('New Project');
    expect(html).toContain('guide');
    expect(html).toContain('data-portfolio-featured="true"');
    expect(html).toContain('data-project-section="resume"');
    expect(html).toContain('data-project-section="quiet"');
    expect(html).toContain('data-project-card-slot="lead"');
    expect(html).toContain('data-project-card-slot="support"');
    expect(html).toContain('data-project-card-slot="lane"');
    expect(html).toContain('data-project-card-slot="quiet"');
    expect(html).toContain('data-project-card-background="image"');
    expect(html).toContain('data-project-card-background="fallback"');
    expect(/data-project-card-slot="lead"[\s\S]*?Recent Project/.test(html)).toBe(true);
    expect(/data-project-card-slot="support"[\s\S]*?Support Project/.test(html)).toBe(true);
    expect(/data-project-card-slot="lane"[\s\S]*?Hold Project/.test(html)).toBe(true);
    expect(/data-project-card-slot="lane"[\s\S]*?Drift Project/.test(html)).toBe(true);
    expect(/data-project-card-slot="quiet"[\s\S]*?Paused Project/.test(html)).toBe(true);
    expect(html).not.toMatch(/<span>Paused<\/span>/);
    expect(
      /data-project-card-slot="lead"[\s\S]*?data-project-card-background="image"[\s\S]*?Recent Project/.test(
        html,
      ),
    ).toBe(true);
    expect(html.indexOf('Recent Project')).toBeLessThan(html.indexOf('Support Project'));
    expect(html.indexOf('Support Project')).toBeLessThan(html.indexOf('Hold Project'));
    expect(html.indexOf('Hold Project')).toBeLessThan(html.indexOf('Drift Project'));
    expect(html.indexOf('Drift Project')).toBeLessThan(html.indexOf('Paused Project'));
    expect(resumeSectionHtml).not.toContain('Paused Project');
    expect(html).not.toContain('Image-led project for immediate re-entry.');
    expect(html).not.toContain('Second project in the resume lane.');
    expect(html).not.toContain('Deliberately quiet work.');
    expect(html).not.toContain('Repo linked');
    expect(html).not.toContain('Deploy linked');
    expect(html).toContain('data-connectivity-status="complete"');
    expect(html).toContain('aria-label="Repository connected. Deploy connected."');
    expect(html).toContain('data-connectivity-status="warning"');
    expect(html).toContain('aria-label="Repository missing. Deploy missing."');
    expect(
      /data-project-card-slot="lead"[\s\S]*?data-connectivity-status="complete"[\s\S]*?>RCNT<\/span>[\s\S]*?aria-hidden="true">-<\/span>[\s\S]*?>Recent Project<\/h3>/.test(
        html,
      ),
    ).toBe(true);
    expect(
      /data-project-card-slot="support"[\s\S]*?data-connectivity-status="warning"[\s\S]*?>SUPP<\/span>[\s\S]*?aria-hidden="true">-<\/span>[\s\S]*?>Support Project<\/h3>/.test(
        html,
      ),
    ).toBe(true);
    expect(html).not.toMatch(/>(steady|heavy|drifting|quiet)</);
    expect(html).not.toContain('ready to revive');
    expect(html).not.toContain('needs nudge');
    expect(html).not.toContain('blocked edges');
    expect(html).not.toContain('queue full');
    expect(html).not.toContain('quick re-entry');
    expect(html).not.toContain('low drag');
    expect(html).not.toContain('on hold');
    expect(html).not.toContain('/board/RCNT');
    expect(html).not.toContain('revisit');
    expect(html).toContain('data-testid="project-card-worklog-sparkline"');
    expect(html).toContain('data-total="6"');
    expect(html).toContain('data-values="0,0,0,1,0,2,3"');
    expect(html).toContain('id="pause-project-project-1"');
    expect(html).toContain('id="delete-project-project-1"');
    expect(html).toContain('id="delete-project-project-5"');
    expect(html).not.toContain('id="pause-project-project-5"');
    expect(html).toContain('/project/RCNT');
    expect(html).toContain('/projects?panel=project-edit&amp;projectKey=RCNT');
    expect(mocked.projectCardMenuProps).toHaveBeenCalledWith(
      expect.objectContaining({
        canPause: true,
        editHref: '/projects?panel=project-edit&projectKey=RCNT',
        pauseFormId: 'pause-project-project-1',
        projectId: 'project-1',
        projectName: 'Recent Project',
      }),
    );
    expect(mocked.projectCardMenuProps).toHaveBeenCalledWith(
      expect.objectContaining({
        canPause: false,
        editHref: '/projects?panel=project-edit&projectKey=PAUS',
        pauseFormId: null,
        projectId: 'project-5',
        projectName: 'Paused Project',
      }),
    );
    expect(mocked.projectCardWorklogSparklineProps).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 6,
        data: [
          { date: '2026-03-08', count: 0 },
          { date: '2026-03-09', count: 0 },
          { date: '2026-03-10', count: 0 },
          { date: '2026-03-11', count: 1 },
          { date: '2026-03-12', count: 0 },
          { date: '2026-03-13', count: 2 },
          { date: '2026-03-14', count: 3 },
        ],
      }),
    );
  });

  it('stacks the summary panel full-width and trims oversized project card min-heights', () => {
    expect(projectsPageCss).toMatch(/\.topGrid\s*\{[\s\S]*grid-template-columns:\s*1fr;/);
    expect(projectsPageCss).not.toMatch(
      /\.topGrid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\);/,
    );
    expect(projectsPageCss).toMatch(/\.projectCard\s*\{[\s\S]*min-height:\s*16rem;/);
    expect(projectsPageCss).toMatch(
      /\.projectCard\[data-project-card-slot='lead'\]\s*\{[\s\S]*min-height:\s*18rem;/,
    );
    expect(projectsPageCss).toMatch(
      /\.projectCard\[data-project-card-slot='support'\]\s*\{[\s\S]*min-height:\s*18rem;/,
    );
    expect(projectsPageCss).toMatch(
      /\.projectCard\[data-project-card-slot='quiet'\]\s*\{[\s\S]*min-height:\s*14rem;/,
    );
    expect(projectsPageCss).toMatch(
      /@media \(max-width: 47\.99375em\)\s*\{[\s\S]*\.projectCard,[\s\S]*min-height:\s*16rem;/,
    );
  });

  it('uses section and slot attributes instead of the old roster and radar helpers', () => {
    expect(projectsPageSource).toContain('data-project-section="resume"');
    expect(projectsPageSource).toContain('data-project-section="quiet"');
    expect(projectsPageSource).toContain('data-portfolio-featured="true"');
    expect(projectsPageSource).toContain('const featuredCard');
    expect(projectsPageSource).not.toContain('Portfolio view');
    expect(projectsPageSource).not.toContain(
      'Active work stays up front. Quiet projects stay reachable without crowding the path back into motion.',
    );
    expect(projectPortfolioCardSource).toContain('data-project-card-slot={card.slot}');
    expect(projectPortfolioCardSource).toContain(
      'data-project-card-background={card.backgroundMode}',
    );
    expect(projectPortfolioCardSource).toContain('<div className={styles.cardHeader}>');
    expect(projectPortfolioCardSource).toContain('<div className={styles.cardMeta}>');
    expect(projectPortfolioCardSource).toContain('<ProjectCardWorklogSparkline');
    expect(projectPortfolioCardSource).toContain('className={styles.cardLink}');
    expect(projectPortfolioCardSource).toMatch(
      /data-connectivity-status=\{connectionStatus\}[\s\S]*styles\.metaLabel[\s\S]*styles\.metaDivider[\s\S]*styles\.cardTitle/,
    );
    expect(projectPortfolioCardSource).toContain('canPause={!card.isPaused}');
    expect(projectPortfolioCardSource).not.toContain('card.posture.reason');
    expect(projectPortfolioCardSource).not.toContain('card.posture.label');
    expect(projectPortfolioCardSource).not.toContain('styles.cardChip');
    expect(projectPortfolioCardSource).not.toContain('styles.cardCopy');
    expect(projectPortfolioCardSource).not.toContain('className={styles.cardDescription}');
    expect(projectPortfolioCardSource).not.toContain('styles.actionRow');
    expect(projectPortfolioCardSource).not.toContain('styles.boardLink');
    expect(projectPortfolioCardSource).not.toContain('freshnessLabel');
    expect(projectPortfolioCardSource).not.toContain('boardHref');
    expect(projectPortfolioCardSource).not.toContain('statusLabel:');
    expect(projectPortfolioCardSource).not.toContain('{card.statusLabel}');
    expect(projectPortfolioCardSource).not.toContain('Details');
    expect(projectsPageSource).not.toContain('Momentum Roster');
    expect(projectsPageSource).not.toContain('Radar Matrix');
    expect(projectsPageSource).not.toContain('RADAR_SECTIONS');
    expect(projectsPageSource).not.toContain('getTrendHeights');
  });

  it('keeps project metrics as a single mobile ribbon instead of stacking status cards', () => {
    expect(projectPortfolioCardSource).toContain('<div className={styles.metricStrip}>');
    expect(projectPortfolioCardSource).toMatch(
      /card\.openLabel[\s\S]*card\.openTaskCount[\s\S]*card\.readyLabel[\s\S]*card\.readyCount[\s\S]*card\.holdLabel[\s\S]*card\.holdCount/,
    );
    expect(projectsPageCss).toMatch(
      /\.metricStrip\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/,
    );
    expect(projectsPageCss).toMatch(
      /@media \(max-width: 47\.99375em\)\s*\{[\s\S]*\.metricStrip\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/,
    );
    expect(projectsPageCss).toMatch(
      /@media \(max-width: 47\.99375em\)\s*\{[\s\S]*\.metric\s*\{[\s\S]*padding:\s*0\.5rem 0\.55rem;/,
    );
    expect(projectsPageCss).toMatch(
      /@media \(max-width: 47\.99375em\)\s*\{[\s\S]*\.metricValue\s*\{[\s\S]*font-size:\s*0\.95rem;/,
    );
    expect(projectsPageCss).not.toMatch(
      /@media \(max-width: 47\.99375em\)\s*\{[\s\S]*\.metricStrip\s*\{[\s\S]*grid-template-columns:\s*1fr;/,
    );
  });

  it('pauses a project in place from the projects route', async () => {
    mocked.updateProject.mockResolvedValue({
      ok: true,
      data: { id: 'project-1', projectKey: 'PROJ', changed: true },
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

  it('keeps /projects wrappers shrink-safe so mobile content cannot widen the page column', () => {
    expect(projectsPageCss).toMatch(/\.topGrid\s*\{[^}]*min-width:\s*0;/);
    expect(projectsPageCss).toMatch(/\.topSection\s*\{[^}]*min-width:\s*0;/);
    expect(projectsPageCss).toMatch(/\.portfolioSection\s*\{[^}]*min-width:\s*0;/);
    expect(projectsPageCss).toMatch(/\.mosaic\s*\{[^}]*min-width:\s*0;/);
    expect(projectsPageCss).toMatch(/\.quietLane\s*\{[^}]*min-width:\s*0;/);
    expect(projectsPageCss).toContain('--card-image');
    expect(projectsPageCss).toMatch(/\.projectCard::before\s*\{[\s\S]*linear-gradient\(/);
    expect(projectsPageCss).toMatch(
      /@media \(max-width: 47\.99375em\)\s*\{[\s\S]*\.mosaic\s*\{[\s\S]*flex-direction:\s*column;/,
    );
    expect(projectsPageCss).toMatch(
      /@media \(max-width: 47\.99375em\)\s*\{[\s\S]*\.quietLane\s*\{[\s\S]*grid-template-columns:\s*1fr;/,
    );
  });

  it('deletes project-owned labels alongside tasks and work logs', () => {
    expect(projectsPageSource).toContain('.delete(taskLabels)');
    expect(projectsPageSource).toContain('deletedLabels');
  });

  it('renders when grouped work logs return timestamp strings', async () => {
    mocked.state.projects = [
      {
        id: 'project-1',
        name: 'String Timestamp Project',
        projectKey: 'STRG',
        description: null,
        status: 'active',
        updatedAt: new Date('2026-02-01T10:00:00Z'),
        repoUrl: null,
        vercelUrl: null,
        bgImage: null,
        bgImageCredit: null,
        deletedAt: null,
        projectSettings: [],
      },
    ];
    mocked.state.statusCounts = [{ projectId: 'project-1', status: 'todo', _count: { id: 1 } }];
    mocked.state.latestWorkLogs = [
      { projectId: 'project-1', lastWorkedAt: '2026-03-14T12:00:00.000Z' },
    ];

    const page = await ProjectsPage();
    const html = renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);

    expect(html).toContain('String Timestamp Project');
    expect(html).toContain('data-tone="steady"');
    expect(html).not.toMatch(/>steady</);
    expect(html).not.toContain('low drag');
    expect(html).not.toContain('needs nudge');
    expect(html).toContain('data-project-card-slot="lead"');
    expect(html).toContain('data-total="0"');
  });

  it('uses kitchen terminology for open task copy when kitchen mode is enabled', async () => {
    mocked.getUserSetting.mockResolvedValue('true');

    const page = await ProjectsPage();
    const html = renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);

    expect(html).toContain('Open Tickets');
    expect(html).not.toContain('Open Tasks');
  });

  it('keeps project edit on the roster page and opens the modal from the projects route', async () => {
    const page = await ProjectsPage({
      searchParams: Promise.resolve({ panel: 'project-edit', projectKey: 'proj' }),
    });
    const html = renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);

    expect(mocked.projectCardMenuProps).toHaveBeenCalledWith(
      expect.objectContaining({
        editHref: '/projects?panel=project-edit&projectKey=PROJ',
      }),
    );
    expect(html).toContain('data-testid="task-panel-modal"');
    expect(html).toContain('data-title="Edit Project"');
    expect(html).toContain('data-close-href="/projects"');
    expect(html).toContain('data-testid="project-edit-panel"');
    expect(html).toContain('data-project-name="Project One"');
    expect(html).not.toContain('/dashboard?panel=project-edit');
  });

  it('updates the selected roster project in place without redirecting to the dashboard', async () => {
    mocked.updateProject.mockResolvedValue({
      ok: true,
      data: { id: 'project-1', projectKey: 'PROJ', changed: true },
    });

    const page = await ProjectsPage({
      searchParams: Promise.resolve({ panel: 'project-edit', projectKey: 'proj' }),
    });
    renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);

    const projectEditPanelProps = mocked.projectEditPanelProps.mock.calls[0]?.[0] as {
      updateProjectAction: (prevState: unknown, formData: FormData) => Promise<unknown>;
    };
    const formData = new FormData();
    formData.set('projectId', 'project-1');
    formData.set('name', 'Project One Updated');
    formData.set('status', 'active');
    formData.set('priority', '3');
    formData.set('descriptionMd', 'Updated');
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
      priority: 3,
      descriptionMd: 'Updated',
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
