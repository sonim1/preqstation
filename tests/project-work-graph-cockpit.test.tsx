import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProjectWorkGraphCockpit } from '@/app/components/project-work-graph-cockpit';
import type { ProjectWorkGraphSummary } from '@/lib/project-work-graph-summary';

const summary: ProjectWorkGraphSummary = {
  counts: {
    activeRoots: 2,
    waitingDecisions: 1,
    failedNodes: 1,
    blockedNodes: 1,
    recentResults: 1,
    pendingProposals: 1,
  },
  activeRoots: [
    {
      id: 'root-1',
      taskKey: 'PROJ-1',
      taskTitle: 'Ship bridge',
      title: 'Ship bridge',
      status: 'running',
    },
  ],
  waitingDecisions: [
    {
      id: 'wait-1',
      taskKey: 'PROJ-2',
      taskTitle: 'Rollout',
      title: 'Choose rollout',
      status: 'waiting_for_user',
    },
  ],
  failedNodes: [
    {
      id: 'failed-1',
      taskKey: 'PROJ-3',
      taskTitle: 'Tests',
      title: 'Run tests',
      status: 'failed',
    },
  ],
  blockedNodes: [
    {
      id: 'blocked-1',
      taskKey: 'PROJ-4',
      taskTitle: 'Deploy',
      title: 'Waiting for secret',
      status: 'blocked',
    },
  ],
  recentResults: [
    {
      id: 'result-1',
      taskKey: 'PROJ-5',
      taskTitle: 'Preview',
      title: 'Deploy preview',
      status: 'completed',
      summary: 'Preview deployed.',
    },
  ],
  pendingProposals: [
    {
      id: 'proposal-1',
      taskKey: 'PROJ-6',
      taskTitle: 'Docs',
      target: 'docs/architecture.md',
      body: 'Remember bridge contract.',
    },
  ],
};

describe('ProjectWorkGraphCockpit', () => {
  it('renders project-level graph operations without requiring evidence rows', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ProjectWorkGraphCockpit summary={summary} />
      </MantineProvider>,
    );

    expect(html).toContain('data-project-work-graph-cockpit="true"');
    expect(html).toContain('Active roots');
    expect(html).toContain('Waiting decisions');
    expect(html).toContain('Failed nodes');
    expect(html).toContain('Blocked nodes');
    expect(html).toContain('Pending proposals');
    expect(html).toContain('Choose rollout');
    expect(html).toContain('Run tests');
    expect(html).toContain('docs/architecture.md');
    expect(html).toContain('Preview deployed.');
  });
});
