'use client';

import { Alert, Group, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Background, Controls, ReactFlow } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';

import { WorkGraphEmptyState } from '@/app/components/work-graph-empty-state';
import {
  buildGraphElements,
  groupEvidenceByNode,
  selectPreferredWorkGraphNode,
  type WorkGraphDependencyView,
  type WorkNodeEvidenceView,
  type WorkNodeView,
} from '@/app/components/work-graph-model';
import { workGraphNodeTypes } from '@/app/components/work-graph-node-card';
import { WorkGraphNodeInspector } from '@/app/components/work-graph-node-inspector';
import {
  type WorkGraphSummary,
  WorkGraphSummaryBadge,
} from '@/app/components/work-graph-summary-badge';

import classes from './work-graph-tree.module.css';

const EMPTY_NODES: WorkNodeView[] = [];
const EMPTY_DEPENDENCIES: WorkGraphDependencyView[] = [];
const EMPTY_EVIDENCE: WorkNodeEvidenceView[] = [];

export type WorkGraphPayload = {
  summary?: WorkGraphSummary | null;
  nodes: WorkNodeView[];
  dependencies?: WorkGraphDependencyView[];
  events?: Array<Record<string, unknown>>;
  evidence?: WorkNodeEvidenceView[];
  workflow_memory?: string | null;
  workflowMemory?: string | null;
};

export function WorkGraphTree({
  taskKey,
  initialGraph,
  rootNoteMarkdown,
}: {
  taskKey: string;
  initialGraph?: WorkGraphPayload | null;
  rootNoteMarkdown?: string | null;
}) {
  const [loadedGraph, setLoadedGraph] = useState<WorkGraphPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const isCompactLayout = useMediaQuery('(max-width: 48em)', false);

  useEffect(() => {
    if (initialGraph !== undefined) return;
    let cancelled = false;

    void fetch(`/api/tasks/${encodeURIComponent(taskKey)}/work-graph`)
      .then(async (response) => {
        const payload = await response.json();
        if (!cancelled) {
          if (payload?.ok) setLoadedGraph(payload.data as WorkGraphPayload);
          else setLoadError(payload?.error?.message ?? 'Unable to load work graph.');
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('Unable to load work graph.');
      });

    return () => {
      cancelled = true;
    };
  }, [initialGraph, taskKey]);

  const graph = initialGraph !== undefined ? initialGraph : loadedGraph;
  const graphNodes = graph?.nodes ?? EMPTY_NODES;
  const graphDependencies = graph?.dependencies ?? EMPTY_DEPENDENCIES;
  const graphEvidence = graph?.evidence ?? EMPTY_EVIDENCE;
  const selectedNodeIdForLookup = useMemo(
    () => (graphNodes.some((node) => node.id === selectedNodeId) ? selectedNodeId : null),
    [graphNodes, selectedNodeId],
  );

  const evidenceByNode = useMemo(() => groupEvidenceByNode(graphEvidence), [graphEvidence]);
  const { flowNodes, flowEdges } = useMemo(
    () =>
      buildGraphElements({
        nodes: graphNodes,
        dependencies: graphDependencies,
        evidenceByNode,
        rootNoteMarkdown,
        layoutDirection: isCompactLayout ? 'vertical' : 'horizontal',
      }),
    [evidenceByNode, graphDependencies, graphNodes, isCompactLayout, rootNoteMarkdown],
  );
  const selectedNode = useMemo(
    () => selectPreferredWorkGraphNode(graphNodes, selectedNodeIdForLookup),
    [graphNodes, selectedNodeIdForLookup],
  );
  const selectedNodeIdForRender = selectedNode?.id ?? null;
  const displayedNodes = useMemo(
    () =>
      flowNodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeIdForRender,
        data: {
          ...node.data,
          isSelected: node.id === selectedNodeIdForRender,
          onSelect: setSelectedNodeId,
        },
      })),
    [flowNodes, selectedNodeIdForRender],
  );
  const selectedEvidence = selectedNode ? (evidenceByNode.get(selectedNode.id) ?? []) : [];
  const selectedRootNoteMarkdown =
    flowNodes.find((node) => node.id === selectedNodeIdForRender)?.data.rootNoteMarkdown ?? null;
  const memory = graph?.workflow_memory ?? graph?.workflowMemory ?? null;

  return (
    <Stack gap="sm" data-panel="work-graph-tree" className={classes.root}>
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Text component="h2" fw={800} size="sm">
            Work graph
          </Text>
          <Text size="xs" c="dimmed">
            Select a node to inspect notes, results, and evidence.
          </Text>
        </Stack>
        <WorkGraphSummaryBadge summary={graph?.summary} />
      </Group>

      {loadError ? (
        <Alert color="red" variant="light">
          {loadError}
        </Alert>
      ) : null}

      {flowNodes.length === 0 ? (
        <WorkGraphEmptyState />
      ) : (
        <div className={classes.graphWorkspace} data-testid="work-graph-canvas">
          <div className={classes.flowStage}>
            <ReactFlow
              nodes={displayedNodes}
              edges={flowEdges}
              nodeTypes={workGraphNodeTypes}
              fitView
              fitViewOptions={{ padding: isCompactLayout ? 0.08 : 0.16 }}
              minZoom={isCompactLayout ? 0.5 : 0.35}
              maxZoom={1.25}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              proOptions={{ hideAttribution: true }}
              className={classes.flow}
            >
              <Background color="color-mix(in srgb, var(--ui-accent), transparent 76%)" gap={22} />
              <Controls showInteractive={false} className={classes.controls} />
            </ReactFlow>
          </div>
          {selectedNode ? (
            <WorkGraphNodeInspector
              node={selectedNode}
              evidence={selectedEvidence}
              rootNoteMarkdown={selectedRootNoteMarkdown}
            />
          ) : null}
        </div>
      )}

      {memory ? (
        <Stack gap={4} className={classes.memoryPanel}>
          <Text size="xs" fw={700} c="dimmed">
            Workflow memory
          </Text>
          <Text size="sm">{memory}</Text>
        </Stack>
      ) : null}
    </Stack>
  );
}
