'use client';

import { BarsList, type BarsListBarData } from '@mantine/charts';
import { Tooltip, useMantineTheme } from '@mantine/core';

import classes from './dashboard-operator-desk.module.css';
import type { DashboardPortfolioOverviewData } from './dashboard-portfolio-overview';

type ActivityFlowProject = DashboardPortfolioOverviewData['activityStrips'][number];

type DashboardActivityFlowBarsListProps = {
  projects: ActivityFlowProject[];
};

type ActivityBarData = BarsListBarData & {
  id: string;
  color: string;
  tooltipLabel: string;
};

const ACTIVITY_BAR_COLORS = ['blue.6', 'teal.6', 'green.6', 'yellow.5', 'orange.5'] as const;
const OUTSIDE_LABEL_THRESHOLD = 44;

export function DashboardActivityFlowBarsList({ projects }: DashboardActivityFlowBarsListProps) {
  const theme = useMantineTheme();
  const data: ActivityBarData[] = projects.map((project, index) => {
    const totalLogs = project.activity.reduce((sum, point) => sum + point.count, 0);

    return {
      id: project.id,
      name: project.name,
      value: totalLogs,
      color: ACTIVITY_BAR_COLORS[index % ACTIVITY_BAR_COLORS.length],
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
          const colors = theme.variantColorResolver({
            color: activityBar.color,
            theme,
            variant: 'filled',
            autoContrast: true,
          });

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
                        backgroundColor: colors.background,
                        color: colors.color,
                      }}
                    >
                      {labelPosition === 'inside' ? (
                        <span
                          className={classes.portfolioActivityBarLabel}
                          data-activity-bar-label={activityBar.name}
                        >
                          {activityBar.name}
                        </span>
                      ) : null}
                    </div>

                    {labelPosition === 'outside' ? (
                      <span
                        className={classes.portfolioActivityBarLabel}
                        data-activity-bar-label={activityBar.name}
                      >
                        {activityBar.name}
                      </span>
                    ) : null}
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
