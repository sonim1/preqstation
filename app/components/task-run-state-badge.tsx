'use client';

import { Badge, Tooltip } from '@mantine/core';

import { formatDateTimeForDisplay } from '@/lib/date-time';
import { TASK_RUN_STATE_LABELS, type TaskRunState } from '@/lib/task-meta';

import { useTimeZone } from './timezone-provider';

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
  const color = runState === 'queued' ? 'indigo' : 'teal';
  const badge = (
    <Badge size="xs" variant="light" color={color}>
      {label}
    </Badge>
  );

  if (!runStateUpdatedAt) return badge;
  return <Tooltip label={formatDateTimeForDisplay(runStateUpdatedAt, timeZone)}>{badge}</Tooltip>;
}
