'use client';

import { Badge, Group, Stack, Text } from '@mantine/core';

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

function nodeRuntimeTarget(node: WorkNodeView) {
  return node.runtime_target ?? node.runtimeTarget ?? null;
}

function nodeResultSummary(node: WorkNodeView) {
  return node.result_summary ?? node.resultSummary ?? null;
}

function nodeWaitingReason(node: WorkNodeView) {
  return node.waiting_reason ?? node.waitingReason ?? null;
}

export function WorkNodeDetailPanel({
  node,
  evidence = [],
}: {
  node: WorkNodeView;
  evidence?: WorkNodeEvidenceView[];
}) {
  const runtimeTarget = nodeRuntimeTarget(node);
  const resultSummary = nodeResultSummary(node);
  const waitingReason = nodeWaitingReason(node);

  return (
    <Stack gap="xs" data-panel="work-node-detail">
      <Group gap="xs" wrap="wrap">
        <Text fw={700} size="sm">
          {node.title}
        </Text>
        <Badge size="sm" variant="light">
          {node.status}
        </Badge>
        <Badge size="sm" variant="outline">
          {node.type}
        </Badge>
      </Group>

      <Group gap="xs" wrap="wrap">
        {node.engine ? <Badge variant="dot">{node.engine}</Badge> : null}
        {runtimeTarget ? <Badge variant="dot">{runtimeTarget}</Badge> : null}
      </Group>

      {node.body ? (
        <Text size="sm" c="dimmed">
          {node.body}
        </Text>
      ) : null}

      {waitingReason ? (
        <Text size="sm" c="orange">
          {waitingReason}
        </Text>
      ) : null}

      {resultSummary ? <Text size="sm">{resultSummary}</Text> : null}

      {evidence.length > 0 ? (
        <Stack gap={4}>
          <Text size="xs" fw={700} c="dimmed">
            Evidence
          </Text>
          {evidence.map((item) => (
            <Stack key={item.id} gap={2}>
              <Group gap="xs">
                <Badge size="xs" variant="light">
                  {item.kind}
                </Badge>
                <Text size="sm" fw={600}>
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
    </Stack>
  );
}
