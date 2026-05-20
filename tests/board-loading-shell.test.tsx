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
    expect(html).toContain('kanban-stage-content');
    expect(html).toContain('kanban-board-region');
    expect(html).toContain('kanban-scroll');
    expect(html).toContain('board-loading-shell-mobile');
    expect(html).toContain('board-loading-shell-desktop');
    expect(html).toContain('kanban-board-shell');
    expect(html).toContain('kanban-grid');
    expect(html.match(/data-board-loading-column="true"/g)).toHaveLength(5);
    expect(html.match(/data-board-loading-body="true"/g)).toHaveLength(5);
    expect(html.match(/data-board-loading-card="true"/g)).toHaveLength(15);
    expect(html).toContain('data-board-loading-mobile-shell="true"');
    expect(html).toContain('kanban-mobile-tabs');
    expect(html).toContain('kanban-mobile-board-wrapper');
    expect(html).toContain('kanban-mobile-panels');
    expect(html).toContain('kanban-mobile-panel-body');
    expect(html).toContain('kanban-mobile-controls-wrapper');
    expect(html).toContain('data-board-loading-mobile-actions="true"');
    expect(html).toContain('kanban-mobile-tab-bar');
    expect(html.indexOf('kanban-mobile-board-wrapper')).toBeLessThan(
      html.indexOf('kanban-mobile-controls-wrapper'),
    );
    expect(html.indexOf('board-loading-shell-mobile')).toBeLessThan(html.indexOf('kanban-scroll'));
    expect(html.indexOf('kanban-mobile-panels')).toBeLessThan(
      html.indexOf('data-board-loading-mobile-actions="true"'),
    );
    expect(html.indexOf('data-board-loading-mobile-actions="true"')).toBeLessThan(
      html.indexOf('kanban-mobile-tab-bar'),
    );
    expect(html.match(/data-board-loading-mobile-tab="true"/g)?.length).toBeGreaterThan(1);
    expect(html.match(/data-board-loading-mobile-card="true"/g)?.length).toBeGreaterThan(1);
    expect(html).toContain('kanbanCardFrame');
    expect(html).toContain('kanbanCardBody');
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

  it('keeps loading kanban columns boundary-free like the live board', () => {
    expect(globalsCss).toMatch(
      /\.kanban-column\s*\{[\s\S]*border:\s*0;[\s\S]*border-color:\s*transparent;[\s\S]*background:\s*transparent;[\s\S]*box-shadow:\s*none;/,
    );
    expect(globalsCss).not.toMatch(
      /html\[data-mantine-color-scheme='dark'\]\s+\.kanban-column,\s*html\[data-mantine-color-scheme='dark'\]\s+\.kanban-quickadd-panel[\s\S]*?border-color:\s*var\(--ui-border\);/,
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
