'use client';

import { useEffect } from 'react';

import { useHydrateKanbanStore } from '@/app/components/kanban-store-provider';
import type { KanbanColumns } from '@/lib/kanban-helpers';
import type { EditableBoardTask, KanbanHydrationSnapshot } from '@/lib/kanban-store';
import { getSnapshot, putSnapshot } from '@/lib/offline/snapshot-store';

type OfflineBoardHydratorProps = {
  projectKey: string;
  initialColumns: KanbanColumns;
  initialFocusedTask: EditableBoardTask | null;
};

export function OfflineBoardHydrator({
  projectKey,
  initialColumns,
  initialFocusedTask,
}: OfflineBoardHydratorProps) {
  const hydrate = useHydrateKanbanStore();

  useEffect(() => {
    void putSnapshot({
      id: `board:${projectKey}`,
      kind: 'board',
      entityKey: projectKey,
      payload: {
        columns: initialColumns,
        focusedTask: initialFocusedTask,
      },
      updatedAt: new Date().toISOString(),
    });
  }, [initialColumns, initialFocusedTask, projectKey]);

  useEffect(() => {
    if (navigator.onLine) {
      return;
    }

    void getSnapshot<KanbanHydrationSnapshot>(`board:${projectKey}`).then((snapshot) => {
      if (!snapshot?.payload) {
        return;
      }

      hydrate(snapshot.payload);
    });
  }, [hydrate, projectKey]);

  return null;
}
