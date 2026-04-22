import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const dashboardPageSource = readFileSync(
  resolve(process.cwd(), 'app/(workspace)/(main)/dashboard/page.tsx'),
  'utf8',
);
const projectsPageSource = readFileSync(
  resolve(process.cwd(), 'app/(workspace)/(main)/projects/page.tsx'),
  'utf8',
);
const settingsPageSource = readFileSync(
  resolve(process.cwd(), 'app/(workspace)/(main)/settings/page.tsx'),
  'utf8',
);
const connectionsPageSource = readFileSync(
  resolve(process.cwd(), 'app/(workspace)/(main)/connections/page.tsx'),
  'utf8',
);
const dashboardDeskSource = readFileSync(
  resolve(process.cwd(), 'app/components/dashboard-operator-desk.tsx'),
  'utf8',
);
const dashboardDeskCssSource = readFileSync(
  resolve(process.cwd(), 'app/components/dashboard-operator-desk.module.css'),
  'utf8',
);
const workspacePageHeaderCssSource = readFileSync(
  resolve(process.cwd(), 'app/components/workspace-page-header.module.css'),
  'utf8',
);
const connectionsPageCssSource = readFileSync(
  resolve(process.cwd(), 'app/(workspace)/(main)/connections/connections-page.module.css'),
  'utf8',
);

describe('workspace page header adoption', () => {
  it('routes dashboard, projects, settings, and connections through the shared page header', () => {
    expect(dashboardPageSource).toContain('WorkspacePageHeader');
    expect(projectsPageSource).toContain('WorkspacePageHeader');
    expect(settingsPageSource).toContain('WorkspacePageHeader');
    expect(connectionsPageSource).toContain('WorkspacePageHeader');
  });

  it('drops the old operator desk title copy from the dashboard module shell', () => {
    expect(dashboardDeskSource).not.toContain('Operator desk');
    expect(dashboardDeskSource).not.toContain('Preq Station');
  });

  it('keeps the dashboard page on the same fluid content width as the other top-level pages', () => {
    expect(dashboardPageSource).toContain('fluid');
    expect(dashboardPageSource).not.toContain('size="xl"');
  });

  it('renders the shared page header without a bottom divider line', () => {
    expect(workspacePageHeaderCssSource).not.toContain('border-bottom');
  });

  it('renders the shared page header with h1 semantics for top-level routes', () => {
    expect(workspacePageHeaderCssSource).not.toContain('border-bottom');
    expect(
      readFileSync(resolve(process.cwd(), 'app/components/workspace-page-header.tsx'), 'utf8'),
    ).toContain('component="h1"');
  });

  it('removes the obsolete connections pageHeader selectors after extracting the shared header', () => {
    expect(connectionsPageCssSource).not.toContain('.pageHeader');
  });

  it('uses h2 semantics for the first major sections under each top-level page header', () => {
    expect(settingsPageSource).toContain('component="h2"');
    expect(projectsPageSource).toContain('component="h2"');
    expect(connectionsPageSource).toContain('component="h2"');
  });

  it('keeps dashboard contextual actions as a lightweight row without a divider rail', () => {
    expect(dashboardDeskCssSource).not.toMatch(/\.topbar\s*\{[^}]*border-bottom:/);
    expect(dashboardDeskCssSource).not.toMatch(/\.topbar\s*\{[^}]*margin-bottom:/);
    expect(dashboardDeskCssSource).not.toMatch(/\.topbar\s*\{[^}]*padding-bottom:/);
  });
});
