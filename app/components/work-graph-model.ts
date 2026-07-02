import { type Edge, MarkerType, type Node } from '@xyflow/react';

export type WorkNodeView = {
  id: string;
  parent_id?: string | null;
  parentId?: string | null;
  type: string;
  status: string;
  title: string;
  body?: string | null;
  engine?: string | null;
  runtime_target?: string | null;
  runtimeTarget?: string | null;
  waiting_reason?: string | null;
  waitingReason?: string | null;
  result_summary?: string | null;
  resultSummary?: string | null;
};

export type WorkNodeEvidenceView = {
  id: string;
  node_id?: string | null;
  nodeId?: string | null;
  kind: string;
  title: string;
  summary?: string | null;
};

export type WorkGraphDependencyView = {
  id?: string;
  node_id?: string | null;
  nodeId?: string | null;
  depends_on_node_id?: string | null;
  dependsOnNodeId?: string | null;
};

export type WorkGraphLayoutDirection = 'horizontal' | 'vertical';

export type WorkGraphNodeData = {
  node: WorkNodeView;
  evidence: WorkNodeEvidenceView[];
  rootNoteMarkdown?: string | null;
  layoutDirection?: WorkGraphLayoutDirection;
  isSelected?: boolean;
  onSelect?: (nodeId: string) => void;
};

export type WorkGraphFlowNode = Node<WorkGraphNodeData, 'workGraphNode'>;

export function parentIdFor(node: WorkNodeView) {
  return node.parent_id ?? node.parentId ?? null;
}

export function runtimeTargetFor(node: WorkNodeView) {
  return node.runtime_target ?? node.runtimeTarget ?? null;
}

export function resultSummaryFor(node: WorkNodeView) {
  return node.result_summary ?? node.resultSummary ?? null;
}

export function waitingReasonFor(node: WorkNodeView) {
  return node.waiting_reason ?? node.waitingReason ?? null;
}

function evidenceNodeId(evidence: WorkNodeEvidenceView) {
  return evidence.node_id ?? evidence.nodeId ?? null;
}

function dependencyNodeId(dependency: WorkGraphDependencyView) {
  return dependency.node_id ?? dependency.nodeId ?? null;
}

function dependencyTargetId(dependency: WorkGraphDependencyView) {
  return dependency.depends_on_node_id ?? dependency.dependsOnNodeId ?? null;
}

export function groupEvidenceByNode(evidence: WorkNodeEvidenceView[] = []) {
  const map = new Map<string, WorkNodeEvidenceView[]>();
  for (const item of evidence) {
    const nodeId = evidenceNodeId(item);
    if (!nodeId) continue;
    const list = map.get(nodeId) ?? [];
    list.push(item);
    map.set(nodeId, list);
  }
  return map;
}

type TreeLayoutRow = { node: WorkNodeView; depth: number; lane: number };

const HORIZONTAL_DEPTH_SPACING = 380;
const HORIZONTAL_LANE_SPACING = 212;
const VERTICAL_DEPTH_INDENT = 56;
const VERTICAL_ROW_SPACING = 224;

function treeRows(nodes: WorkNodeView[]) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const childrenByParent = new Map<string | null, WorkNodeView[]>();

  for (const node of nodes) {
    const parentId = parentIdFor(node);
    const safeParentId = parentId && nodeIds.has(parentId) ? parentId : null;
    const list = childrenByParent.get(safeParentId) ?? [];
    list.push(node);
    childrenByParent.set(safeParentId, list);
  }

  const result: Array<{ node: WorkNodeView; depth: number }> = [];
  const visited = new Set<string>();

  const visit = (node: WorkNodeView, depth: number, activePath: Set<string>) => {
    if (visited.has(node.id) || activePath.has(node.id)) return;

    visited.add(node.id);
    result.push({ node, depth });

    const nextPath = new Set(activePath);
    nextPath.add(node.id);
    for (const child of childrenByParent.get(node.id) ?? []) {
      visit(child, depth + 1, nextPath);
    }
  };

  for (const root of childrenByParent.get(null) ?? []) {
    visit(root, 0, new Set());
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      visit(node, 0, new Set());
    }
  }

  return result;
}

