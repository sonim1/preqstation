import { Group } from '@mantine/core';

import type { OnTheLineLaneRole } from '@/lib/dashboard-on-the-line';
import type { Terminology } from '@/lib/terminology';

import { DashboardFocusedWorkLane } from './dashboard-focused-work-lane';
import { DashboardInstrumentRail } from './dashboard-instrument-rail';
import classes from './dashboard-operator-desk.module.css';
import {
  DashboardPortfolioOverview,
  type DashboardPortfolioOverviewData,
} from './dashboard-portfolio-overview';

type DashboardTodo = {
  id: string;
  taskKey: string;
  title: string;
  taskPriority: string;
  status: string;
  focusedAt?: Date | null;
  project: { name: string } | null;
  labels: Array<{ id: string; name: string; color?: string | null }>;
  engine?: string | null;
  runState?: string | null;
  laneRole?: OnTheLineLaneRole;
};

type DashboardOperatorDeskProps = {
  portfolioOverview: DashboardPortfolioOverviewData;
  terminology: Terminology;
  actions: React.ReactNode;
  readyCount: number;
  weeklyWorkLogCount: number;
  projectsCount: number;
  repoConnected: number;
  vercelConnected: number;
  focusTodos: DashboardTodo[];
  readyTodos: DashboardTodo[];
  weeklyActivity: Array<{ date: string; count: number }>;
  selectedProjectId?: string;
  toggleTodayFocusAction: (formData: FormData) => Promise<void>;
  updateTodoStatusAction: (formData: FormData) => Promise<void>;
};

export function DashboardOperatorDesk({
  portfolioOverview,
  terminology,
  actions,
  readyCount,
  weeklyWorkLogCount,
  projectsCount,
  repoConnected,
  vercelConnected,
  focusTodos,
  readyTodos,
  weeklyActivity,
  selectedProjectId,
  toggleTodayFocusAction,
  updateTodoStatusAction,
}: DashboardOperatorDeskProps) {
  return (
    <section className={classes.board} data-dashboard-operator-desk="true">
      {actions ? (
        <div className={classes.topbar}>
          <Group gap="xs" wrap="wrap" className={classes.actions}>
            {actions}
          </Group>
        </div>
      ) : null}

      <DashboardPortfolioOverview
        portfolioOverview={portfolioOverview}
        weeklyWorkLogCount={weeklyWorkLogCount}
        weeklyActivity={weeklyActivity}
      />

      <div className={classes.contentGrid}>
        <div className={classes.mainColumn}>
          <DashboardFocusedWorkLane
            focusTodos={focusTodos}
            readyCount={readyCount}
            selectedProjectId={selectedProjectId}
            terminology={terminology}
            toggleTodayFocusAction={toggleTodayFocusAction}
            updateTodoStatusAction={updateTodoStatusAction}
            embedded
          />
        </div>

        <DashboardInstrumentRail
          readyTodos={readyTodos}
          terminology={terminology}
          projectsCount={projectsCount}
          repoConnected={repoConnected}
          vercelConnected={vercelConnected}
          embedded
        />
      </div>
    </section>
  );
}
