import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const connectionsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/connections/connections-page.module.css'),
  'utf8',
);
const projectsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/projects/projects-page.module.css'),
  'utf8',
);
const dashboardInfoHintSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/dashboard-info-hint.tsx'),
  'utf8',
);
const dashboardPageSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/dashboard/page.tsx'),
  'utf8',
);
const dashboardInstrumentRailSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/dashboard-instrument-rail.tsx'),
  'utf8',
);
const dashboardPortfolioOverviewSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/dashboard-portfolio-overview.tsx'),
  'utf8',
);
const dashboardOperatorDeskCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/dashboard-operator-desk.module.css'),
  'utf8',
);
const projectCardMenuSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/project-card-menu.tsx'),
  'utf8',
);
const taskNotificationCenterSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/task-notification-center.tsx'),
  'utf8',
);

describe('responsive density audit fixes', () => {
  it('defines and uses a shared 44px touch target token on compact shell controls', () => {
    const compactTriggerRule =
      globalsCss.match(/\.command-palette-trigger--compact\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    const mobileProjectPickerRule =
      globalsCss.match(/\.workspace-mobile-project-picker\s*\{([\s\S]*?)\}/)?.[1] ?? '';

    expect(globalsCss).toMatch(/--ui-hit-touch-min:\s*44px;/);
    expect(globalsCss).toMatch(
      /\.workspace-header-start\s+\.mantine-Burger-root\s*\{[^}]*width:\s*var\(--ui-hit-touch-min\);[^}]*min-width:\s*var\(--ui-hit-touch-min\);[^}]*height:\s*var\(--ui-hit-touch-min\);/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-divider-rail-button,\s*\.workspace-header-sidebar-toggle\s*\{[^}]*width:\s*var\(--ui-hit-touch-min\);[^}]*height:\s*var\(--ui-hit-touch-min\);/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-header-sidebar-toggle\s*\{[^}]*width:\s*var\(--ui-hit-touch-min\);[^}]*height:\s*var\(--ui-hit-touch-min\);/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-brand-link\s*\{[^}]*min-height:\s*var\(--ui-hit-touch-min\);/,
    );
    expect(compactTriggerRule).toMatch(/width:\s*var\(--ui-hit-touch-min\);/);
    expect(compactTriggerRule).toMatch(/min-width:\s*var\(--ui-hit-touch-min\);/);
    expect(compactTriggerRule).toMatch(/height:\s*var\(--ui-hit-touch-min\);/);
    expect(compactTriggerRule).toMatch(/min-height:\s*var\(--ui-hit-touch-min\);/);
    expect(taskNotificationCenterSource).toContain('size={44}');
    expect(mobileProjectPickerRule).toMatch(/height:\s*var\(--ui-hit-touch-min\);/);
    expect(mobileProjectPickerRule).toMatch(/min-height:\s*var\(--ui-hit-touch-min\);/);
    expect(globalsCss).toMatch(/\.workspace-board-subnav-link\s*\{[^}]*min-height:\s*44px;/);
  });

  it('replaces the worst fixed board and connections widths with more adaptive sizing', () => {
    expect(connectionsCss).not.toContain('min-width: 920px;');
    expect(connectionsCss).toMatch(/min-width:\s*38rem;/);
    expect(globalsCss).not.toContain('flex-basis: 360px;');
    expect(globalsCss).not.toContain('width: 360px;');
    expect(globalsCss).not.toContain('flex-basis: 300px;');
    expect(globalsCss).not.toContain('width: 300px;');
    expect(globalsCss).toMatch(
      /@media \(max-width: 62em\)\s*\{[\s\S]*\.kanban-column\s*\{[\s\S]*flex-basis:\s*min\(78vw,\s*320px\);[\s\S]*width:\s*min\(78vw,\s*320px\);/,
    );
    expect(globalsCss).toMatch(
      /@media \(max-width: 62em\)\s*\{[\s\S]*\.kanban-hold-rail\s*\{[\s\S]*flex-basis:\s*min\(72vw,\s*280px\);[\s\S]*width:\s*min\(72vw,\s*280px\);/,
    );
  });

  it('keeps the archived drawer scroll region full-height on mobile', () => {
    expect(globalsCss).toMatch(
      /\.kanban-archive-drawer-list\s*\{[\s\S]*max-height:\s*calc\(100dvh - 140px\);[\s\S]*overflow:\s*auto;/,
    );
    expect(globalsCss).toMatch(
      /\.task-notification-drawer-list\s*\{[\s\S]*max-height:\s*calc\(100dvh - 140px\);[\s\S]*overflow:\s*auto;/,
    );
    expect(globalsCss).not.toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.kanban-archive-drawer-list\s*\{[\s\S]*max-height:\s*34dvh;/,
    );
  });

  it('raises the small project action affordances to a touch-friendly size', () => {
    expect(projectsCss).toMatch(/\.cardLink\s*\{[\s\S]*inset:\s*0;[\s\S]*z-index:\s*1;/);
    expect(dashboardOperatorDeskCss).toMatch(
      /@media \(max-width: 48rem\)\s*\{[\s\S]*\.portfolioMatrixPoint\s*\{[\s\S]*width:\s*var\(--ui-hit-touch-min\);[\s\S]*height:\s*var\(--ui-hit-touch-min\);/,
    );
    expect(dashboardInfoHintSource).toContain('size={44}');
    expect(dashboardInfoHintSource).toContain('focus: true');
    expect(dashboardInfoHintSource).toContain('touch: true');
    expect(dashboardInfoHintSource).not.toContain('color="gray"');
    expect(dashboardInfoHintSource).toContain('var(--ui-muted-text)');
    expect(dashboardPageSource).toContain("minHeight: 'var(--ui-hit-touch-min)'");
    expect(dashboardInstrumentRailSource).toContain("minHeight: 'var(--ui-hit-touch-min)'");
    expect(dashboardInstrumentRailSource).not.toContain('color="brand"');
    expect(dashboardInstrumentRailSource).not.toContain('color="cyan"');
    expect(dashboardInstrumentRailSource).not.toContain('c="dimmed"');
    expect(dashboardPortfolioOverviewSource).not.toContain('c="dimmed"');
    expect(projectCardMenuSource).toContain('size={44}');
  });
});