function centeredTreeRows(nodes: WorkNodeView[]): TreeLayoutRow[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const childrenByParent = new Map<string | null, WorkNodeView[]>();

  for (const node of nodes) {
    const parentId = parentIdFor(node);
    const safeParentId = parentId && nodeIds.has(parentId) ? parentId : null;
    const list = childrenByParent.get(safeParentId) ?? [];
    list.push(node);
    childrenByParent.set(safeParentId, list);
  }

  const layoutByNode = new Map<string, TreeLayoutRow>();
  let nextLane = 0;

  const assign = (node: WorkNodeView, depth: number, activePath: Set<string>): number | null => {
    if (layoutByNode.has(node.id) || activePath.has(node.id)) return null;

    const nextPath = new Set(activePath);
    nextPath.add(node.id);

    const childLanes: number[] = [];
    for (const child of childrenByParent.get(node.id) ?? []) {
      const childLane = assign(child, depth + 1, nextPath);
      if (childLane !== null) childLanes.push(childLane);
    }

    const lane =
      childLanes.length > 0 ? (Math.min(...childLanes) + Math.max(...childLanes)) / 2 : nextLane++;

    layoutByNode.set(node.id, { node, depth, lane });
    return lane;
  };

  for (const root of childrenByParent.get(null) ?? []) {
    assign(root, 0, new Set());
  }

  for (const node of nodes) {
    assign(node, 0, new Set());
  }

  return nodes.flatMap((node) => {
    const row = layoutByNode.get(node.id);
    return row ? [row] : [];
  });
}

function promoteDependencyTargetColumns(
  rows: TreeLayoutRow[],
  dependencies: WorkGraphDependencyView[],
): TreeLayoutRow[] {
  const rankedRows = rows.map((row) => ({ ...row }));
  const rowById = new Map(rankedRows.map((row) => [row.node.id, row]));

  for (let pass = 0; pass < rankedRows.length; pass += 1) {
    let changed = false;

    for (const dependency of dependencies) {
      const source = dependencyTargetId(dependency);
      const target = dependencyNodeId(dependency);
      if (!source || !target || source === target) continue;

      const sourceRow = rowById.get(source);
      const targetRow = rowById.get(target);
      if (!sourceRow || !targetRow || targetRow.depth > sourceRow.depth) continue;

      targetRow.depth = sourceRow.depth + 1;
      changed = true;
    }

    for (const row of rankedRows) {
      const parentId = parentIdFor(row.node);
      const parentRow = parentId ? rowById.get(parentId) : null;
      if (parentRow && row.depth <= parentRow.depth) {
        row.depth = parentRow.depth + 1;
        changed = true;
      }
    }

    if (!changed) break;
  }

  return rankedRows;
}

function edgeColorFor(status: string) {
  if (status === 'completed') return 'var(--ui-success)';
  if (status === 'running') return 'var(--ui-status-running)';
  if (status === 'waiting' || status === 'waiting_for_user' || status === 'blocked') {
    return 'var(--ui-warning)';
  }
  if (status === 'failed') return 'var(--ui-danger)';
  return 'var(--ui-accent)';
}

export function nodeStatusColor(status: string) {
  if (status === 'completed') return 'green';
  if (status === 'running') return 'blue';
  if (status === 'ready') return 'indigo';
  if (status === 'waiting' || status === 'waiting_for_user') return 'yellow';
  if (status === 'blocked') return 'orange';
  if (status === 'failed') return 'red';
  return 'gray';
}

export function nodeStatusLabel(status: string) {
  if (status === 'waiting_for_user') return 'waiting for user';
  return status;
}

