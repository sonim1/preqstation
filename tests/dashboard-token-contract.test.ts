import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function readProjectFile(filePath: string) {
  return fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
}

const globalsCss = readProjectFile('app/globals.css');
const operatorDeskCss = readProjectFile('app/components/dashboard-operator-desk.module.css');
const heatmapCss = readProjectFile('app/components/dashboard-yearly-heatmap.module.css');
const metricsCss = readProjectFile('app/components/metrics.module.css');
const activityChartSource = readProjectFile('app/components/activity-chart.tsx');
const taskDistributionChartSource = readProjectFile('app/components/task-distribution-chart.tsx');
const activityFlowBarsSource = readProjectFile(
  'app/components/dashboard-activity-flow-bars-list.tsx',
);
const servicePaceSparklineSource = readProjectFile(
  'app/components/dashboard-service-pace-sparkline.tsx',
);
const focusedLaneCss = readProjectFile('app/components/dashboard-focused-work-lane.module.css');

describe('dashboard semantic token contract', () => {
  it('defines dashboard seam, chart, workflow, and workload tokens in globals', () => {
    for (const token of [
      '--ui-dashboard-seam',
      '--ui-dashboard-seam-fade',
      '--ui-dashboard-chart-primary',
      '--ui-dashboard-chart-primary-soft',
      '--ui-dashboard-chart-grid',
      '--ui-dashboard-chart-tooltip',
      '--ui-workflow-inbox',
      '--ui-workflow-todo',
      '--ui-workflow-hold',
      '--ui-workflow-ready',
      '--ui-workflow-done',
      '--ui-workload-level-0',
      '--ui-workload-level-1',
      '--ui-workload-level-2',
      '--ui-workload-level-3',
      '--ui-workload-level-4',
    ]) {
      expect(globalsCss).toContain(`${token}:`);
    }
  });

  it('keeps dashboard charts, activity bars, and heatmap levels on semantic tokens', () => {
    expect(activityChartSource).toContain(
      "const ACTIVITY_CHART_STROKE = 'var(--ui-dashboard-chart-primary)'",
    );
    expect(activityChartSource).toContain('var(--ui-dashboard-chart-primary-soft)');
    expect(activityChartSource).toContain('var(--ui-dashboard-chart-grid)');
    expect(activityChartSource).not.toContain('useMantineTheme');
    expect(activityChartSource).not.toContain('theme.colors.brand');

    expect(taskDistributionChartSource).toContain('const WORKFLOW_STATUS_TOKENS');
    expect(taskDistributionChartSource).not.toContain('TASK_STATUS_COLORS');
    expect(taskDistributionChartSource).not.toContain('--mantine-color-');

    expect(activityFlowBarsSource).toContain('const ACTIVITY_BAR_TOKENS');
    expect(activityFlowBarsSource).toContain('var(--ui-workload-level-1)');
    expect(activityFlowBarsSource).not.toContain('useMantineTheme');
    expect(activityFlowBarsSource).not.toContain("['blue.6'");

    for (const level of [0, 1, 2, 3, 4]) {
      expect(heatmapCss).toContain(`var(--ui-workload-level-${level})`);
    }
    expect(servicePaceSparklineSource).toContain('var(--ui-dashboard-chart-primary)');
  });

  it('removes file-local raw color palettes from scoped dashboard CSS modules', () => {
    const scopedCss = [
      operatorDeskCss,
      focusedLaneCss,
      heatmapCss,
      metricsCss,
      readProjectFile('app/components/dashboard-brief-radar-hero.module.css'),
    ].join('\n');

    expect(scopedCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(scopedCss).not.toMatch(/rgba?\(/);
    expect(scopedCss).not.toContain('--mantine-color-blue');
    expect(scopedCss).not.toContain('--mantine-color-indigo');
  });
});
