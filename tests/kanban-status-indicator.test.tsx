import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { KanbanStatusIndicator } from '@/app/components/kanban-status-indicator';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const workflowStatuses = ['inbox', 'todo', 'hold', 'ready', 'done', 'archived'] as const;

function getCssRuleBody(source: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
  return match?.[1] ?? '';
}

describe('app/components/kanban-status-indicator', () => {
  it('renders Hold as a paused off-flow state instead of midpoint progress', () => {
    const html = renderToStaticMarkup(<KanbanStatusIndicator status="hold" />);

    expect(html).toContain('is-hold');
    expect(html).toContain('is-paused');
    expect(html).toContain('data-paused="true"');
    expect(html).toContain('--kanban-status-fill:0%');
    expect(html).toContain('kanban-status-indicator-paused-dot');
  });

  it('maps workflow status button and indicator colors through semantic tokens', () => {
    const statusButtonRule = getCssRuleBody(globalsCss, '.kanban-status-button');

    expect(statusButtonRule).toContain('color: var(--kanban-workflow-status-color);');

    for (const status of workflowStatuses) {
      expect(globalsCss).toContain(`--ui-workflow-status-${status}:`);
      expect(getCssRuleBody(globalsCss, `.kanban-status-button.is-${status}`)).toContain(
        `--kanban-workflow-status-color: var(--ui-workflow-status-${status});`,
      );
    }

    expect(getCssRuleBody(globalsCss, '.kanban-status-indicator.is-done')).toContain(
      'background: var(--ui-workflow-status-done);',
    );

    const workflowStatusCss = globalsCss.slice(
      globalsCss.indexOf('.kanban-status-button'),
      globalsCss.indexOf('.markdown-output'),
    );

    expect(workflowStatusCss).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});
