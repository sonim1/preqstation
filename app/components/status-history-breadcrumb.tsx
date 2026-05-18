'use client';

import { Badge, Group, Text } from '@mantine/core';
import type { CSSProperties } from 'react';

import { isTaskStatus } from '@/lib/task-meta';
import { parseTaskStatusLabel } from '@/lib/terminology';

import { useTerminology } from './terminology-provider';

type WorkLogEntry = {
  id: string;
  title: string;
  detail?: string | null;
  workedAt: Date;
  createdAt: Date;
};

type StatusHistoryBreadcrumbProps = {
  workLogs: WorkLogEntry[];
  currentStatus: string;
};

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

function isStatusChangeLog(title: string): boolean {
  return title.includes('→') || title.includes('->');
}

type StatusStep = {
  status: string;
  label: string;
  time: string | null;
};

const mutedTextStyle: CSSProperties = { color: 'var(--ui-muted-text)' };

function getStatusBadgeStyle(status: string): CSSProperties {
  if (status === 'hold' || status === 'ready') {
    return {
      backgroundColor: 'var(--ui-warning-soft)',
      borderColor: 'var(--ui-status-history-warning-border)',
      color: 'var(--ui-warning)',
    };
  }

  if (status === 'done') {
    return {
      backgroundColor: 'var(--ui-success-soft)',
      borderColor: 'var(--ui-status-history-success-border)',
      color: 'var(--ui-success)',
    };
  }

  if (status === 'archived') {
    return {
      backgroundColor: 'var(--ui-neutral-soft)',
      borderColor: 'var(--ui-border)',
      color: 'var(--ui-muted-text)',
    };
  }

  return {
    backgroundColor: 'var(--ui-accent-soft)',
    borderColor: 'color-mix(in srgb, var(--ui-accent), var(--ui-border) 42%)',
    color: 'var(--ui-accent)',
  };
}

function parseStatusFromLabel(labelText: string): string {
  return parseTaskStatusLabel(labelText);
}

function displayStatusLabel(
  status: string,
  fallbackLabel: string,
  terminology: ReturnType<typeof useTerminology>,
) {
  if (!isTaskStatus(status)) return fallbackLabel;
  if (status === 'todo') {
    return terminology.boardStatuses.todo;
  }
  return terminology.statuses[status];
}

export function StatusHistoryBreadcrumb({ workLogs, currentStatus }: StatusHistoryBreadcrumbProps) {
  const terminology = useTerminology();
  // Filter and sort status-change logs (oldest first)
  const statusLogs = workLogs
    .filter((log) => isStatusChangeLog(log.title))
    .sort((a, b) => a.workedAt.getTime() - b.workedAt.getTime());

  if (statusLogs.length === 0) {
    // No history — just show current status badge
    return (
      <Badge variant="light" size="sm" style={getStatusBadgeStyle(currentStatus)}>
        {displayStatusLabel(currentStatus, currentStatus, terminology)}
      </Badge>
    );
  }

  // Build breadcrumb steps from logs
  const steps: StatusStep[] = [];

  for (const log of statusLogs) {
    // Title format: "TASK-1 · Inbox -> Todo" or "TASK-1 · Inbox → Todo"
    // Extract the "From -> To" part after the " · "
    const sep = log.title.indexOf(' · ');
    const changePart = sep >= 0 ? log.title.slice(sep + 3) : log.title;

    // Split on → or ->
    const parts = changePart.split(/→|->/).map((s) => s.trim());
    if (parts.length < 2) continue;

    const fromLabel = parts[0];
    const toLabel = parts[1];

    if (steps.length === 0) {
      // Push the initial "from" state with no time
      steps.push({
        status: parseStatusFromLabel(fromLabel),
        label: fromLabel,
        time: null,
      });
    }

    // Push the "to" state with the log's relative time
    steps.push({
      status: parseStatusFromLabel(toLabel),
      label: toLabel,
      time: relativeTime(log.workedAt),
    });
  }

  if (steps.length === 0) {
    return (
      <Badge variant="light" size="sm" style={getStatusBadgeStyle(currentStatus)}>
        {displayStatusLabel(currentStatus, currentStatus, terminology)}
      </Badge>
    );
  }

  return (
    <Group gap={4} wrap="wrap" align="center">
      {steps.map((step, idx) => (
        <Group key={idx} gap={4} align="center" wrap="nowrap">
          <Group gap={2} align="center" wrap="nowrap">
            <Badge variant="light" size="sm" style={getStatusBadgeStyle(step.status)}>
              {displayStatusLabel(step.status, step.label, terminology)}
            </Badge>
            {step.time && (
              <Text size="xs" style={mutedTextStyle}>
                ({step.time})
              </Text>
            )}
          </Group>
          {idx < steps.length - 1 && (
            <Text size="xs" style={mutedTextStyle}>
              →
            </Text>
          )}
        </Group>
      ))}
    </Group>
  );
}
