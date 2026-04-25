// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const flushOfflineMutationsMock = vi.hoisted(() => vi.fn());
const useOfflineStatusMock = vi.hoisted(() => vi.fn());
const useFocusedTaskMock = vi.hoisted(() => vi.fn());
const getKanbanStateMock = vi.hoisted(() => vi.fn());
const removeTaskMock = vi.hoisted(() => vi.fn());
const setFocusedTaskMock = vi.hoisted(() => vi.fn());
const upsertSnapshotsMock = vi.hoisted(() => vi.fn());
const showErrorNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/components/offline-status-provider', () => ({
  useOfflineStatus: () => useOfflineStatusMock(),
}));

vi.mock('@/app/components/kanban-store-provider', () => ({
  useFocusedTask: () => useFocusedTaskMock(),
  useKanbanStoreApi: () => ({ getState: getKanbanStateMock }),
  useRemoveKanbanTask: () => removeTaskMock,
  useSetFocusedTask: () => setFocusedTaskMock,
  useUpsertKanbanSnapshots: () => upsertSnapshotsMock,
}));

vi.mock('@/lib/offline/mutation-sync', () => ({
  flushOfflineMutations: flushOfflineMutationsMock,
}));

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: showErrorNotificationMock,
}));

import { BoardOfflineSyncProvider } from '@/app/components/board-offline-sync-provider';

function buildBoardTask(projectId: string, projectKey: string, taskKey = `${projectKey}-1`) {
  return {
    id: `task:${taskKey}`,
    taskKey,
    branch: null,
    title: `Task ${taskKey}`,
    note: null,
    status: 'todo' as const,
    sortOrder: 'a0',
    taskPriority: 'none',
    dueAt: null,
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    project: {
      id: projectId,
      name: `Project ${projectKey}`,
      projectKey,
    },
    updatedAt: '2026-04-25T12:00:00.000Z',
    archivedAt: null,
    labels: [],
  };
}

describe('app/components/board-offline-sync-provider', () => {
  beforeEach(() => {
    flushOfflineMutationsMock.mockReset();
    useOfflineStatusMock.mockReset();
    useFocusedTaskMock.mockReset();
    getKanbanStateMock.mockReset();
    removeTaskMock.mockReset();
    setFocusedTaskMock.mockReset();
    upsertSnapshotsMock.mockReset();
    showErrorNotificationMock.mockReset();

    useOfflineStatusMock.mockReturnValue({ online: true });
    useFocusedTaskMock.mockReturnValue(null);
    getKanbanStateMock.mockReturnValue({ focusedTask: null });
    flushOfflineMutationsMock.mockResolvedValue({
      appliedCount: 0,
      error: null,
      halted: false,
    });
  });

  it('skips replayed mutations that belong to a different project board', async () => {
    flushOfflineMutationsMock.mockImplementationOnce(async ({ onApplied }) => {
      await onApplied?.({
        kind: 'patch',
        taskKey: 'OPS-1',
        boardTask: buildBoardTask('project-2', 'OPS'),
        focusedTask: null,
      });

      return { appliedCount: 1, error: null, halted: false };
    });

    render(
      <BoardOfflineSyncProvider editHrefBase="/board/PROJ" activeProjectId="project-1">
        <div>board</div>
      </BoardOfflineSyncProvider>,
    );

    await waitFor(() => {
      expect(flushOfflineMutationsMock).toHaveBeenCalledTimes(1);
    });

    expect(upsertSnapshotsMock).not.toHaveBeenCalled();
    expect(removeTaskMock).not.toHaveBeenCalled();
    expect(setFocusedTaskMock).not.toHaveBeenCalled();
  });

  it('still applies replayed mutations on the unscoped all-project board', async () => {
    flushOfflineMutationsMock.mockImplementationOnce(async ({ onApplied }) => {
      await onApplied?.({
        kind: 'patch',
        taskKey: 'OPS-1',
        boardTask: buildBoardTask('project-2', 'OPS'),
        focusedTask: null,
      });

      return { appliedCount: 1, error: null, halted: false };
    });

    render(
      <BoardOfflineSyncProvider editHrefBase="/board" activeProjectId={null}>
        <div>board</div>
      </BoardOfflineSyncProvider>,
    );

    await waitFor(() => {
      expect(upsertSnapshotsMock).toHaveBeenCalledWith([
        expect.objectContaining({
          taskKey: 'OPS-1',
          project: expect.objectContaining({ id: 'project-2', projectKey: 'OPS' }),
        }),
      ]);
    });
  });
});
