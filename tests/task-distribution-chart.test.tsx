import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mantine/charts', () => ({
  DonutChart: () => <svg data-testid="donut-chart" />,
}));

import { TaskDistributionChart } from '@/app/components/task-distribution-chart';
import { TerminologyProvider } from '@/app/components/terminology-provider';
import { DEFAULT_TERMINOLOGY } from '@/lib/terminology';

function renderChart() {
  return renderToStaticMarkup(
    <MantineProvider>
      <TerminologyProvider terminology={DEFAULT_TERMINOLOGY}>
        <TaskDistributionChart inbox={5} todo={4} hold={2} ready={1} done={1} />
      </TerminologyProvider>
    </MantineProvider>,
  );
}

describe('app/components/task-distribution-chart', () => {
  it('renders a workflow snapshot with ordered status rows and no donut output', () => {
    const html = renderChart();

    expect(html).toContain('Workflow Snapshot');
    expect(html).toContain('Bars compare current task counts across the workflow.');
    expect(html).toContain('13 tasks');
    expect(html).toContain('data-workflow-status-row="inbox"');
    expect(html).toContain('data-workflow-status-row="todo"');
    expect(html).toContain('data-workflow-status-row="hold"');
    expect(html).toContain('data-workflow-status-row="ready"');
    expect(html).toContain('data-workflow-status-row="done"');
    expect(html).toContain('data-workflow-status-bar="inbox"');
    expect(html).toContain('data-workflow-status-bar="done"');
    expect(html).toContain('Inbox');
    expect(html).toContain('Todo');
    expect(html).toContain('Hold');
    expect(html).toContain('Ready');
    expect(html).toContain('Done');
    expect(html).not.toContain('Task Distribution');
    expect(html).not.toContain('data-testid="donut-chart"');

    const inboxIndex = html.indexOf('data-workflow-status-row="inbox"');
    const todoIndex = html.indexOf('data-workflow-status-row="todo"');
    const holdIndex = html.indexOf('data-workflow-status-row="hold"');
    const readyIndex = html.indexOf('data-workflow-status-row="ready"');
    const doneIndex = html.indexOf('data-workflow-status-row="done"');

    expect(todoIndex).toBeGreaterThan(inboxIndex);
    expect(holdIndex).toBeGreaterThan(todoIndex);
    expect(readyIndex).toBeGreaterThan(holdIndex);
    expect(doneIndex).toBeGreaterThan(readyIndex);
  });
});
