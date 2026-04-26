import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const operatorDeskCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/dashboard-operator-desk.module.css'),
  'utf8',
);
const dashboardPortfolioOverviewSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/dashboard-portfolio-overview.tsx'),
  'utf8',
);
const dashboardPortfolioOverviewHighlightBridgeSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/dashboard-portfolio-overview-highlight-bridge.tsx'),
  'utf8',
);
const dashboardServicePaceSparklinePath = path.join(
  process.cwd(),
  'app/components/dashboard-service-pace-sparkline.tsx',
);
const dashboardServicePaceSparklineSource = fs.existsSync(dashboardServicePaceSparklinePath)
  ? fs.readFileSync(dashboardServicePaceSparklinePath, 'utf8')
  : '';

function getRuleBody(selector: string) {
  const escapedSelector = selector.replace('.', '\\.');
  const match = operatorDeskCss.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));

  expect(match?.[1]).toBeTruthy();
  return match?.[1] ?? '';
}

function getMediaBlockBody(query: string) {
  const afterMedia = operatorDeskCss.split(`@media ${query} {`)[1];

  expect(afterMedia).toBeTruthy();
  return afterMedia ?? '';
}

describe('portfolio overview visual refinement', () => {
  it('uses section dividers instead of a boxed wrapper shell', () => {
    const portfolioOverviewRule = getRuleBody('.portfolioOverview');

    expect(portfolioOverviewRule).toContain('padding-block: 0.25rem 0.5rem;');
    expect(portfolioOverviewRule).not.toContain('border:');
    expect(portfolioOverviewRule).not.toContain('border-radius:');
    expect(portfolioOverviewRule).not.toContain('background:');
    expect(portfolioOverviewRule).not.toContain('overflow: hidden;');
  });

  it('gives the service-pace lead and matrix more room while keeping the activity list dense and unruled', () => {
    const columnsRule = getRuleBody('.portfolioColumns');
    const matrixRule = getRuleBody('.portfolioMatrix');
    const legendItemRule = getRuleBody('.portfolioActivityBarRow');
    const barLabelRule = getRuleBody('.portfolioActivityBarLabel');
    const activityFooterRule = getRuleBody('.portfolioActivityFooter');
    const activityFooterStatRule = getRuleBody('.portfolioActivityFooterStat');

    expect(columnsRule).toContain(
      'grid-template-columns: minmax(0, 1.08fr) minmax(20rem, 0.92fr);',
    );
    expect(matrixRule).toContain('min-height: 16rem;');
    expect(operatorDeskCss).not.toContain('.portfolioSummaryGrid');
    expect(legendItemRule).not.toContain('border-top:');
    expect(legendItemRule).not.toContain('border-radius:');
    expect(legendItemRule).not.toContain('border: 1px solid');
    expect(barLabelRule).not.toContain('color: white');
    expect(barLabelRule).not.toContain('background:');
    expect(activityFooterRule).toContain('display: grid;');
    expect(activityFooterRule).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(activityFooterStatRule).toContain('gap: 0.2rem;');
    expect(activityFooterStatRule).not.toContain('border:');
  });

  it('keeps matrix colors on dashboard ui tokens and avoids project-count inline highlight styles', () => {
    const distMovingRule = getRuleBody('.portfolioDistMoving');
    const distWatchRule = getRuleBody('.portfolioDistWatch');
    const distRiskRule = getRuleBody('.portfolioDistRisk');
    const zoneHotRule = getRuleBody('.portfolioMatrixZoneHot');
    const zoneWarmRule = getRuleBody('.portfolioMatrixZoneWarm');
    const zoneCalmRule = getRuleBody('.portfolioMatrixZoneCalm');
    const zoneQuietRule = getRuleBody('.portfolioMatrixZoneQuiet');
    const dotWatchRule = getRuleBody('.portfolioMatrixDotWatch');
    const dotRiskRule = getRuleBody('.portfolioMatrixDotRisk');

    expect(distMovingRule).toContain('var(--ui-success)');
    expect(distWatchRule).toContain('var(--ui-warning)');
    expect(distRiskRule).toContain('var(--ui-danger)');
    expect(zoneHotRule).toContain('var(--ui-danger-soft)');
    expect(zoneWarmRule).toContain('var(--ui-warning-soft)');
    expect(zoneCalmRule).toContain('var(--ui-success-soft)');
    expect(zoneQuietRule).toContain('var(--ui-accent-soft)');
    expect(dotWatchRule).toContain('var(--ui-warning-soft)');
    expect(dotRiskRule).toContain('var(--ui-danger-soft)');
    expect(operatorDeskCss).not.toContain('--mantine-color-orange-5');
    expect(operatorDeskCss).not.toContain('--mantine-color-red-5');
    expect(operatorDeskCss).not.toContain('--mantine-color-yellow-5');
    expect(operatorDeskCss).not.toContain('--mantine-color-yellow-6');
    expect(operatorDeskCss).not.toContain('--mantine-color-green-5');
    expect(dashboardPortfolioOverviewSource).not.toContain('const hoverLinkStyles');
    expect(dashboardPortfolioOverviewSource).not.toContain('<style>{hoverLinkStyles}</style>');
    expect(operatorDeskCss).toContain(
      ".portfolioActivityTooltipTarget[data-activity-highlighted='true']",
    );
  });

  it('moves matrix-to-activity highlighting into a tiny client bridge instead of stateful page rerenders', () => {
    expect(dashboardPortfolioOverviewSource).not.toContain("'use client'");
    expect(dashboardPortfolioOverviewSource).not.toContain('useState(');
    expect(dashboardPortfolioOverviewSource).toContain('DashboardPortfolioOverviewHighlightBridge');
    expect(dashboardPortfolioOverviewSource).toContain('DashboardActivityFlowBarsList');
    expect(dashboardPortfolioOverviewSource).not.toContain('buildActivityAreaPath');
    expect(dashboardPortfolioOverviewSource).not.toContain('data-activity-chart="stacked-area"');
    expect(dashboardPortfolioOverviewHighlightBridgeSource).toContain("'use client'");
    expect(dashboardPortfolioOverviewHighlightBridgeSource).toContain('useEffect(');
    expect(dashboardPortfolioOverviewHighlightBridgeSource).toContain('addEventListener');
    expect(dashboardPortfolioOverviewHighlightBridgeSource).toContain('data-activity-project-id');
    expect(dashboardPortfolioOverviewHighlightBridgeSource).toContain('data-activity-highlighted');
    expect(dashboardPortfolioOverviewHighlightBridgeSource).not.toContain(
      'data-activity-series-highlighted',
    );
  });

  it('keeps service pace tooltip formatting inside a client wrapper', () => {
    expect(dashboardPortfolioOverviewSource).not.toContain('tooltipLabelFormatter=');
    expect(dashboardPortfolioOverviewSource).not.toContain('tooltipValueFormatter=');
    expect(dashboardPortfolioOverviewSource).toContain('DashboardServicePaceSparkline');
    expect(dashboardServicePaceSparklineSource).toContain("'use client'");
    expect(dashboardServicePaceSparklineSource).toContain('tooltipLabelFormatter=');
    expect(dashboardServicePaceSparklineSource).toContain('tooltipValueFormatter=');
  });

  it('keeps portfolio sections on the same mobile inset as the rest of the dashboard', () => {
    const mobileCss = getMediaBlockBody('(max-width: 48rem)');

    expect(mobileCss).toMatch(
      /\.portfolioOverview\s*\{[\s\S]*padding-inline:\s*var\(--mantine-spacing-md\);/,
    );
  });
});
