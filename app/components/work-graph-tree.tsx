'use client';

import { Alert, Group, Stack, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';

import { WorkGraphEmptyState } from '@/app/components/work-graph-empty-state';
import { type WorkGraphSummary,WorkGraphSummaryBadge } from '@/app/components/work-graph-summary-badge';
import { WorkNodeDetailPanel, type WorkNodeEvidenceView, type WorkNodeView } from '@/app/components/work-node-detail-panel';

export type WorkGraphPayload = {
  summary?: WorkGraphSummary | null;
  nodes: WorkNodeView[];
  dependencies?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  evidence?: WorkNodeEvidenceView[];
  workflow_memory?: string | null;
  workflowMemory?: string | null;
};

function parentIdFor(node: WorkNodeView) {
  return node.parent_id ?? node.parentId ?? null;
}

function evidenceNodeId(evidence: WorkNodeEvidenceView) {
  return evidence.node_id ?? evidence.nodeId ?? null;
}

function flattenTree(nodes: WorkNodeView[]) {
  const childrenByParent = new Map<string | null, WorkNodeView[]>();
  for (const node of nodes) {
    const parentId = parentIdFor(node);
    const list = childrenByParent.get(parentId) ?? [];
    list.push(node);
    childrenByParent.set(parentId, list);
  }

  const result: Array<{ node: WorkNodeView; depth: number }> = [];
  const visit = (node: WorkNodeView, depth: number) => {
    result.push({ node, depth });
    for (const child of childrenByParent.get(node.id) ?? []) {
      visit(child, depth + 1);
    }
  };

  for (const root of childrenByParent.get(null) ?? []) {
    visit(root, 0);
  }

  return result;
}

export function WorkGraphTree({
  taskKey,
  initialGraph,
}: {
  taskKey: string;
  initialGraph?: WorkGraphPayload | null;
}) {
  const [graph, setGraph] = useState<WorkGraphPayload | null>(initialGraph ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (initialGraph !== undefined) return;
    let cancelled = false;

    void fetch(`/api/tasks/${encodeURIComponent(taskKey)}/work-graph`)
      .then(async (response) => {
        const payload = await response.json();
        if (!cancelled) {
          if (payload?.ok) setGraph(payload.data as WorkGraphPayload);
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

  const flattenedNodes = useMemo(() => flattenTree(graph?.nodes ?? []), [graph?.nodes]);
  const evidenceByNode = useMemo(() => {
    const map = new Map<string, WorkNodeEvidenceView[]>();
    for (const item of graph?.evidence ?? []) {
      const nodeId = evidenceNodeId(item);
      if (!nodeId) continue;
      const list = map.get(nodeId) ?? [];
      list.push(item);
      map.set(nodeId, list);
    }
    return map;
  }, [graph?.evidence]);
  const memory = graph?.workflow_memory ?? graph?.workflowMemory ?? null;

  return (
    <Stack gap="sm" data-panel="work-graph-tree">
      <Group justify="space-between" align="center">
        <Text component="h2" fw={700} size="sm">
          Work Tree
        </Text>
        <WorkGraphSummaryBadge summary={graph?.summary} />
      </Group>

      {loadError ? (
        <Alert color="red" variant="light">
          {loadError}
        </Alert>
      ) : null}

      {flattenedNodes.length === 0 ? (
        <WorkGraphEmptyState />
      ) : (
        <Stack gap="sm">
          {flattenedNodes.map(({ node, depth }) => (
            <div key={node.id} style={{ paddingLeft: depth * 18 }}>
              <WorkNodeDetailPanel node={node} evidence={evidenceByNode.get(node.id) ?? []} />
            </div>
          ))}
        </Stack>
      )}

      {memory ? (
        <Stack gap={4}>
          <Text size="xs" fw={700} c="dimmed">
            Workflow memory
          </Text>
          <Text size="sm">{memory}</Text>
        </Stack>
      ) : null}
    </Stack>
  );
}
