'use client';

import { useEventPolling } from '@/app/hooks/use-event-polling';

interface EventPollerProps {
  projectId?: string;
  intervalMs?: number;
}

export function EventPoller({ projectId, intervalMs }: EventPollerProps) {
  useEventPolling({ projectId, intervalMs });
  return null;
}
