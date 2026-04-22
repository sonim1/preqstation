import { Group, Text, Title } from '@mantine/core';

import { DashboardActivityFlowBarsList } from './dashboard-activity-flow-bars-list';
import { DashboardInfoHint } from './dashboard-info-hint';
import classes from './dashboard-operator-desk.module.css';
import { DashboardPortfolioOverviewHighlightBridge } from './dashboard-portfolio-overview-highlight-bridge';
import { DashboardServicePaceSparkline } from './dashboard-service-pace-sparkline';

type PortfolioBucket = 'moving' | 'watch' | 'risk' | 'quiet';

type PortfolioException = {
  id: string;
  projectKey: string;
  name: string;
  holdCount: number;
  readyCount: number;
  ageLabel: string;
} | null;

type MatrixProject = {
  id: string;
  projectKey: string;
  name: string;
  bucket: PortfolioBucket;
  status: string;
  recencyDays: number;
  openTaskCount: number;
};

type ActivityStrip = {
  id: string;
  projectKey: string;
  name: string;
  status: string;
  bucket: PortfolioBucket;
  ageLabel: string;
  pills: string[];
  activity: Array<{ date: string; count: number }>;
};

type MatrixLabelPosition = 'top' | 'bottom' | 'left' | 'right';
type MatrixPointOffset = { x: number; y: number };
type MatrixRenderPoint = {
  id: string;
  left: number;
  top: number;
  labelPosition: MatrixLabelPosition;
  overlapSize: number;
  bucket: PortfolioBucket;
  title: string;
  ariaLabel: string;
  isCluster: boolean;
  clusterProjectKeys: string | null;
  linkedProjectIds: string;
  tooltipLines: string[];
};

export type DashboardPortfolioOverviewData = {
  distribution: Record<PortfolioBucket, number>;
  summaryCounts: {
    needsAttention: number;
    readyToPush: number;
    longQuiet: number;
  };
  exceptionRows: {
    mostUrgent: PortfolioException;
    mostReady: PortfolioException;
    quietest: PortfolioException;
  };
  matrixProjects: MatrixProject[];
  activityStrips: ActivityStrip[];
};

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: 'UTC',
});

