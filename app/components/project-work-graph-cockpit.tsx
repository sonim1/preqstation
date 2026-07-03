import { Badge, Group, Stack, Text } from '@mantine/core';

import type {
  ProjectKnowledgeProposalSummary,
  ProjectWorkGraphNodeSummary,
  ProjectWorkGraphSummary,
} from '@/lib/project-work-graph-summary';

type ProjectWorkGraphCockpitProps = {
  summary: ProjectWorkGraphSummary;
};

function taskLabel(item: { taskKey: string | null; taskTitle: string | null }) {
  return [item.taskKey, item.taskTitle].filter(Boolean).join(' · ');
}

function NodeList({ empty, items }: { empty: string; items: ProjectWorkGraphNodeSummary[] }) {
  if (items.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {empty}
      </Text>
    );
  }

  return (
    <Stack gap={6}>
      {items.map((item) => (
        <div key={item.id} data-project-work-graph-row="node">
          <Group gap="xs" wrap="nowrap">
            <Badge size="xs" variant="light">
              {item.status ?? 'unknown'}
            </Badge>
            <Text size="sm" fw={700}>
              {item.title ?? 'Untitled node'}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            {taskLabel(item)}
          </Text>
          {item.summary ? <Text size="sm">{item.summary}</Text> : null}
        </div>
      ))}
    </Stack>
  );
}

function ProposalList({ items }: { items: ProjectKnowledgeProposalSummary[] }) {
  if (items.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No pending proposals
      </Text>
    );
  }

  return (
    <Stack gap={6}>
      {items.map((item) => (
        <div key={item.id} data-project-work-graph-row="proposal">
          <Group gap="xs" wrap="nowrap">
            <Badge size="xs" variant="light" color="violet">
              Proposal
            </Badge>
            <Text size="sm" fw={700}>
              {item.target ?? 'Untitled target'}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            {taskLabel(item)}
          </Text>
          {item.body ? <Text size="sm">{item.body}</Text> : null}
        </div>
      ))}
    </Stack>
  );
}

export function ProjectWorkGraphCockpit({ summary }: ProjectWorkGraphCockpitProps) {
  const metrics = [
    { label: 'Active roots', value: summary.counts.activeRoots },
    { label: 'Waiting decisions', value: summary.counts.waitingDecisions },
    { label: 'Failed nodes', value: summary.counts.failedNodes },
    { label: 'Blocked nodes', value: summary.counts.blockedNodes },
    { label: 'Pending proposals', value: summary.counts.pendingProposals },
  ];

  return (
    <Stack gap="md" data-project-work-graph-cockpit="true">
      <Group gap="xs" wrap="wrap">
        {metrics.map((metric) => (
          <Badge key={metric.label} variant="light" color={metric.value > 0 ? 'blue' : 'gray'}>
            {metric.label}: {metric.value}
          </Badge>
        ))}
      </Group>

      <div>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Waiting decisions
        </Text>
        <NodeList empty="No waiting decisions" items={summary.waitingDecisions} />
      </div>

      <div>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Failed nodes
        </Text>
        <NodeList empty="No failed nodes" items={summary.failedNodes} />
      </div>

      <div>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Blocked nodes
        </Text>
        <NodeList empty="No blocked nodes" items={summary.blockedNodes} />
      </div>

      <div>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Recent results
        </Text>
        <NodeList empty="No recent graph results" items={summary.recentResults} />
      </div>

      <div>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Pending proposals
        </Text>
        <ProposalList items={summary.pendingProposals} />
      </div>
    </Stack>
  );
}
