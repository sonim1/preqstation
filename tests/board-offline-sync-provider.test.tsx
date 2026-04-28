// @vitest-environment jsdom

import 'fake-indexeddb/auto';

import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const flushOfflineMutationsMock = vi.hoisted(() => vi.fn());
const useOfflineStatusMock = vi.hoisted(() => vi.fn());
const useFocusedTaskMock = vi.hoisted(() => vi.fn());
const getKanbanStateMock = vi.hoisted(() => vi.fn());
const removeTaskMock = vi.hoisted(() => vi.fn());
const setFocusedTaskMock = vi.hoisted(() => vi.fn());
const upsertSnapshotsMock = vi.hoisted(() => vi.fn());
const showErrorNotificationMock = vi.hoisted(() => vi.fn());
const deleteDraftMock = vi.hoisted(() => vi.fn());
const queueOfflineCreateMutationMock = vi.hoisted(() => vi.fn());
const queueOfflinePatchMutationMock = vi.hoisted(() => vi.fn());

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

vi.mock('@/lib/offline/draft-store', () => ({
  deleteDraft: deleteDraftMock,
  getDraft: vi.fn(),
  putDraft: vi.fn(),
}));

vi.mock('@/lib/offline/mutation-store', async () => {
  const actual = await vi.importActual<typeof import('@/lib/offline/mutation-store')>(
    '@/lib/offline/mutation-store',
  );
  return {
    ...actual,
    queueOfflineCreateMutation: queueOfflineCreateMutationMock,
    queueOfflinePatchMutation: queueOfflinePatchMutationMock,
  };
});

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: showErrorNotificationMock,
}));

import {
  BoardOfflineSyncProvider,
  useBoardOfflineSync,
} from '@/app/components/board-offline-sync-provider';

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

function FocusedTask(taskKey: string, note: string | null = 'Body') {
  return {
    id: `task:${taskKey}`,
    taskKey,
    title: `Task ${taskKey}`,
    branch: null,
    note,
    projectId: 'project-1',
    labelIds: [],
    labels: [],
    taskPriority: 'none',
    status: 'todo',
    engine: null,
    dispatchTarget: null,
    runState: null,
    runStateUpdatedAt: null,
    workLogs: [],
  };
}

function BoardOfflineSyncProbe({
  onReady,
}: {
  onReady: (value: ReturnType<typeof useBoardOfflineSync>) => void;
}) {
  const boardOfflineSyncContext = useBoardOfflineSync();

  useEffect(() => {
    onReady(boardOfflineSyncContext);
  }, [boardOfflineSyncContext, onReady]);

  return null;
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
    deleteDraftMock.mockReset();
    queueOfflineCreateMutationMock.mockReset();
    queueOfflinePatchMutationMock.mockReset();

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

  it('falls back to the focused task snapshot when board snapshots are unavailable for offline edits', async () => {
    useOfflineStatusMock.mockReturnValue({ online: false });
    useFocusedTaskMock.mockReturnValue(FocusedTask('PROJ-255', '## Cached task'));
    getKanbanStateMock.mockReturnValue({
      focusedTask: FocusedTask('PROJ-255', '## Cached task'),
      tasksByKey: {},
    });
    queueOfflinePatchMutationMock.mockResolvedValue(undefined);
    const onReady = vi.fn();

    render(
      <BoardOfflineSyncProvider editHrefBase="/board/PROJ" activeProjectId="project-1">
        <BoardOfflineSyncProbe onReady={onReady} />
      </BoardOfflineSyncProvider>,
    );

    await waitFor(() => {
      expect(onReady).toHaveBeenCalled();
    });

    const boardOfflineSyncContext = onReady.mock.lastCall?.[0];
    const result = await boardOfflineSyncContext?.queueTaskPatch({
      taskKey: 'PROJ-255',
      title: 'Renamed offline',
      note: '## Updated offline',
    });

    expect(queueOfflinePatchMutationMock).toHaveBeenCalledWith({
      taskKey: 'PROJ-255',
      payload: {
        title: 'Renamed offline',
        note: '## Updated offline',
        labelIds: undefined,
        taskPriority: undefined,
        status: undefined,
        sortOrder: undefined,
        baseNoteFingerprint: undefined,
      },
    });
    expect(result).toEqual({
      boardTask: expect.objectContaining({
        taskKey: 'PROJ-255',
        title: 'Renamed offline',
        note: '## Updated offline',
      }),
      focusedTask: expect.objectContaining({
        taskKey: 'PROJ-255',
        title: 'Renamed offline',
        note: '## Updated offline',
      }),
    });
  });

  it('clears the offline draft only after a queued patch replay succeeds', async () => {
    getKanbanStateMock.mockReturnValue({
      focusedTask: FocusedTask('PROJ-255'),
      tasksByKey: { 'PROJ-255': buildBoardTask('project-1', 'PROJ', 'PROJ-255') },
    });
    flushOfflineMutationsMock.mockImplementationOnce(async ({ onApplied }) => {
      await onApplied?.({
        kind: 'patch',
        taskKey: 'PROJ-255',
        boardTask: buildBoardTask('project-1', 'PROJ', 'PROJ-255'),
        focusedTask: FocusedTask('PROJ-255'),
      });

      return { appliedCount: 1, error: null, halted: false };
    });

    render(
      <BoardOfflineSyncProvider editHrefBase="/board/PROJ" activeProjectId="project-1">
        <div>board</div>
      </BoardOfflineSyncProvider>,
    );

    await waitFor(() => {
      expect(deleteDraftMock).toHaveBeenCalledWith('task:PROJ-255');
    });
  });

  it('keeps the offline draft and restores latest snapshots when replay hits a note conflict', async () => {
    getKanbanStateMock.mockReturnValue({
      focusedTask: FocusedTask('PROJ-255', '## Stale local note'),
      tasksByKey: { 'PROJ-255': buildBoardTask('project-1', 'PROJ', 'PROJ-255') },
    });
    flushOfflineMutationsMock.mockImplementationOnce(async ({ onConflict }) => {
      await onConflict?.({
        kind: 'patch',
        taskKey: 'PROJ-255',
        error:
          'Server notes changed while offline changes were queued. Reopen the task and use Restore draft to decide what to keep.',
        boardTask: {
          ...buildBoardTask('project-1', 'PROJ', 'PROJ-255'),
          note: '## Latest server note',
        },
        focusedTask: FocusedTask('PROJ-255', '## Latest server note'),
      });

      return { appliedCount: 0, error: null, halted: false };
    });

    render(
      <BoardOfflineSyncProvider editHrefBase="/board/PROJ" activeProjectId="project-1">
        <div>board</div>
      </BoardOfflineSyncProvider>,
    );

    await waitFor(() => {
      expect(upsertSnapshotsMock).toHaveBeenCalledWith([
        expect.objectContaining({
          taskKey: 'PROJ-255',
          note: '## Latest server note',
        }),
      ]);
    });

    expect(setFocusedTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskKey: 'PROJ-255',
        note: '## Latest server note',
      }),
    );
    expect(showErrorNotificationMock).toHaveBeenCalledWith(
      'Server notes changed while offline changes were queued. Reopen the task and use Restore draft to decide what to keep.',
    );
    expect(deleteDraftMock).not.toHaveBeenCalled();
  });
});
