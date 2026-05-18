// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { KanbanStatusIndicator } from '@/app/components/kanban-status-indicator';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const workflowStatuses = ['inbox', 'todo', 'hold', 'ready', 'done', 'archived'] as const;

function renderWorkflowStatusFixture() {
  const style = document.createElement('style');

  style.textContent = globalsCss;
  document.head.append(style);

  render(
    <>
      {workflowStatuses.map((status) => (
        <button
          key={status}
          type="button"
          className={`kanban-status-button is-${status}`}
          data-testid={`status-button-${status}`}
        >
          <KanbanStatusIndicator status={status} />
        </button>
      ))}
    </>,
  );

  return () => style.remove();
}

describe('app/components/kanban-status-indicator', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders Hold as a paused off-flow state instead of midpoint progress', () => {
    const html = renderToStaticMarkup(<KanbanStatusIndicator status="hold" />);

    expect(html).toContain('is-hold');
    expect(html).toContain('is-paused');
    expect(html).toContain('data-paused="true"');
    expect(html).toContain('--kanban-status-fill:0%');
    expect(html).toContain('kanban-status-indicator-paused-dot');
  });

  it('maps workflow status button and indicator colors through semantic tokens', () => {
    const removeStyle = renderWorkflowStatusFixture();

    try {
      for (const status of workflowStatuses) {
        const button = screen.getByTestId(`status-button-${status}`);
        const buttonStyle = window.getComputedStyle(button);
        const statusToken = window
          .getComputedStyle(document.documentElement)
          .getPropertyValue(`--ui-workflow-status-${status}`);

        expect(button.classList.contains('kanban-status-button')).toBe(true);
        expect(button.classList.contains(`is-${status}`)).toBe(true);
        expect(statusToken).not.toBe('');
        expect(buttonStyle.color).toBe('var(--kanban-workflow-status-color)');
        expect(buttonStyle.getPropertyValue('--kanban-workflow-status-color')).toBe(
          `var(--ui-workflow-status-${status})`,
        );
      }

      const doneIndicator = screen
        .getByTestId('status-button-done')
        .querySelector<HTMLElement>('.kanban-status-indicator');
      const checkIcon = doneIndicator?.querySelector<HTMLElement>('.kanban-status-indicator-check');

      expect(doneIndicator).not.toBeNull();
      expect(checkIcon).not.toBeNull();

      const doneIndicatorStyle = window.getComputedStyle(doneIndicator!);

      expect(doneIndicator!.classList.contains('is-done')).toBe(true);
      expect(doneIndicatorStyle.background).toBe('var(--ui-workflow-status-done-indicator)');
      expect(window.getComputedStyle(checkIcon!).color).toBe('var(--ui-on-accent)');

      document.documentElement.setAttribute('data-mantine-color-scheme', 'dark');

      expect(
        window
          .getComputedStyle(document.documentElement)
          .getPropertyValue('--ui-workflow-status-done-indicator'),
      ).toBe('color-mix(in srgb,var(--ui-success),var(--mantine-color-body) 42%)');
    } finally {
      document.documentElement.removeAttribute('data-mantine-color-scheme');
      removeStyle();
    }
  });
});
