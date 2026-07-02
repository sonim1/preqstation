'use client';

import { Alert, Group, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Background, Controls, ReactFlow } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';

import { WorkGraphEmptyState } from '@/app/components/work-graph-empty-state';
import {
  buildGraphElements,
  groupEvidenceByNode,
  parentIdFor,
  selectPreferredWorkGraphNode,
  type WorkGraphDependencyView,
  type WorkGraphFlowNode,
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

function attachRootNoteToFlowNodes(
  flowNodes: WorkGraphFlowNode[],
  rootNoteMarkdown: string | null | undefined,
) {
  if (rootNoteMarkdown === undefined) return flowNodes;

  const rootNodes = flowNodes.filter((node) => !parentIdFor(node.data.node));
  const rootNodeId =
    rootNodes.find((node) => node.data.node.type === 'root')?.id ?? rootNodes[0]?.id ?? null;
  if (!rootNodeId) return flowNodes;

  return flowNodes.map((node) =>
    node.id === rootNodeId ? { ...node, data: { ...node.data, rootNoteMarkdown } } : node,
  );
}

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
  const isCompactLayout = useMediaQuery('(max-width: 48em)', false, {
    getInitialValueInEffect: true,
  });

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
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load work graph.');
        }
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
  const { flowNodes: layoutFlowNodes, flowEdges } = useMemo(
    () =>
      buildGraphElements({
        nodes: graphNodes,
        dependencies: graphDependencies,
        evidenceByNode,
        layoutDirection: isCompactLayout ? 'vertical' : 'horizontal',
      }),
    [evidenceByNode, graphDependencies, graphNodes, isCompactLayout],
  );
  const flowNodes = useMemo(
    () => attachRootNoteToFlowNodes(layoutFlowNodes, rootNoteMarkdown),
    [layoutFlowNodes, rootNoteMarkdown],
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
              className={classes.flow}
            >
              <Background color="var(--work-graph-grid-color)" gap={22} />
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
