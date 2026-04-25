import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedSettings = vi.hoisted(() => ({
  telegramEnabled: 'false',
  kitchenMode: 'false',
}));

vi.mock('@mantine/core', () => ({
  ActionIcon: ({ children, ...props }: { children: React.ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Paper: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  SimpleGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Title: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconClipboardList: () => null,
  IconInfoCircle: () => null,
  IconChevronsUp: () => null,
  IconChevronUp: () => null,
  IconMinus: () => null,
  IconChevronDown: () => null,
  IconChevronsDown: () => null,
}));

vi.mock('drizzle-orm', () => ({
  asc: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn(),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('@/app/components/activity-chart', () => ({
  ActivityChart: ({ panelClassName }: { panelClassName?: string }) => (
    <div data-testid="activity-chart" data-panel-class={panelClassName ?? ''} />
  ),
}));

vi.mock('@/app/components/dashboard-operator-desk', () => ({
  DashboardOperatorDesk: ({
    actions,
    portfolioOverview,
    readyCount,
    focusTodos,
    readyTodos,
    weeklyActivity,
  }: {
    portfolioOverview: {
      summaryCounts: {
        needsAttention: number;
        readyToPush: number;
        longQuiet: number;
      };
      matrixProjects: Array<{ id: string }>;
      activityStrips: Array<{ id: string }>;
    };
    readyCount: number;
    focusTodos: Array<{ id: string }>;
    readyTodos: Array<{ id: string }>;
    weeklyActivity: Array<{ date: string; count: number }>;
    actions?: React.ReactNode;
  }) => (
    <section
      data-testid="dashboard-operator-desk"
      data-portfolio-attention-count={String(portfolioOverview.summaryCounts.needsAttention)}
      data-portfolio-ready-count={String(portfolioOverview.summaryCounts.readyToPush)}
      data-portfolio-quiet-count={String(portfolioOverview.summaryCounts.longQuiet)}
      data-portfolio-matrix-count={String(portfolioOverview.matrixProjects.length)}
      data-portfolio-strip-count={String(portfolioOverview.activityStrips.length)}
      data-ready-count={String(readyCount)}
      data-focus-count={String(focusTodos.length)}
      data-release-count={String(readyTodos.length)}
      data-weekly-points={String(weeklyActivity.length)}
    >
      {actions}
    </section>
  ),
}));

vi.mock('@/app/components/dashboard-metrics', () => ({
  DashboardMetrics: () => <div data-testid="dashboard-metrics" />,
}));

vi.mock('@/app/components/dashboard-yearly-heatmap', () => ({
  DashboardYearlyHeatmap: ({
    data,
    panelClassName,
  }: {
    data: Array<{ date: string; count: number }>;
    panelClassName?: string;
  }) => (
    <div
      data-testid="dashboard-yearly-heatmap"
      data-day-count={String(data.length)}
      data-panel-class={panelClassName ?? ''}
    />
  ),
}));

vi.mock('@/app/components/dashboard-panel-drawer', () => ({
  DashboardPanelDrawer: ({
    children,
    title,
    closeHref,
  }: {
    children: React.ReactNode;
    title: string;
    closeHref: string;
  }) => (
    <div data-testid="dashboard-panel-drawer" data-title={title} data-close-href={closeHref}>
      {children}
    </div>
  ),
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

vi.mock('@/app/components/empty-state', () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('@/app/components/link-button', () => ({
  LinkButton: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/app/components/panels.module.css', () => ({
  default: {
    sectionPanel: 'sectionPanel',
  },
}));

vi.mock('@/app/(workspace)/(main)/dashboard/dashboard-overview.module.css', () => ({
  default: {
    overviewPanel: 'overviewPanel',
  },
}));

vi.mock('@/app/components/panels/focus-queue-panel', () => ({
  FocusQueuePanel: ({
    focusTodos,
    panelClassName,
  }: {
    focusTodos: Array<{ id: string }>;
    panelClassName?: string;
  }) => (
    <div
      data-testid="focus-queue-panel"
      data-focus-count={String(focusTodos.length)}
      data-panel-class={panelClassName ?? ''}
    />
  ),
}));

vi.mock('@/app/components/panels/project-edit-panel', () => ({
  ProjectEditPanel: () => <div data-testid="project-edit-panel" />,
}));

vi.mock('@/app/components/panels/project-form-panel', () => ({
  ProjectFormPanel: () => <div data-testid="project-form-panel" />,
}));

vi.mock('@/app/components/panels/task-form-panel', () => ({
  TaskFormPanel: () => <div data-testid="task-form-panel" />,
}));

vi.mock('@/app/components/panels/today-focus-panel', () => ({
  TodayFocusPanel: ({ panelClassName }: { panelClassName?: string }) => (
    <div data-testid="today-focus-panel" data-panel-class={panelClassName ?? ''} />
  ),
}));

vi.mock('@/app/components/panels/worklog-form-panel', () => ({
  WorklogFormPanel: () => <div data-testid="worklog-form-panel" />,
}));

vi.mock('@/app/components/task-distribution-chart', () => ({
  TaskDistributionChart: ({ panelClassName }: { panelClassName?: string }) => (
    <section data-testid="task-distribution-chart" data-panel-class={panelClassName ?? ''}>
      Workflow Snapshot
    </section>
  ),
}));

vi.mock('@/app/components/task-edit-form', () => ({
  TaskEditForm: () => <div data-testid="task-edit-form" />,
  useTaskEditFormController: () => ({
    fieldRenderKey: 'task-edit-form:test',
    flushOnBlur: vi.fn(),
    formId: 'task-edit-form:test',
    markDirty: vi.fn(),
  }),
}));

vi.mock('@/app/components/task-edit-panel', () => ({
  TaskEditPanel: () => (
    <div
      data-testid="task-panel-modal"
      data-title="Edit Task"
      data-close-href="/dashboard"
      data-size="80rem"
    >
      <div data-testid="task-edit-form" />
    </div>
  ),
  EmptyTaskEditPanel: () => (
    <div
      data-testid="task-panel-modal"
      data-title="Edit Task"
      data-close-href="/dashboard"
      data-size="80rem"
    >
      <div data-testid="empty-task-edit-panel" />
    </div>
  ),
}));

vi.mock('@/app/components/work-log-timeline', () => ({
  WorkLogTimeline: ({
    variant,
    showProjectName,
    logs,
  }: {
    variant?: string;
    showProjectName?: boolean;
    logs: Array<{ id: string }>;
  }) => (
    <div
      data-testid="work-log-timeline"
      data-variant={variant ?? 'accordion'}
      data-show-project-name={String(showProjectName ?? false)}
      data-log-count={String(logs.length)}
    />
  ),
}));

vi.mock('@/lib/dashboard', () => ({
  getDashboardData: vi.fn(async () => ({
    projects: [
      {
        id: 'project-1',
        name: 'Project One',
        projectKey: 'PROJ',
        repoUrl: 'https://example.com/repo',
        vercelUrl: 'https://example.com/deploy',
      },
    ],
    todos: [
      {
        id: 'todo-focus-1',
        taskKey: 'PROJ-1',
        title: 'Clear Atlas approval backlog',
        taskPriority: 'high',
        status: 'todo',
        focusedAt: new Date(),
        project: { name: 'Project One' },
        labels: [],
        engine: 'codex',
        runState: 'running',
      },
      {
        id: 'todo-queue-1',
        taskKey: 'PROJ-2',
        title: 'Assign dependency owner',
        taskPriority: 'medium',
        status: 'todo',
        focusedAt: null,
        project: { name: 'Project One' },
        labels: [],
        engine: null,
        runState: null,
      },
      {
        id: 'todo-hold-1',
        taskKey: 'PROJ-3',
        title: 'Wait on review',
        taskPriority: 'medium',
        status: 'hold',
        focusedAt: null,
        project: { name: 'Project One' },
        labels: [],
        engine: null,
        runState: null,
      },
      {
        id: 'todo-ready-1',
        taskKey: 'PROJ-4',
        title: 'Ready for QA',
        taskPriority: 'low',
        status: 'ready',
        focusedAt: null,
        project: { name: 'Project One' },
        labels: [],
        engine: null,
        runState: null,
      },
      {
        id: 'todo-done-1',
        taskKey: 'PROJ-5',
        title: 'Shipped task',
        taskPriority: 'low',
        status: 'done',
        focusedAt: null,
        project: { name: 'Project One' },
        labels: [],
        engine: null,
        runState: null,
      },
    ],
    workLogs: [
      {
        id: 'log-1',
        title: 'Review completed',
        detail: 'Cleared the review queue.',
        workedAt: new Date('2026-03-25T10:00:00.000Z'),
        createdAt: new Date('2026-03-25T10:05:00.000Z'),
      },
    ],
    dailyActivity: [{ date: '2026-03-25', count: 4 }],
    yearlyActivity: [
      { date: '2026-01-01', count: 1 },
      { date: '2026-01-02', count: 0 },
      { date: '2026-03-25', count: 4 },
    ],
    weeklyActivity: [{ date: '2026-03-25', count: 4 }],
    portfolioOverview: {
      distribution: {
        moving: 0,
        watch: 0,
        risk: 1,
        quiet: 0,
      },
      summaryCounts: {
        needsAttention: 1,
        readyToPush: 1,
        longQuiet: 0,
      },
      exceptionRows: {
        mostUrgent: {
          id: 'project-1',
          projectKey: 'PROJ',
          name: 'Project One',
          holdCount: 1,
          readyCount: 1,
          ageLabel: '1d',
        },
        mostReady: {
          id: 'project-1',
          projectKey: 'PROJ',
          name: 'Project One',
          holdCount: 1,
          readyCount: 1,
          ageLabel: '1d',
        },
        quietest: null,
      },
      matrixProjects: [
        {
          id: 'project-1',
          projectKey: 'PROJ',
          name: 'Project One',
          bucket: 'risk',
          status: 'active',
          recencyDays: 1,
          openTaskCount: 4,
        },
      ],
      activityStrips: [
        {
          id: 'project-1',
          projectKey: 'PROJ',
          name: 'Project One',
          status: 'active',
          bucket: 'risk',
          ageLabel: '1d',
          pills: ['hold 1', 'ready 1'],
          activity: [{ date: '2026-03-25', count: 4 }],
        },
      ],
    },
    metrics: {
      todayTodos: 1,
      holdCount: 1,
      todoCount: 2,
      weeklyDoneCount: 6,
      repoConnected: 1,
      vercelConnected: 1,
    },
  })),
}));

vi.mock('@/lib/db', () => {
  const taskLabelsFindMany = vi.fn(async () => []);
  const tasksFindFirst = vi.fn(async () => ({
    id: 'task-1',
    taskKey: 'PROJ-254',
    title: 'Edit task panel refresh',
    branch: 'task/proj-254/fix-the-markdown-issue',
    note: '## Context',
    projectId: 'project-1',
    taskPriority: 'none',
    status: 'todo',
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    labelAssignments: [],
    workLogs: [],
  }));
  const query = {
    taskLabels: {
      findMany: taskLabelsFindMany,
    },
    tasks: {
      findFirst: tasksFindFirst,
    },
  };

  return {
    db: {
      query,
      transaction: vi.fn(async (callback) =>
        callback({
          execute: vi.fn(async () => []),
          query,
        }),
      ),
    },
  };
});

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback({
      query: {
        taskLabels: {
          findMany: vi.fn(async () => []),
        },
        tasks: {
          findFirst: vi.fn(async () => ({
            id: 'task-1',
            taskKey: 'PROJ-254',
            title: 'Edit task panel refresh',
            branch: 'task/proj-254/fix-the-markdown-issue',
            note: '## Context',
            projectId: 'project-1',
            taskPriority: 'none',
            status: 'todo',
            engine: null,
            runState: null,
            runStateUpdatedAt: null,
            labelAssignments: [],
            workLogs: [],
          })),
        },
      },
    }),
}));

vi.mock('@/lib/db/schema', () => ({
  taskLabelAssignments: { position: 'position' },
  taskLabels: { ownerId: 'ownerId', name: 'name' },
  workLogs: { workedAt: 'workedAt' },
}));

vi.mock('@/lib/owner', () => ({
  getOwnerUserOrNull: vi.fn(async () => ({ id: 'owner-1' })),
}));

vi.mock('@/lib/task-keys', () => ({
  normalizeTaskIdentifier: (value: string) => value,
  taskWhereByIdentifier: vi.fn(() => ({})),
}));

vi.mock('@/lib/task-labels', () => ({
  extractTaskLabels: vi.fn(() => []),
  groupTaskLabelsByProjectId: vi.fn(() => ({})),
}));

vi.mock('@/lib/task-meta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/task-meta')>();

  return {
    ...actual,
    coerceTaskRunState: (value: string | null) => value,
    taskPriorityOptionData: () => [{ value: 'none', label: 'None' }],
  };
});

vi.mock('@/lib/user-settings', () => ({
  SETTING_KEYS: {
    TELEGRAM_ENABLED: 'telegramEnabled',
    HERMES_TELEGRAM_ENABLED: 'hermesTelegramEnabled',
    KITCHEN_MODE: 'kitchenMode',
    TIMEZONE: 'timezone',
  },
  getUserSetting: vi.fn(async (_ownerId: string, key: string) =>
    key === 'kitchenMode'
      ? mockedSettings.kitchenMode
      : key === 'timezone'
        ? 'America/Toronto'
        : mockedSettings.telegramEnabled,
  ),
}));

vi.mock('@/app/(workspace)/(main)/dashboard/actions', () => ({
  createProject: vi.fn(),
  createTodo: vi.fn(),
  createWorkLog: vi.fn(),
  toggleTodayFocus: vi.fn(),
  updateProject: vi.fn(),
  updateTodo: vi.fn(),
  updateTodoStatus: vi.fn(),
}));

import HomePage from '@/app/(workspace)/(main)/dashboard/page';
import { getDashboardData } from '@/lib/dashboard';

describe('dashboard task panel routes', () => {
  beforeEach(() => {
    mockedSettings.telegramEnabled = 'false';
    mockedSettings.kitchenMode = 'false';
  });

  it('renders task creation inside the task modal shell', async () => {
    const html = renderToStaticMarkup(
      await HomePage({
        searchParams: Promise.resolve({
          panel: 'task',
        }),
      }),
    );

    expect(html).toContain('data-testid="task-panel-modal"');
    expect(html).toContain('data-title="New Task"');
    expect(html).toContain('data-size="58rem"');
    expect(html).toContain('data-testid="task-form-panel"');
    expect(html).not.toContain('data-testid="dashboard-panel-drawer"');
  });

  it('renders the trimmed overview hierarchy on the default dashboard', async () => {
    const html = renderToStaticMarkup(
      await HomePage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(html).toContain('data-testid="dashboard-operator-desk"');
    expect(html).toContain('data-portfolio-attention-count="1"');
    expect(html).toContain('data-portfolio-ready-count="1"');
    expect(html).toContain('data-portfolio-quiet-count="0"');
    expect(html).toContain('data-portfolio-matrix-count="1"');
    expect(html).toContain('data-portfolio-strip-count="1"');
    expect(html).toContain('data-ready-count="1"');
    expect(html).toContain('data-focus-count="4"');
    expect(html).toContain('data-release-count="1"');
    expect(html).toContain('data-weekly-points="1"');
    expect(html).not.toContain('Weekly brief, live radar.');
    expect(html).not.toContain('Brief + Radar');
    expect(html).not.toContain('Current Exception');
    expect(html).not.toContain('Recent Signals');
    expect(html).not.toContain('Workflow Snapshot');
    expect(html).not.toContain('data-testid="today-focus-panel"');
    expect(html).not.toContain('data-testid="focus-queue-panel"');
    expect(html).not.toContain('data-testid="activity-chart"');
    expect(html).not.toContain('data-testid="task-distribution-chart"');
    expect(html).not.toContain('data-testid="dashboard-yearly-heatmap"');
  });

  it('uses the unified project-edit action for the selected project', async () => {
    const html = renderToStaticMarkup(
      await HomePage({
        searchParams: Promise.resolve({
          projectId: 'project-1',
        }),
      }),
    );

    expect(html).toContain('/dashboard?projectId=project-1&amp;panel=project-edit');
    expect(html).toContain('Edit Project');
    expect(html).not.toContain('/dashboard?panel=integration&amp;projectId=project-1');
    expect(html).not.toContain('Integration');
  });

  it('caps the on-the-line surface at four visible tasks when the queue grows', async () => {
    const defaultData = await vi.mocked(getDashboardData).getMockImplementation()?.('owner-1');
    if (!defaultData) {
      throw new Error('expected a default dashboard data mock');
    }

    const baseTodo = defaultData.todos[0];
    vi.mocked(getDashboardData).mockResolvedValueOnce({
      ...defaultData,
      todos: Array.from({ length: 7 }, (_, index) => ({
        ...baseTodo,
        id: `todo-queue-${index + 1}`,
        taskKey: `PROJ-${index + 1}`,
        title: `Queued task ${index + 1}`,
        status: 'todo',
        focusedAt: null,
        engine: null,
        runState: null,
      })),
      metrics: {
        ...defaultData.metrics,
        todayTodos: 0,
        holdCount: 0,
        todoCount: 7,
      },
    });

    const html = renderToStaticMarkup(
      await HomePage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(html).toContain('data-focus-count="4"');
  });

  it('uses kitchen terminology for task modal titles when kitchen mode is enabled', async () => {
    mockedSettings.kitchenMode = 'true';

    const html = renderToStaticMarkup(
      await HomePage({
        searchParams: Promise.resolve({
          panel: 'task',
        }),
      }),
    );

    expect(html).toContain('data-title="New Ticket"');
    expect(html).not.toContain('data-title="New Task"');
  });

  it('renders task editing inside the task modal shell', async () => {
    const html = renderToStaticMarkup(
      await HomePage({
        searchParams: Promise.resolve({
          panel: 'task-edit',
          taskId: 'PROJ-254',
        }),
      }),
    );

    expect(html).toContain('data-testid="task-panel-modal"');
    expect(html).toContain('data-title="Edit Task"');
    expect(html).toContain('data-size="80rem"');
    expect(html).toContain('data-testid="task-edit-form"');
    expect(html).not.toContain('data-testid="dashboard-panel-drawer"');
  });

  it('renders project editing inside the task modal shell', async () => {
    const html = renderToStaticMarkup(
      await HomePage({
        searchParams: Promise.resolve({
          panel: 'project-edit',
          projectId: 'project-1',
        }),
      }),
    );

    expect(html).toContain('data-testid="task-panel-modal"');
    expect(html).toContain('data-title="Edit Project"');
    expect(html).toContain('data-size="58rem"');
    expect(html).toContain('data-testid="project-edit-panel"');
    expect(html).not.toContain('data-testid="dashboard-panel-drawer"');
  });

  it('keeps non-task panels on the drawer shell', async () => {
    const html = renderToStaticMarkup(
      await HomePage({
        searchParams: Promise.resolve({
          panel: 'worklog',
        }),
      }),
    );

    expect(html).toContain('data-testid="dashboard-panel-drawer"');
    expect(html).toContain('data-title="New Work Log"');
    expect(html).toContain('data-testid="worklog-form-panel"');
    expect(html).not.toContain('data-testid="task-panel-modal"');
  });
});
