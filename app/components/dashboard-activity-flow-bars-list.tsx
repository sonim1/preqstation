'use client';

import { BarsList, type BarsListBarData } from '@mantine/charts';
import { Tooltip } from '@mantine/core';
import Link from 'next/link';

import classes from './dashboard-operator-desk.module.css';
import type { DashboardPortfolioOverviewData } from './dashboard-portfolio-overview';

type ActivityFlowProject = DashboardPortfolioOverviewData['activityStrips'][number];

type DashboardActivityFlowBarsListProps = {
  projects: ActivityFlowProject[];
};

type ActivityBarData = BarsListBarData & {
  id: string;
  projectKey: string;
  tokenColor: string;
  tooltipLabel: string;
};

const ACTIVITY_BAR_TOKENS = [
  'var(--ui-workload-level-4)',
  'var(--ui-workload-level-3)',
  'var(--ui-workload-level-2)',
  'var(--ui-workload-level-1)',
  'var(--ui-workflow-ready)',
] as const;
const OUTSIDE_LABEL_THRESHOLD = 44;

export function DashboardActivityFlowBarsList({ projects }: DashboardActivityFlowBarsListProps) {
  const data: ActivityBarData[] = projects.map((project, index) => {
    const totalLogs = project.activity.reduce((sum, point) => sum + point.count, 0);

    return {
      id: project.id,
      projectKey: project.projectKey,
      name: project.name,
      value: totalLogs,
      tokenColor: ACTIVITY_BAR_TOKENS[index % ACTIVITY_BAR_TOKENS.length],
      tooltipLabel: [
        project.projectKey,
        `${totalLogs} logs`,
        `${project.ageLabel} ago`,
        ...project.pills,
      ].join(' · '),
    };
  });
  const maxValue = data.reduce((currentMax, item) => Math.max(currentMax, item.value), 0);

  return (
    <div data-activity-bars-list="true">
      <BarsList
        data={data}
        barsLabel="Project"
        valueLabel="Logs"
        barGap={0}
        barHeight={36}
        minBarSize={112}
        variant="filled"
        autoContrast
        classNames={{
          root: classes.portfolioActivityBarsList,
          labelsRow: classes.portfolioActivityLabelsRow,
        }}
        valueFormatter={(value) => String(value)}
        renderBar={(barData) => {
          const activityBar = barData as ActivityBarData;
          const fillWidth = maxValue > 0 ? Math.round((activityBar.value / maxValue) * 100) : 0;
          const labelPosition = fillWidth < OUTSIDE_LABEL_THRESHOLD ? 'outside' : 'inside';
          const label = (
            <Link
              href={`/board/${activityBar.projectKey}`}
              className={classes.portfolioActivityBarLabel}
              data-activity-bar-label={activityBar.name}
              aria-label={`Open ${activityBar.name} board`}
            >
              {activityBar.name}
            </Link>
          );

          return (
            <Tooltip
              label={activityBar.tooltipLabel}
              withArrow
              multiline
              w={220}
              events={{ hover: true, focus: true, touch: false }}
            >
              <div
                data-activity-project-id={activityBar.id}
                data-activity-highlighted="false"
                className={classes.portfolioActivityTooltipTarget}
              >
                <div
                  className={classes.portfolioActivityBarRow}
                  data-activity-bar-title={activityBar.name}
                >
                  <div
                    className={classes.portfolioActivityBarTrack}
                    data-activity-label-position={labelPosition}
                  >
                    <div
                      className={classes.portfolioActivityBarFill}
                      data-activity-bar-width={String(fillWidth)}
                      style={{
                        width: `${fillWidth}%`,
                        backgroundColor: activityBar.tokenColor,
                        color: 'var(--ui-text)',
                      }}
                    >
                      {labelPosition === 'inside' ? label : null}
                    </div>

                    {labelPosition === 'outside' ? label : null}
                  </div>

                  <div className={classes.portfolioActivityBarValue}>{activityBar.value}</div>
                </div>
              </div>
            </Tooltip>
          );
        }}
      />
    </div>
  );
}
