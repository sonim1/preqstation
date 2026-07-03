'use client';

import { Badge, Group, Stack, Text } from '@mantine/core';

import { MarkdownViewer } from '@/app/components/markdown-viewer';
import {
  nodeStatusColor,
  nodeStatusLabel,
  parentIdFor,
  resultSummaryFor,
  runtimeTargetFor,
  waitingReasonFor,
  workflowProfileFor,
  type WorkNodeEvidenceView,
  type WorkNodeView,
} from '@/app/components/work-graph-model';

import classes from './work-graph-tree.module.css';

export function WorkGraphNodeInspector({
  node,
  evidence,
  rootNoteMarkdown,
}: {
  node: WorkNodeView;
  evidence: WorkNodeEvidenceView[];
  rootNoteMarkdown?: string | null;
}) {
  const runtimeTarget = runtimeTargetFor(node);
  const resultSummary = resultSummaryFor(node);
  const waitingReason = waitingReasonFor(node);
  const workflowProfile = workflowProfileFor(node);
  const isRoot = !parentIdFor(node);
  const rootNote = rootNoteMarkdown?.trim() ?? '';
  const hasRootNoteSlot = isRoot && rootNoteMarkdown !== undefined && rootNoteMarkdown !== null;
  const hasDetail =
    Boolean(node.body) ||
    Boolean(waitingReason) ||
    Boolean(resultSummary) ||
    Boolean(workflowProfile) ||
    evidence.length > 0 ||
    hasRootNoteSlot;

  return (
    <aside
      className={classes.inspectorPanel}
      data-testid="work-graph-inspector"
      aria-label="Selected work node details"
    >
      <Stack gap="sm">
        <Stack gap={4}>
          <Text size="xs" fw={800} c="dimmed" tt="uppercase">
            Selected node
          </Text>
          <Text component="h3" fw={800} size="md" className={classes.inspectorTitle}>
            {node.title}
          </Text>
          <Group gap={5} wrap="wrap">
            <Badge size="xs" color={nodeStatusColor(node.status)} variant="light">
              {nodeStatusLabel(node.status)}
            </Badge>
            <Badge size="xs" variant="outline">
              {node.type}
            </Badge>
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
        </Stack>

        {hasRootNoteSlot ? (
          <Stack gap={5} className={classes.inspectorBlock}>
            <Text size="xs" fw={800} c="dimmed" tt="uppercase">
              Notes
            </Text>
            {rootNote ? (
              <MarkdownViewer
                markdown={rootNote}
                className={classes.inspectorMarkdown}
                mode="body"
              />
            ) : (
              <Text size="sm" c="dimmed">
                No notes yet.
              </Text>
            )}
          </Stack>
        ) : null}

        {node.body ? (
          <Stack gap={5} className={classes.inspectorBlock}>
            <Text size="xs" fw={800} c="dimmed" tt="uppercase">
              Brief
            </Text>
            <Text size="sm">{node.body}</Text>
          </Stack>
        ) : null}

        {waitingReason ? (
          <Stack gap={5} className={classes.inspectorBlock}>
            <Text size="xs" fw={800} c="dimmed" tt="uppercase">
              Waiting on
            </Text>
            <Text size="sm" c="orange">
              {waitingReason}
            </Text>
          </Stack>
        ) : null}

        {resultSummary ? (
          <Stack gap={5} className={classes.inspectorBlock}>
            <Text size="xs" fw={800} c="dimmed" tt="uppercase">
              Result
            </Text>
            <Text size="sm">{resultSummary}</Text>
          </Stack>
        ) : null}

        {workflowProfile ? (
          <Stack gap={5} className={classes.inspectorBlock}>
            <Text size="xs" fw={800} c="dimmed" tt="uppercase">
              Workflow
            </Text>
            <Group gap={5} wrap="wrap">
              {workflowProfile.requested ? (
                <Badge size="xs" variant="light">
                  {workflowProfile.requested}
                </Badge>
              ) : null}
              {workflowProfile.resolved ? (
                <Badge size="xs" variant="outline">
                  {workflowProfile.resolved}
                </Badge>
              ) : null}
              {workflowProfile.manualCommand ? (
                <Badge size="xs" variant="dot">
                  {workflowProfile.manualCommand}
                </Badge>
              ) : null}
            </Group>
            {workflowProfile.resolvedCommand ? (
              <Text size="sm">{workflowProfile.resolvedCommand}</Text>
            ) : null}
            {workflowProfile.resolvedReason ? (
              <Text size="xs" c="dimmed">
                {workflowProfile.resolvedReason}
              </Text>
            ) : null}
          </Stack>
        ) : null}

        {evidence.length > 0 ? (
          <Stack gap={6} className={classes.inspectorBlock}>
            <Text size="xs" fw={800} c="dimmed" tt="uppercase">
              Evidence
            </Text>
            {evidence.map((item) => (
              <Stack key={item.id} gap={3} className={classes.evidenceItem}>
                <Group gap={6} wrap="nowrap">
                  <Badge size="xs" variant="light">
                    {item.kind}
                  </Badge>
                  <Text size="sm" fw={700} lineClamp={1}>
                    {item.title}
                  </Text>
                </Group>
                {item.summary ? (
                  <Text size="xs" c="dimmed">
                    {item.summary}
                  </Text>
                ) : null}
              </Stack>
            ))}
          </Stack>
        ) : null}

        {!hasDetail ? (
          <Text size="sm" c="dimmed" className={classes.emptyDetail}>
            No details recorded for this node yet.
          </Text>
        ) : null}
      </Stack>
    </aside>
  );
}
