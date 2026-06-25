import { describe, expect, it } from 'vitest';

import { buildProjectWorkGraphSummary } from '@/lib/project-work-graph-summary';

describe('buildProjectWorkGraphSummary', () => {
  it('summarizes active graph roots, waiting decisions, failures, blockers, results, and proposals', () => {
    const summary = buildProjectWorkGraphSummary({
      nodes: [
        {
          id: 'root-1',
          taskId: 'task-1',
          type: 'root',
          status: 'running',
          title: 'Root task',
          resultSummary: null,
          updatedAt: new Date('2026-06-24T10:00:00.000Z'),
          task: { taskKey: 'PROJ-1', title: 'Ship bridge', status: 'todo' },
        },
        {
          id: 'wait-1',
          taskId: 'task-1',
          type: 'decision',
          status: 'waiting_for_user',
          title: 'Choose rollout',
          resultSummary: null,
          updatedAt: new Date('2026-06-24T11:00:00.000Z'),
          task: { taskKey: 'PROJ-1', title: 'Ship bridge', status: 'todo' },
        },
        {
          id: 'failed-1',
          taskId: 'task-2',
          type: 'test',
          status: 'failed',
          title: 'Run tests',
          resultSummary: 'Vitest failed.',
          updatedAt: new Date('2026-06-24T12:00:00.000Z'),
          task: { taskKey: 'PROJ-2', title: 'Harden tests', status: 'ready' },
        },
        {
          id: 'result-1',
          taskId: 'task-3',
          type: 'result',
          status: 'completed',
          title: 'Deploy preview',
          resultSummary: 'Preview deployed.',
          updatedAt: new Date('2026-06-24T13:00:00.000Z'),
          task: { taskKey: 'PROJ-3', title: 'Preview', status: 'done' },
        },
      ],
      proposals: [
        {
          id: 'proposal-1',
          taskId: 'task-1',
          status: 'pending',
          target: 'docs/architecture.md',
          body: 'Remember bridge contract.',
          createdAt: new Date('2026-06-24T14:00:00.000Z'),
          task: { taskKey: 'PROJ-1', title: 'Ship bridge' },
        },
      ],
    });

    expect(summary.counts).toEqual({
      activeRoots: 1,
      waitingDecisions: 1,
      failedNodes: 1,
      blockedNodes: 0,
      recentResults: 1,
      pendingProposals: 1,
    });
    expect(summary.waitingDecisions[0].title).toBe('Choose rollout');
    expect(summary.failedNodes[0].taskKey).toBe('PROJ-2');
    expect(summary.recentResults[0].summary).toBe('Preview deployed.');
    expect(summary.pendingProposals[0].target).toBe('docs/architecture.md');
  });
});
