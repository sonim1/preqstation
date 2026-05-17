'use client';

import { Badge, Tooltip } from '@mantine/core';
import type { CSSProperties } from 'react';

import { formatDateTimeForDisplay } from '@/lib/date-time';
import { TASK_RUN_STATE_LABELS, type TaskRunState } from '@/lib/task-meta';

import { useTimeZone } from './timezone-provider';

function resolveRunStateBadgeStyle(runState: TaskRunState) {
  const colorToken = runState === 'queued' ? '--ui-status-queued' : '--ui-status-running';
  const borderToken =
    runState === 'queued' ? '--ui-status-queued-border' : '--ui-status-running-border';

  return {
    '--badge-bg': `color-mix(in srgb, var(${colorToken}) 12%, transparent)`,
    '--badge-color': `var(${colorToken})`,
    '--badge-bd': `1px solid var(${borderToken})`,
  } as CSSProperties;
}

export function TaskRunStateBadge({
  runState,
  runStateUpdatedAt,
}: {
  runState: TaskRunState | null;
  runStateUpdatedAt?: string | null;
}) {
  const timeZone = useTimeZone();
  if (!runState) return null;

  const label = TASK_RUN_STATE_LABELS[runState];
  const badge = (
    <Badge
      size="xs"
      variant="light"
      data-run-state-badge={runState}
      style={resolveRunStateBadgeStyle(runState)}
    >
      {label}
    </Badge>
  );

  if (!runStateUpdatedAt) return badge;
  return <Tooltip label={formatDateTimeForDisplay(runStateUpdatedAt, timeZone)}>{badge}</Tooltip>;
}
