'use client';

import { createContext, type ReactNode, useContext, useState } from 'react';
import { useStore } from 'zustand';

import type { KanbanColumns, KanbanStatus } from '@/lib/kanban-helpers';
import {
  createKanbanStore,
  type EditableBoardTask,
  selectKanbanColumns,
  selectKanbanRunStatePollingStatus,
  selectKanbanTask,
  selectKanbanTaskKeysByStatus,
} from '@/lib/kanban-store';

type KanbanStoreApi = ReturnType<typeof createKanbanStore>;

const KanbanStoreContext = createContext<KanbanStoreApi | null>(null);

type KanbanStoreProviderProps = {
  initialColumns: KanbanColumns;
  initialFocusedTask: EditableBoardTask | null;
  children: ReactNode;
};

export function KanbanStoreProvider({
  initialColumns,
  initialFocusedTask,
  children,
}: KanbanStoreProviderProps) {
  const [store] = useState(() =>
    createKanbanStore({
      columns: initialColumns,
      focusedTask: initialFocusedTask,
    }),
  );

  return (
    <KanbanStoreContext.Provider value={store}>
      <div data-testid="kanban-store-provider" style={{ display: 'contents' }}>
        {children}
      </div>
    </KanbanStoreContext.Provider>
  );
}

export function useKanbanStoreApi() {
  const store = useContext(KanbanStoreContext);
  if (!store) {
    throw new Error('KanbanStoreProvider is missing from the component tree.');
  }

  return store;
}

export function useKanbanStore<T>(selector: (state: ReturnType<KanbanStoreApi['getState']>) => T) {
  const store = useKanbanStoreApi();
  return useStore(store, selector);
}

export function useKanbanColumns() {
  return useKanbanStore(selectKanbanColumns);
}

export function useKanbanTask(taskKey: string | null | undefined) {
  return useKanbanStore((state) => selectKanbanTask(state, taskKey));
}

export function useKanbanTaskKeysByStatus(status: KanbanStatus) {
  return useKanbanStore((state) => selectKanbanTaskKeysByStatus(state, status));
}

export function useFocusedTask() {
  return useKanbanStore((state) => state.focusedTask);
}

export function useKanbanFocusedTaskKey() {
  return useKanbanStore((state) => state.focusedTaskKey);
}

export function useFocusedTaskDetailStatus() {
  return useKanbanStore((state) => state.focusedTaskDetailStatus);
}

export function useKanbanReconciliationPaused() {
  return useKanbanStore((state) => state.isReconciliationPaused);
}

export function useKanbanRunStatePollingStatus() {
  return useKanbanStore(selectKanbanRunStatePollingStatus);
}

export function useHydrateKanbanStore() {
  return useKanbanStore((state) => state.hydrate);
}

export function useApplyKanbanMove() {
  return useKanbanStore((state) => state.applyMove);
}

export function useSetKanbanReconciliationPaused() {
  return useKanbanStore((state) => state.setReconciliationPaused);
}

export function useUpsertKanbanSnapshots() {
  return useKanbanStore((state) => state.upsertSnapshots);
}

export function useSetFocusedTask() {
  return useKanbanStore((state) => state.setFocusedTask);
}

export function useOpenFocusedTaskFromBoardTask() {
  return useKanbanStore((state) => state.openFocusedTaskFromBoardTask);
}

export function useRemoveKanbanTask() {
  return useKanbanStore((state) => state.removeTask);
}

export function useSetTaskUnreadNotification() {
  return useKanbanStore((state) => state.setTaskUnreadNotification);
}

export function useApplyOptimisticKanbanRunState() {
  return useKanbanStore((state) => state.applyOptimisticRunState);
}
