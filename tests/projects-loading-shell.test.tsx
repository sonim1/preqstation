import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

const loadingShellSource = readFileSync(
  resolve(process.cwd(), 'app/(workspace)/(main)/projects/projects-loading-shell.tsx'),
  'utf8',
);

function render(element: React.ReactElement) {
  return renderToStaticMarkup(<MantineProvider>{element}</MantineProvider>);
}

function cssModuleClassPattern(className: string) {
  return new RegExp(`class="[^"]*_${className}_[^"]*"`);
}

describe('app/(workspace)/(main)/projects loading shell', () => {
  it('uses the projects-specific loading route shell', () => {
    const html = render(<ProjectsLoading />);

    expect(html).toContain('data-projects-loading-shell="true"');
    expect(html).not.toContain('data-workspace-loading-shell="true"');
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
    const html = render(<ProjectsLoadingShell />);

    expect(html).toMatch(cssModuleClassPattern('rosterHeader'));
    expect(html).toMatch(cssModuleClassPattern('activityPanel'));
    expect(html).toMatch(cssModuleClassPattern('toolbar'));
    expect(html).toMatch(cssModuleClassPattern('rosterGrid'));
    expect(html.match(/class="[^"]*_projectCard_[^"]*"/g)).toHaveLength(6);
    expect(html.match(/class="[^"]*_metricStrip_[^"]*"/g)).toHaveLength(6);
  });

  it('keeps the loading agent status neutral until real data arrives', () => {
    const html = render(<ProjectsLoadingShell />);

    expect(html).toContain('data-active="false"');
    expect(html).not.toContain('data-active="true"');
  });

  it('hides skeleton project cards from assistive technology', () => {
    const html = render(<ProjectsLoadingShell />);

    expect(
      html.match(
        /<article[^>]*data-project-roster-card-skeleton="true"[^>]*aria-hidden="true"/g,
      ),
    ).toHaveLength(6);
  });

  it('ties skeleton card width lists to the configured card count', () => {
    expect(loadingShellSource).toMatch(
      /const cardTitleWidths:\s*readonly \[number,\s*\.\.\.number\[\]\]\s*&\s*\{\s*length:\s*typeof CARD_SKELETON_COUNT\s*;?\s*\}/,
    );
    expect(loadingShellSource).toMatch(
      /const cardDescriptionWidths:\s*readonly \[number,\s*\.\.\.number\[\]\]\s*&\s*\{\s*length:\s*typeof CARD_SKELETON_COUNT\s*;?\s*\}/,
    );
    expect(loadingShellSource).toMatch(
      /const footerWidths:\s*readonly \[number,\s*\.\.\.number\[\]\]\s*&\s*\{\s*length:\s*typeof CARD_SKELETON_COUNT\s*;?\s*\}/,
    );
  });
});
