'use client';

import { Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { useState, useTransition } from 'react';

import { WorkLogTimeline, type WorkLogTimelineItem } from '@/app/components/work-log-timeline';
import { PROJECT_WORK_LOG_PAGE_SIZE } from '@/lib/work-log-pagination';

import { InfiniteScrollTrigger } from './infinite-scroll-trigger';

type ProjectWorkLogTimelineProps = {
  projectId: string;
  initialLogs: WorkLogTimelineItem[];
  initialNextOffset: number | null;
  emptyText: string;
  emptyState?: ReactNode;
};

type WorkLogTimelineResponseItem = Omit<WorkLogTimelineItem, 'workedAt'> & {
  workedAt: Date | string;
};

function normalizeWorkLog(log: WorkLogTimelineResponseItem): WorkLogTimelineItem {
  return {
    ...log,
    workedAt: log.workedAt instanceof Date ? log.workedAt : new Date(log.workedAt),
  };
}

export function ProjectWorkLogTimeline({
  projectId,
  initialLogs,
  initialNextOffset,
  emptyText,
  emptyState,
}: ProjectWorkLogTimelineProps) {
  const [logs, setLogs] = useState(() => initialLogs.map(normalizeWorkLog));
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadMore() {
    if (nextOffset === null) return;

    startTransition(async () => {
      setError(null);

      try {
        const search = new URLSearchParams({
          projectId,
          offset: String(nextOffset),
          limit: String(PROJECT_WORK_LOG_PAGE_SIZE),
        });
        const response = await fetch(`/api/work-logs?${search.toString()}`);
        const body = (await response.json().catch(() => null)) as {
          workLogs?: WorkLogTimelineResponseItem[];
          nextOffset?: number | null;
          error?: string;
        } | null;
        const nextLogs = body?.workLogs;

        if (!response.ok || !Array.isArray(nextLogs)) {
          throw new Error(body?.error || 'Failed to load more work logs.');
        }

        setLogs((currentLogs) => [...currentLogs, ...nextLogs.map(normalizeWorkLog)]);
        const nextPageOffset = body?.nextOffset;
        setNextOffset(typeof nextPageOffset === 'number' ? nextPageOffset : null);
      } catch (fetchError) {
        setError(
          fetchError instanceof Error ? fetchError.message : 'Failed to load more work logs.',
        );
      }
    });
  }

  return (
    <Stack gap="sm">
      <WorkLogTimeline
        logs={logs}
        emptyText={emptyText}
        emptyState={emptyState}
        variant="activity"
      />
      {error ? (
        <Text c="red" size="sm">
          {error}
        </Text>
      ) : null}
      <InfiniteScrollTrigger
        active={true}
        hasMore={nextOffset !== null}
        loading={isPending}
        disabled={isPending}
        resetKey={String(nextOffset ?? 'done')}
        onLoadMore={loadMore}
        showManualFallback={error !== null}
      />
    </Stack>
  );
}
