'use client';

import { Badge } from '@mantine/core';

export type WorkGraphSummary = {
  running_count?: number;
  ready_count?: number;
  waiting_count?: number;
  blocked_count?: number;
  failed_count?: number;
  completed_count?: number;
  root_overlay?: 'running' | 'ready' | 'waiting_for_user' | 'blocked' | 'failed' | null;
};

const OVERLAY_LABELS = {
  running: 'Running',
  ready: 'Ready',
  waiting_for_user: 'Waiting',
  blocked: 'Blocked',
  failed: 'Failed',
} as const;

const OVERLAY_COLORS = {
  running: 'blue',
  ready: 'indigo',
  waiting_for_user: 'yellow',
  blocked: 'orange',
  failed: 'red',
} as const;

export function WorkGraphSummaryBadge({ summary }: { summary?: WorkGraphSummary | null }) {
  const overlay = summary?.root_overlay ?? null;
  if (!overlay) return <Badge variant="light">No graph</Badge>;

  return (
    <Badge color={OVERLAY_COLORS[overlay]} variant="light">
      {OVERLAY_LABELS[overlay]}
    </Badge>
  );
}
