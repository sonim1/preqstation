'use client';

import { Badge, Group, Stack, Text } from '@mantine/core';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { type KeyboardEvent } from 'react';

import {
  nodeStatusColor,
  nodeStatusLabel,
  parentIdFor,
  resultSummaryFor,
  runtimeTargetFor,
  waitingReasonFor,
  type WorkGraphFlowNode,
} from '@/app/components/work-graph-model';

import classes from './work-graph-tree.module.css';

function plainTextPreview(markdown: string) {
  return markdown
    .replace(/[`*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function WorkGraphNode({ data, selected }: NodeProps<WorkGraphFlowNode>) {
  const { node, evidence, rootNoteMarkdown, isSelected, onSelect } = data;
  const runtimeTarget = runtimeTargetFor(node);
  const resultSummary = resultSummaryFor(node);
  const waitingReason = waitingReasonFor(node);
  const isRoot = !parentIdFor(node);
  const hasRootNoteSlot = rootNoteMarkdown !== undefined && rootNoteMarkdown !== null;
  const rootNote = rootNoteMarkdown?.trim() ?? '';
  const rootNotePreview = rootNote ? plainTextPreview(rootNote) : 'No notes yet';
  const selectedState = Boolean(selected || isSelected);
  const targetPosition = data.layoutDirection === 'vertical' ? Position.Top : Position.Left;
  const sourcePosition = data.layoutDirection === 'vertical' ? Position.Bottom : Position.Right;

  const selectNode = () => {
    onSelect?.(node.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    selectNode();
  };

  return (
    <div
      className={classes.nodeCard}
      data-status={node.status}
      data-root={isRoot ? 'true' : 'false'}
      data-selected={selectedState ? 'true' : 'false'}
      data-root-note={hasRootNoteSlot ? 'true' : 'false'}
      data-testid={`work-graph-node-${node.id}`}
      role="button"
      tabIndex={0}
      aria-label={`Inspect ${node.title}`}
      aria-pressed={selectedState}
      onClick={selectNode}
      onKeyDown={handleKeyDown}
    >
      <Handle type="target" position={targetPosition} className={classes.handle} />
      <Handle type="source" position={sourcePosition} className={classes.handle} />

      <Group gap="sm" align="flex-start" wrap="nowrap">
        <span className={classes.nodeStatusDot} aria-hidden="true" />
        <Stack gap={5} className={classes.nodeTitleStack}>
          <Text fw={800} size="sm" className={classes.nodeTitle}>
            {node.title}
          </Text>
          <Group gap={4} wrap="wrap">
            <Badge size="xs" color={nodeStatusColor(node.status)} variant="light">
              {nodeStatusLabel(node.status)}
            </Badge>
            <Badge size="xs" variant="outline">
              {node.type}
            </Badge>
          </Group>
        </Stack>
      </Group>

      {node.body ? (
        <Text size="xs" c="dimmed" lineClamp={2} className={classes.nodePreview}>
          {node.body}
        </Text>
      ) : null}

      {hasRootNoteSlot ? (
        <Stack gap={3} className={classes.nodeNoteBlock}>
          <Text size="xs" fw={800} c="dimmed" tt="uppercase">
            Notes
          </Text>
          <Text size="xs" c={rootNote ? undefined : 'dimmed'} lineClamp={2}>
            {rootNotePreview}
          </Text>
        </Stack>
      ) : null}

      <Group gap={5} className={classes.nodeMetaLine} wrap="wrap">
        {waitingReason ? (
          <Badge size="xs" color="orange" variant="light">
            Waiting
          </Badge>
        ) : null}
        {resultSummary ? (
          <Badge size="xs" variant="light">
            Result
          </Badge>
        ) : null}
        {evidence.length > 0 ? (
          <Badge size="xs" variant="light">
            Evidence {evidence.length}
          </Badge>
        ) : null}
        {node.engine ? (
          <Badge size="xs" variant="dot">
            {node.engine}
          </Badge>
        ) : null}
        {runtimeTarget ? (
          <Badge size="xs" variant="dot">
            {runtimeTarget}
          </Badge>
        ) : null}
      </Group>
    </div>
  );
}

export const workGraphNodeTypes = { workGraphNode: WorkGraphNode };