export function selectPreferredWorkGraphNode(nodes: WorkNodeView[], selectedNodeId: string | null) {
  return (
    nodes.find((node) => node.id === selectedNodeId) ??
    nodes.find((node) => !parentIdFor(node)) ??
    nodes[0] ??
    null
  );
}

function canonicalRootIdFor(nodes: WorkNodeView[]) {
  const rootNodes = nodes.filter((node) => !parentIdFor(node));
  return rootNodes.find((node) => node.type === 'root')?.id ?? rootNodes[0]?.id ?? null;
}

export function buildGraphElements(params: {
  nodes: WorkNodeView[];
  dependencies: WorkGraphDependencyView[];
  evidenceByNode: Map<string, WorkNodeEvidenceView[]>;
  rootNoteMarkdown?: string | null;
  layoutDirection?: WorkGraphLayoutDirection;
}) {
  const nodeIds = new Set(params.nodes.map((node) => node.id));
  const parentIdByNode = new Map(params.nodes.map((node) => [node.id, parentIdFor(node)]));
  const dependencyTargetsWithIncomingFlow = new Set(
    params.dependencies.flatMap((dependency) => {
      const source = dependencyTargetId(dependency);
      const target = dependencyNodeId(dependency);
      if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) return [];
      return parentIdByNode.get(target) === source ? [] : [target];
    }),
  );
  const canonicalRootId = canonicalRootIdFor(params.nodes);
  const layoutDirection = params.layoutDirection ?? 'horizontal';
  const rows: TreeLayoutRow[] =
    layoutDirection === 'vertical'
      ? treeRows(params.nodes).map((row, index) => ({ ...row, lane: index }))
      : centeredTreeRows(params.nodes);
  const rankedRows =
    layoutDirection === 'vertical'
      ? rows
      : promoteDependencyTargetColumns(rows, params.dependencies);
  const flowNodes: WorkGraphFlowNode[] = rankedRows.map(({ node, depth, lane }) => ({
    id: node.id,
    type: 'workGraphNode',
    position: {
      x:
        layoutDirection === 'vertical'
          ? depth * VERTICAL_DEPTH_INDENT
          : depth * HORIZONTAL_DEPTH_SPACING,
      y:
        layoutDirection === 'vertical'
          ? lane * VERTICAL_ROW_SPACING
          : lane * HORIZONTAL_LANE_SPACING,
    },
    data: {
      node,
      evidence: params.evidenceByNode.get(node.id) ?? [],
      rootNoteMarkdown: node.id === canonicalRootId ? params.rootNoteMarkdown : null,
      layoutDirection,
    },
    draggable: false,
    selectable: true,
  }));

  const parentEdges: Edge[] = params.nodes.flatMap((node) => {
    const parentId = parentIdFor(node);
    if (!parentId || !nodeIds.has(parentId)) return [];
    if (dependencyTargetsWithIncomingFlow.has(node.id)) return [];
    const edgeColor = edgeColorFor(node.status);
    return [
      {
        id: `parent:${parentId}:${node.id}`,
        source: parentId,
        target: node.id,
        type: 'default',
        animated: node.status === 'running',
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
        style: { stroke: edgeColor, strokeWidth: 2 },
      },
    ];
  });

  const dependencyEdges: Edge[] = params.dependencies.flatMap((dependency, index) => {
    const source = dependencyTargetId(dependency);
    const target = dependencyNodeId(dependency);
    if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) return [];
    if (parentIdByNode.get(target) === source) return [];
    return [
      {
        id: dependency.id ?? `dependency:${source}:${target}:${index}`,
        source,
        target,
        type: 'default',
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--ui-muted-text)' },
        style: {
          stroke: 'var(--ui-muted-text)',
          strokeWidth: 1.5,
          strokeDasharray: '5 5',
        },
      },
    ];
  });

  return { flowNodes, flowEdges: [...parentEdges, ...dependencyEdges] };
}
