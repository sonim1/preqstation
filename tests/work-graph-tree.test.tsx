// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type WorkGraphPayload,WorkGraphTree } from '@/app/components/work-graph-tree';

const graph: WorkGraphPayload = {
  summary: {
    running_count: 1,
    ready_count: 0,
    waiting_count: 1,
    blocked_count: 0,
    failed_count: 0,
    completed_count: 1,
    root_overlay: 'waiting_for_user',
  },
  nodes: [
    {
      id: 'root',
      parent_id: null,
      type: 'root',
      status: 'completed',
      title: 'Root task',
      body: null,
      engine: null,
      runtime_target: null,
      result_summary: 'Plan accepted',
    },
    {
      id: 'child',
      parent_id: 'root',
      type: 'implement',
      status: 'running',
      title: 'Implement API',
      body: null,
      engine: 'codex',
      runtime_target: 'local',
      result_summary: null,
    },
  ],
  dependencies: [],
  events: [],
  evidence: [],
  workflow_memory: 'Remember auth token identity.',
};

describe('WorkGraphTree', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders summary and nested work nodes', () => {
    render(
      <MantineProvider>
        <WorkGraphTree taskKey="PREQ-1" initialGraph={graph} />
      </MantineProvider>,
    );

    expect(screen.getByText('Work Tree')).toBeTruthy();
    expect(screen.getByText('Waiting')).toBeTruthy();
    expect(screen.getByText('Root task')).toBeTruthy();
    expect(screen.getByText('Implement API')).toBeTruthy();
    expect(screen.getByText('Remember auth token identity.')).toBeTruthy();
  });

  it('renders an empty state when no graph nodes exist', () => {
    render(
      <MantineProvider>
        <WorkGraphTree
          taskKey="PREQ-1"
          initialGraph={{ ...graph, nodes: [], summary: { ...graph.summary, root_overlay: null } }}
        />
      </MantineProvider>,
    );

    expect(screen.getByText('No work graph yet')).toBeTruthy();
  });
});
