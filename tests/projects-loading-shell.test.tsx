import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();

  return {
    ...actual,
    SimpleGrid: ({
      children,
      cols,
      spacing: _spacing,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      children: React.ReactNode;
      cols?: number | Partial<Record<'base' | 'sm' | 'md' | 'lg' | 'xl', number>>;
      spacing?: unknown;
    }) => {
      const colMap = typeof cols === 'number' ? { base: cols } : (cols ?? {});

      return (
        <div
          {...props}
          data-simple-grid="true"
          data-cols-base={colMap.base}
          data-cols-md={colMap.md}
          data-cols-xl={colMap.xl}
        >
          {children}
        </div>
      );
    },
  };
});

import ProjectsLoading from '@/app/(workspace)/(main)/projects/loading';
import { ProjectsLoadingShell } from '@/app/(workspace)/(main)/projects/projects-loading-shell';

const loadingRouteSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/projects/loading.tsx'),
  'utf8',
);
const projectsLoadingShellSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/projects/projects-loading-shell.tsx'),
  'utf8',
);

function render(element: React.ReactElement) {
  return renderToStaticMarkup(<MantineProvider>{element}</MantineProvider>);
}

describe('app/(workspace)/(main)/projects loading shell', () => {
  it('uses the projects-specific loading route shell', () => {
    const html = render(<ProjectsLoading />);

    expect(html).toContain('data-projects-loading-shell="true"');
    expect(loadingRouteSource).toContain('ProjectsLoadingShell');
    expect(loadingRouteSource).not.toContain('WorkspaceLoadingShell');
  });

  it('matches the real projects page frame and roster grid shape', () => {
    const html = render(<ProjectsLoadingShell />);

    expect(html).toContain('dashboard-root');
    expect(html).toContain('dashboard-stack');
    expect(html).toContain('data-workspace-page-header="true"');
    expect(html).toContain('data-projects-loading-activity="true"');
    expect(html).toContain('data-projects-loading-toolbar="true"');
    expect(html).toContain('data-project-section="roster"');
    expect(html).toContain('data-simple-grid="true"');
    expect(html).toContain('data-cols-base="1"');
    expect(html).toContain('data-cols-md="2"');
    expect(html).toContain('data-cols-xl="3"');
    expect(html.match(/data-project-roster-card-skeleton="true"/g)).toHaveLength(6);
    expect(html.match(/data-project-card-metrics="true"/g)).toHaveLength(6);
  });

  it('keeps the projects activity chart desktop and mobile bar counts', () => {
    const html = render(<ProjectsLoadingShell />);

    expect(html).toContain('data-projects-activity-range="desktop-30-mobile-7"');
    expect(html.match(/data-projects-activity-loading-bar="true"/g)).toHaveLength(30);
    expect(html.match(/data-projects-activity-mobile-hidden="true"/g)).toHaveLength(23);
  });

  it('reuses the real projects layout classes instead of a separate generic panel layout', () => {
    expect(projectsLoadingShellSource).toContain('styles.rosterHeader');
    expect(projectsLoadingShellSource).toContain('styles.activityPanel');
    expect(projectsLoadingShellSource).toContain('styles.toolbar');
    expect(projectsLoadingShellSource).toContain('styles.rosterGrid');
    expect(projectsLoadingShellSource).toContain('styles.projectCard');
    expect(projectsLoadingShellSource).toContain('styles.metricStrip');
  });
});