function matrixDotClassName(bucket: PortfolioBucket) {
  if (bucket === 'risk') return `${classes.portfolioMatrixDot} ${classes.portfolioMatrixDotRisk}`;
  if (bucket === 'watch') return `${classes.portfolioMatrixDot} ${classes.portfolioMatrixDotWatch}`;
  return classes.portfolioMatrixDot;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getMatrixLabelPosition(left: number, top: number): MatrixLabelPosition {
  if (left <= 22) return 'right';
  if (left >= 76) return 'left';
  if (top <= 28) return 'bottom';
  return 'top';
}

function getMatrixSoftOffset(index: number): MatrixPointOffset {
  return {
    x: ((index % 3) - 1) * (4 / 6),
    y: (Math.floor(index / 3) % 2) * (4 / 6) - 2 / 6,
  };
}

function getMatrixPointKey(left: number, top: number) {
  return `${left.toFixed(2)}:${top.toFixed(2)}`;
}

function getClusterBucket(projects: MatrixProject[]): PortfolioBucket {
  if (projects.some((project) => project.bucket === 'risk')) return 'risk';
  if (projects.some((project) => project.bucket === 'watch')) return 'watch';
  if (projects.some((project) => project.bucket === 'moving')) return 'moving';
  return 'quiet';
}

function buildServicePaceLegend(weeklyActivity: Array<{ date: string; count: number }>) {
  return weeklyActivity.map((point) => ({
    id: point.date,
    label: weekdayFormatter.format(new Date(`${point.date}T00:00:00Z`)).slice(0, 1),
  }));
}

export function DashboardPortfolioOverview({
  portfolioOverview,
  weeklyWorkLogCount,
  weeklyActivity,
}: {
  portfolioOverview: DashboardPortfolioOverviewData;
  weeklyWorkLogCount: number;
  weeklyActivity: Array<{ date: string; count: number }>;
}) {
  const maxOpenTaskCount = Math.max(
    1,
    ...portfolioOverview.matrixProjects.map((project) => project.openTaskCount),
  );
  const servicePaceLegend = buildServicePaceLegend(weeklyActivity);
  const shownActivityTotal = portfolioOverview.activityStrips.reduce(
    (sum, project) =>
      sum + project.activity.reduce((projectSum, point) => projectSum + point.count, 0),
    0,
  );
  const activityFlowHelp =
    'Active projects ranked by seven-day logs. Open a bar to inspect freshness and blockers.';
  const activityFlowSummary = [
    {
      id: 'quiet',
      value: portfolioOverview.summaryCounts.longQuiet,
      label: 'quiet off chart',
    },
    {
      id: 'logs',
      value: shownActivityTotal,
      label: 'logs across 7d',
    },
  ] as const;
  const matrixBasePoints = portfolioOverview.matrixProjects.map((project, index) => {
    const baseLeft = 14 + Math.min((project.recencyDays / 14) * 72, 72);
    const baseTop = 82 - Math.min((project.openTaskCount / maxOpenTaskCount) * 56, 56);

    return {
      index,
      project,
      baseLeft,
      baseTop,
      pointKey: getMatrixPointKey(baseLeft, baseTop),
    };
  });
  const overlapGroups = new Map<string, typeof matrixBasePoints>();

  matrixBasePoints.forEach((point) => {
    const group = overlapGroups.get(point.pointKey);

    if (group) {
      group.push(point);
      return;
    }

    overlapGroups.set(point.pointKey, [point]);
  });

  const positionedMatrixPoints: MatrixRenderPoint[] = Array.from(overlapGroups.values()).map(
    (group) => {
      const anchor = group[0];
      const overlapSize = group.length;
      const projects = group.map((point) => point.project);
      const offset = overlapSize === 1 ? getMatrixSoftOffset(anchor.index) : { x: 0, y: 0 };
      const left = clamp(anchor.baseLeft + offset.x, 14, 86);
      const top = clamp(anchor.baseTop + offset.y, 16, 82);
      const labelPosition = getMatrixLabelPosition(left, top);

      if (overlapSize > 1) {
        return {
          id: group.map((point) => point.project.id).join(':'),
          left,
          top,
          labelPosition,
          overlapSize,
          bucket: getClusterBucket(projects),
          title: projects
            .map(
              (project) =>
                `${project.projectKey} · ${project.name} · ${project.openTaskCount} open`,
            )
            .join('\n'),
          ariaLabel: `${overlapSize} overlapping projects: ${projects
            .map(
              (project) =>
                `${project.projectKey} ${project.name} ${project.openTaskCount} open tasks`,
            )
            .join('; ')}`,
          isCluster: true,
          clusterProjectKeys: projects.map((project) => project.projectKey).join(','),
          linkedProjectIds: projects.map((project) => project.id).join(' '),
          tooltipLines: projects.map(
            (project) => `${project.projectKey} · ${project.name} · ${project.openTaskCount} open`,
          ),
        };
      }

      const project = projects[0];

      return {
        id: project.id,
        left,
        top,
        labelPosition,
        overlapSize,
        bucket: project.bucket,
        title: `${project.projectKey} · ${project.name} · ${project.openTaskCount} open`,
        ariaLabel: `${project.projectKey} ${project.name} ${project.openTaskCount} open tasks`,
        isCluster: false,
        clusterProjectKeys: null,
        linkedProjectIds: project.id,
        tooltipLines: [`${project.projectKey} · ${project.name} · ${project.openTaskCount} open`],
      };
    },
  );
  return (
    <section
      className={classes.portfolioOverview}
      data-dashboard-module="portfolio-overview"
      data-portfolio-module="triage"
    >
      <DashboardPortfolioOverviewHighlightBridge />
      <div className={classes.portfolioColumns}>
        <div className={classes.portfolioPrimaryColumn}>
          <div className={classes.portfolioLead} data-dashboard-module="service-pace">
            <div className={classes.portfolioSubhead}>
              <div>
                <Group gap={6} align="center" wrap="nowrap">
                  <Title order={4}>Service Pace</Title>
                  <DashboardInfoHint
                    label="Service Pace"
                    tooltip="Weekly work-log rhythm without the extra dashboard noise."
                  />
                </Group>
              </div>
              <Text size="xs" className={classes.sectionMeta} data-rail-summary="logs">
                {weeklyWorkLogCount} logs
              </Text>
            </div>

            <div className={classes.sparklineWrap}>
              <DashboardServicePaceSparkline data={weeklyActivity} />
            </div>

            <Group justify="space-between" wrap="nowrap" className={classes.paceLegend}>
              {servicePaceLegend.map((day) => (
                <Text key={day.id} size="xs" data-pace-day={day.id}>
                  {day.label}
                </Text>
              ))}
            </Group>
          </div>

          <div className={classes.portfolioMatrixRail}>
            <div className={classes.portfolioMatrixCard} data-portfolio-module="priority-matrix">
              <div className={classes.portfolioSubhead}>
                <div>
                  <Title order={4}>Priority Matrix</Title>
                  <Text size="sm" style={{ color: 'var(--ui-muted-text)' }}>
                    Fresh projects stay left. Heavier open load rises to the top.
                  </Text>
                </div>
                <Text size="xs" className={classes.portfolioSubheadMeta}>
                  Fresh x pressure
                </Text>
              </div>

              <div className={classes.portfolioMatrixShell}>
                <div className={classes.portfolioMatrixLoadScale}>
                  <Text size="xs">Heavy load</Text>
                  <Text size="xs">Light load</Text>
                </div>

                <div className={classes.portfolioMatrixCanvas}>
                  <div className={classes.portfolioMatrix}>
                    <div
                      className={`${classes.portfolioMatrixZone} ${classes.portfolioMatrixZoneHot}`}
                    />
                    <div
                      className={`${classes.portfolioMatrixZone} ${classes.portfolioMatrixZoneWarm}`}
                    />
                    <div
                      className={`${classes.portfolioMatrixZone} ${classes.portfolioMatrixZoneCalm}`}
                    />
                    <div
                      className={`${classes.portfolioMatrixZone} ${classes.portfolioMatrixZoneQuiet}`}
                    />

                    {positionedMatrixPoints.map((project) => {
                      return (
                        <button
                          key={project.id}
                          type="button"
                          className={classes.portfolioMatrixPoint}
                          style={{
                            left: `${project.left}%`,
                            top: `${project.top}%`,
                          }}
                          title={project.title}
                          data-label-position={project.labelPosition}
                          data-overlap-size={project.overlapSize}
                          data-matrix-cluster={project.isCluster ? 'true' : undefined}
                          data-cluster-projects={project.clusterProjectKeys ?? undefined}
                          data-matrix-project-ids={project.linkedProjectIds}
                          aria-label={project.ariaLabel}
                        >
                          <span className={matrixDotClassName(project.bucket)}>
                            {project.isCluster ? (
                              <span className={classes.portfolioMatrixCount}>
                                {project.overlapSize}
                              </span>
                            ) : null}
                          </span>
                          <span className={classes.portfolioMatrixTooltip}>
                            {project.tooltipLines.map((line) => (
                              <span key={line} className={classes.portfolioMatrixTooltipLine}>
                                {line}
                              </span>
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className={classes.portfolioMatrixRecencyScale}>
                    <Text size="xs">Fresh</Text>
                    <Text size="xs">Stale</Text>
                  </div>

                  <div className={classes.portfolioMatrixSummary} data-matrix-summary-list="true">
                    {portfolioOverview.matrixProjects.map((project) => (
                      <div
                        key={project.id}
                        className={classes.portfolioMatrixSummaryItem}
                        data-matrix-summary-project={project.id}
                      >
                        <Text fw={700}>{project.projectKey}</Text>
                        <Text size="xs" className={classes.portfolioMatrixSummaryMeta}>
                          {`${project.name} · ${project.openTaskCount} open · ${project.recencyDays}d stale`}
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={classes.portfolioActivityColumn}>
          <div className={classes.portfolioActivityCard} data-portfolio-module="activity-flow">
            <div className={classes.portfolioSubhead}>
              <div>
                <Group gap={6} align="center" wrap="nowrap">
                  <Title order={4}>Activity Flow</Title>
                  <DashboardInfoHint label="Activity Flow" tooltip={activityFlowHelp} />
                </Group>
              </div>
              <Text size="xs" className={classes.portfolioSubheadMeta}>
                {`${portfolioOverview.activityStrips.length} active · ${portfolioOverview.summaryCounts.longQuiet} quiet`}
              </Text>
            </div>

            {portfolioOverview.activityStrips.length > 0 ? (
              <>
                <DashboardActivityFlowBarsList projects={portfolioOverview.activityStrips} />
                <div className={classes.portfolioActivityFooter}>
                  {activityFlowSummary.map((item) => (
                    <div
                      key={item.id}
                      className={classes.portfolioActivityFooterStat}
                      data-activity-summary={item.id}
                      data-activity-summary-value={item.value}
                      data-activity-summary-label={item.label}
                    >
                      <Text component="span" className={classes.portfolioActivityFooterValue}>
                        {item.value}
                      </Text>
                      <Text
                        component="span"
                        size="xs"
                        className={classes.portfolioActivityFooterMeta}
                      >
                        {item.label}
                      </Text>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={classes.portfolioActivityEmpty}>
                <Text size="sm">No active projects moved in the last 7 days.</Text>
                <div
                  className={classes.portfolioActivityFooterStat}
                  data-activity-summary="quiet"
                  data-activity-summary-value={portfolioOverview.summaryCounts.longQuiet}
                  data-activity-summary-label="quiet off chart"
                >
                  <Text component="span" className={classes.portfolioActivityFooterValue}>
                    {portfolioOverview.summaryCounts.longQuiet}
                  </Text>
                  <Text component="span" size="xs" className={classes.portfolioActivityFooterMeta}>
                    quiet off chart
                  </Text>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
