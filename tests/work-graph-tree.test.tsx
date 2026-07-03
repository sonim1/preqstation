// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildGraphElements,
  groupEvidenceByNode,
  nodeStatusColor,
  nodeStatusLabel,
} from '@/app/components/work-graph-model';
import { type WorkGraphPayload, WorkGraphTree } from '@/app/components/work-graph-tree';

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
      body: 'Create the graph mutation route.',
      engine: 'codex',
      runtime_target: 'local',
      result_summary: 'API route wired.',
      metadata: {
        workflow_profile: {
          requested: 'auto',
          manual_command: null,
          resolved: 'gstack-plan-eng-review',
          resolved_command: '/plan-eng-review',
          resolved_reason: 'Architecture review needed before implementation.',
        },
      },
    },
  ],
  dependencies: [],
  events: [],
  evidence: [
    {
      id: 'evidence-child',
      node_id: 'child',
      kind: 'test',
      title: 'Route test',
      summary: 'Covers work graph node creation.',
    },
  ],
  workflow_memory: 'Remember auth token identity.',
};

describe('WorkGraphTree', () => {
  afterEach(() => {
    cleanup();
  });

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

    expect(screen.getByText('Work graph')).toBeTruthy();
    expect(screen.getByTestId('work-graph-canvas')).toBeTruthy();
    expect(screen.getByText('Waiting')).toBeTruthy();
    expect(screen.getAllByText('Root task').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Implement API').length).toBeGreaterThan(0);
    expect(screen.getByText('Remember auth token identity.')).toBeTruthy();
  });

  it('renders the graph canvas as the primary work view with root notes inside the root node', async () => {
    render(
      <MantineProvider>
        <WorkGraphTree
          taskKey="PREQ-1"
          initialGraph={graph}
          rootNoteMarkdown="## Context\nKeep notes inside the root task node."
        />
      </MantineProvider>,
    );

    expect(screen.getByTestId('work-graph-canvas')).toBeTruthy();
    expect(
      within(screen.getByTestId('work-graph-node-root')).getByText(
        /Keep notes inside the root task node/,
      ),
    ).toBeTruthy();
    expect(screen.queryByText('No work graph yet')).toBeNull();
  });

  it('uses a node inspector for selected-node notes, result, and evidence', () => {
    render(
      <MantineProvider>
        <WorkGraphTree
          taskKey="PREQ-1"
          initialGraph={graph}
          rootNoteMarkdown="## Context\nKeep notes attached to the root node."
        />
      </MantineProvider>,
    );

    const inspector = screen.getByTestId('work-graph-inspector');
    expect(within(inspector).getByText('Root task')).toBeTruthy();
    expect(within(inspector).getByText(/Keep notes attached to the root node/)).toBeTruthy();
    expect(screen.getAllByTestId(/^work-graph-node-/)).toHaveLength(2);

    fireEvent.click(screen.getByTestId('work-graph-node-child'));

    expect(within(inspector).getByText('Implement API')).toBeTruthy();
    expect(within(inspector).getByText('Create the graph mutation route.')).toBeTruthy();
    expect(within(inspector).getByText('API route wired.')).toBeTruthy();
    expect(within(inspector).getByText('Workflow')).toBeTruthy();
    expect(within(inspector).getByText('gstack-plan-eng-review')).toBeTruthy();
    expect(within(inspector).getByText('/plan-eng-review')).toBeTruthy();
    expect(
      within(inspector).getByText('Architecture review needed before implementation.'),
    ).toBeTruthy();
    expect(within(inspector).getByText('Route test')).toBeTruthy();
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

  it('updates the rendered graph when initialGraph changes and the selected node disappears', () => {
    const { rerender } = render(
      <MantineProvider>
        <WorkGraphTree taskKey="PREQ-1" initialGraph={graph} />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByTestId('work-graph-node-child'));
    expect(
      within(screen.getByTestId('work-graph-inspector')).getByText('Implement API'),
    ).toBeTruthy();

    const nextGraph: WorkGraphPayload = {
      ...graph,
      nodes: [
        {
          id: 'next-root',
          parent_id: null,
          type: 'root',
          status: 'ready',
          title: 'Replanned root',
          body: 'Fresh graph body.',
        },
      ],
      evidence: [],
      dependencies: [],
    };

    rerender(
      <MantineProvider>
        <WorkGraphTree taskKey="PREQ-1" initialGraph={nextGraph} />
      </MantineProvider>,
    );

    expect(screen.queryByText('Implement API')).toBeNull();
    expect(
      within(screen.getByTestId('work-graph-inspector')).getByText('Replanned root'),
    ).toBeTruthy();
  });

  it('keeps root notes on one canonical root node when multiple top-level nodes exist', () => {
    const { flowNodes } = buildGraphElements({
      nodes: [
        graph.nodes[0],
        {
          id: 'loose-root',
          parent_id: null,
          type: 'investigate',
          status: 'ready',
          title: 'Loose top-level work',
        },
      ],
      dependencies: [],
      evidenceByNode: groupEvidenceByNode([]),
      rootNoteMarkdown: 'Root-only context',
    });

    expect(flowNodes.find((node) => node.id === 'root')?.data.rootNoteMarkdown).toBe(
      'Root-only context',
    );
    expect(flowNodes.find((node) => node.id === 'loose-root')?.data.rootNoteMarkdown).toBeNull();
  });

  it('uses vertical node positions for compact graph layouts', () => {
    const { flowNodes } = buildGraphElements({
      nodes: graph.nodes,
      dependencies: [],
      evidenceByNode: groupEvidenceByNode([]),
      layoutDirection: 'vertical',
    });

    const root = flowNodes.find((node) => node.id === 'root');
    const child = flowNodes.find((node) => node.id === 'child');

    expect(root?.data.layoutDirection).toBe('vertical');
    expect(child?.data.layoutDirection).toBe('vertical');
    expect(child?.position.y).toBeGreaterThan(root?.position.y ?? 0);
    expect(child?.position.x).toBeLessThan(100);
  });

  it('centers parent nodes across child lanes in horizontal graph layouts', () => {
    const { flowNodes } = buildGraphElements({
      nodes: [
        {
          id: 'root',
          parent_id: null,
          type: 'root',
          status: 'completed',
          title: 'Root task',
        },
        {
          id: 'plan',
          parent_id: 'root',
          type: 'plan',
          status: 'completed',
          title: 'Plan work',
        },
        {
          id: 'build',
          parent_id: 'root',
          type: 'implement',
          status: 'running',
          title: 'Build work',
        },
        {
          id: 'review',
          parent_id: 'build',
          type: 'review',
          status: 'ready',
          title: 'Review work',
        },
        {
          id: 'docs',
          parent_id: 'root',
          type: 'docs',
          status: 'waiting',
          title: 'Docs work',
        },
      ],
      dependencies: [],
      evidenceByNode: groupEvidenceByNode([]),
    });

    const root = flowNodes.find((node) => node.id === 'root');
    const plan = flowNodes.find((node) => node.id === 'plan');
    const docs = flowNodes.find((node) => node.id === 'docs');
    const build = flowNodes.find((node) => node.id === 'build');
    const review = flowNodes.find((node) => node.id === 'review');

    expect(root?.position.y).toBeGreaterThan(plan?.position.y ?? 0);
    expect(root?.position.y).toBeLessThan(docs?.position.y ?? Number.POSITIVE_INFINITY);
    expect(review?.position.y).toBe(build?.position.y);
  });

  it('does not render dependency edges that duplicate parent edges', () => {
    const { flowEdges } = buildGraphElements({
      nodes: graph.nodes,
      dependencies: [
        {
          node_id: 'child',
          depends_on_node_id: 'root',
        },
      ],
      evidenceByNode: groupEvidenceByNode([]),
    });

    expect(flowEdges.map((edge) => edge.id)).toEqual(['parent:root:child']);
  });

  it('treats waiting-for-user nodes as waiting state in graph styling', () => {
    const { flowEdges } = buildGraphElements({
      nodes: [
        graph.nodes[0],
        {
          id: 'approval',
          parent_id: 'root',
          type: 'review',
          status: 'waiting_for_user',
          title: 'Approve release',
        },
      ],
      dependencies: [],
      evidenceByNode: groupEvidenceByNode([]),
    });

    expect(flowEdges[0]?.style).toMatchObject({ stroke: 'var(--ui-warning)' });
    expect(nodeStatusColor('waiting_for_user')).toBe('yellow');
    expect(nodeStatusLabel('waiting_for_user')).toBe('waiting for user');
  });

  it('promotes dependency targets into later columns in horizontal graph layouts', () => {
    const { flowNodes } = buildGraphElements({
      nodes: [
        {
          id: 'root',
          parent_id: null,
          type: 'root',
          status: 'completed',
          title: 'Root task',
        },
        {
          id: 'plan',
          parent_id: 'root',
          type: 'plan',
          status: 'completed',
          title: 'Plan work',
        },
        {
          id: 'docs',
          parent_id: 'root',
          type: 'docs',
          status: 'waiting',
          title: 'Docs work',
        },
      ],
      dependencies: [
        {
          node_id: 'docs',
          depends_on_node_id: 'plan',
        },
      ],
      evidenceByNode: groupEvidenceByNode([]),
    });

    const plan = flowNodes.find((node) => node.id === 'plan');
    const docs = flowNodes.find((node) => node.id === 'docs');

    expect(docs?.position.x).toBeGreaterThan(plan?.position.x ?? 0);
  });

  it('keeps chained dependency targets moving right regardless of dependency order', () => {
    const { flowNodes } = buildGraphElements({
      nodes: [
        {
          id: 'root',
          parent_id: null,
          type: 'root',
          status: 'completed',
          title: 'Root task',
        },
        {
          id: 'plan',
          parent_id: 'root',
          type: 'plan',
          status: 'completed',
          title: 'Plan work',
        },
        {
          id: 'build',
          parent_id: 'root',
          type: 'implement',
          status: 'running',
          title: 'Build work',
        },
        {
          id: 'docs',
          parent_id: 'root',
          type: 'docs',
          status: 'waiting',
          title: 'Docs work',
        },
      ],
      dependencies: [
        {
          node_id: 'docs',
          depends_on_node_id: 'build',
        },
        {
          node_id: 'build',
          depends_on_node_id: 'plan',
        },
      ],
      evidenceByNode: groupEvidenceByNode([]),
    });

    const plan = flowNodes.find((node) => node.id === 'plan');
    const build = flowNodes.find((node) => node.id === 'build');
    const docs = flowNodes.find((node) => node.id === 'docs');

    expect(build?.position.x).toBeGreaterThan(plan?.position.x ?? 0);
    expect(docs?.position.x).toBeGreaterThan(build?.position.x ?? 0);
  });

  it('omits parent edges when a non-parent dependency already defines incoming flow', () => {
    const { flowEdges } = buildGraphElements({
      nodes: [
        {
          id: 'root',
          parent_id: null,
          type: 'root',
          status: 'completed',
          title: 'Root task',
        },
        {
          id: 'plan',
          parent_id: 'root',
          type: 'plan',
          status: 'completed',
          title: 'Plan work',
        },
        {
          id: 'docs',
          parent_id: 'root',
          type: 'docs',
          status: 'waiting',
          title: 'Docs work',
        },
      ],
      dependencies: [
        {
          id: 'plan-to-docs',
          node_id: 'docs',
          depends_on_node_id: 'plan',
        },
      ],
      evidenceByNode: groupEvidenceByNode([]),
    });

    expect(flowEdges.map((edge) => edge.id)).toEqual(['parent:root:plan', 'plan-to-docs']);
  });

  it('does not show root notes in the inspector for non-canonical top-level nodes', () => {
    const multiRootGraph: WorkGraphPayload = {
      ...graph,
      nodes: [
        graph.nodes[0],
        {
          id: 'loose-root',
          parent_id: null,
          type: 'investigate',
          status: 'ready',
          title: 'Loose top-level work',
        },
      ],
      evidence: [],
      dependencies: [],
    };

    render(
      <MantineProvider>
        <WorkGraphTree
          taskKey="PREQ-1"
          initialGraph={multiRootGraph}
          rootNoteMarkdown="Root-only context"
        />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByTestId('work-graph-node-loose-root'));

    const inspector = screen.getByTestId('work-graph-inspector');
    expect(within(inspector).getByText('Loose top-level work')).toBeTruthy();
    expect(within(inspector).queryByText('Root-only context')).toBeNull();
  });

  it('drops parent and dependency edges that point to missing nodes', () => {
    const { flowEdges } = buildGraphElements({
      nodes: [
        {
          id: 'orphan',
          parent_id: 'missing-parent',
          type: 'implement',
          status: 'ready',
          title: 'Orphan work',
        },
        {
          id: 'known',
          parent_id: null,
          type: 'review',
          status: 'ready',
          title: 'Known work',
        },
      ],
      dependencies: [
        {
          id: 'missing-source',
          node_id: 'known',
          depends_on_node_id: 'missing-dependency',
        },
        {
          id: 'missing-target',
          node_id: 'missing-node',
          depends_on_node_id: 'known',
        },
      ],
      evidenceByNode: groupEvidenceByNode([]),
    });

    expect(flowEdges).toHaveLength(0);
  });
});
