import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ProjectBoardLoading from '@/app/(workspace)/(main)/board/[key]/loading';
import BoardLoading from '@/app/(workspace)/(main)/board/loading';
import { BoardLoadingShell } from '@/app/components/board-loading-shell';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');

function render(element: React.ReactElement) {
  return renderToStaticMarkup(<MantineProvider>{element}</MantineProvider>);
}

describe('app/components/board-loading-shell', () => {
  it('renders shared desktop and mobile loading shells', () => {
    const html = render(<BoardLoadingShell />);

    expect(html).toContain('data-board-loading-shell="true"');
    expect(html).toContain('kanban-scroll');
    expect(html).toContain('board-loading-shell-mobile');
    expect(html).toContain('board-loading-shell-desktop');
    expect(html).toContain('kanban-grid');
    expect(html.match(/data-board-loading-column="true"/g)).toHaveLength(5);
    expect(html.match(/data-board-loading-body="true"/g)).toHaveLength(5);
    expect(html).toContain('data-board-loading-mobile-shell="true"');
    expect(html).toContain('kanban-mobile-tabs');
    expect(html).toContain('kanban-mobile-panels');
    expect(html).toContain('kanban-mobile-panel-body');
    expect(html).toContain('kanban-mobile-tab-bar');
    expect(html.indexOf('kanban-mobile-panels')).toBeLessThan(
      html.indexOf('kanban-mobile-tab-bar'),
    );
    expect(html.match(/data-board-loading-mobile-tab="true"/g)?.length).toBeGreaterThan(1);
    expect(html.match(/data-board-loading-mobile-card="true"/g)?.length).toBeGreaterThan(1);
    expect(html).not.toMatch(/class="[^"]*mantine-hidden-from-sm/);
    expect(html).not.toMatch(/class="[^"]*mantine-visible-from-sm/);
  });

  it('uses project-owned media queries to swap loading shells between mobile and desktop breakpoints', () => {
    expect(globalsCss).toMatch(
      /\.board-loading-shell-mobile\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*flex:\s*1(?: 1 auto| 1)?;[\s\S]*min-height:\s*0;/,
    );
    expect(globalsCss).toMatch(/\.board-loading-shell-desktop\s*\{[\s\S]*display:\s*none;/);
    expect(globalsCss).toMatch(
      /@media \(min-width:\s*48em\)\s*\{[\s\S]*\.board-loading-shell-mobile\s*\{[\s\S]*display:\s*none;[\s\S]*\}[\s\S]*\.board-loading-shell-desktop\s*\{[\s\S]*display:\s*block;[\s\S]*\}/,
    );
  });

  it('board route loading uses the board-specific loading shell', () => {
    const html = render(<BoardLoading />);

    expect(html).toContain('data-board-loading-shell="true"');
    expect(html).toContain('data-board-loading-mobile-shell="true"');
  });

  it('project board route loading uses the board-specific loading shell', () => {
    const html = render(<ProjectBoardLoading />);

    expect(html).toContain('data-board-loading-shell="true"');
    expect(html).toContain('data-board-loading-mobile-shell="true"');
  });
});
