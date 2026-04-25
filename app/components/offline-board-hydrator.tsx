'use client';

import { useEffect } from 'react';

import {
  useFocusedTask,
  useHydrateKanbanStore,
  useKanbanColumns,
} from '@/app/components/kanban-store-provider';
import type { KanbanHydrationSnapshot } from '@/lib/kanban-store';
import { getSnapshot, putSnapshot } from '@/lib/offline/snapshot-store';

type OfflineBoardHydratorProps = {
  boardKey: string;
};

export function OfflineBoardHydrator({ boardKey }: OfflineBoardHydratorProps) {
  const columns = useKanbanColumns();
  const focusedTask = useFocusedTask();
  const hydrate = useHydrateKanbanStore();

  useEffect(() => {
    void putSnapshot({
      id: `board:${boardKey}`,
      kind: 'board',
      entityKey: boardKey,
      payload: {
        columns,
        focusedTask,
      },
      updatedAt: new Date().toISOString(),
    });
  }, [boardKey, columns, focusedTask]);

  useEffect(() => {
    if (navigator.onLine) {
      return;
    }

    void getSnapshot<KanbanHydrationSnapshot>(`board:${boardKey}`).then((snapshot) => {
      if (!snapshot?.payload) {
        return;
      }

      hydrate(snapshot.payload);
    });
  }, [boardKey, hydrate]);

  return null;
}
