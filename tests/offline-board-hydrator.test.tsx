// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hydrateMock = vi.hoisted(() => vi.fn());
const getSnapshotMock = vi.hoisted(() => vi.fn());
const putSnapshotMock = vi.hoisted(() => vi.fn());
const useFocusedTaskMock = vi.hoisted(() => vi.fn());
const useKanbanColumnsMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/components/kanban-store-provider', () => ({
  useFocusedTask: () => useFocusedTaskMock(),
  useHydrateKanbanStore: () => hydrateMock,
  useKanbanColumns: () => useKanbanColumnsMock(),
}));

vi.mock('@/lib/offline/snapshot-store', () => ({
  getSnapshot: getSnapshotMock,
  putSnapshot: putSnapshotMock,
}));

import { OfflineBoardHydrator } from '@/app/components/offline-board-hydrator';

describe('app/components/offline-board-hydrator', () => {
  beforeEach(() => {
    hydrateMock.mockReset();
    getSnapshotMock.mockReset();
    putSnapshotMock.mockReset();
    useFocusedTaskMock.mockReset();
    useKanbanColumnsMock.mockReset();
    getSnapshotMock.mockResolvedValue(null);
    putSnapshotMock.mockResolvedValue(undefined);
    useFocusedTaskMock.mockReturnValue(null);
    useKanbanColumnsMock.mockReturnValue({
      inbox: [],
      todo: [],
      hold: [],
      ready: [],
      done: [],
      archived: [],
    });
    vi.stubGlobal('navigator', { onLine: true } as Navigator);
  });

  it('stores the latest board snapshot for the current project', async () => {
    render(<OfflineBoardHydrator boardKey="PROJ" />);

    await waitFor(() => {
      expect(putSnapshotMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'board:PROJ',
          kind: 'board',
          entityKey: 'PROJ',
        }),
      );
    });
  });

  it('hydrates the kanban store from the saved board snapshot when offline', async () => {
    vi.stubGlobal('navigator', { onLine: false } as Navigator);
    getSnapshotMock.mockResolvedValue({
      id: 'board:PROJ',
      kind: 'board',
      entityKey: 'PROJ',
      payload: {
        columns: {
          inbox: [],
          todo: [
            {
              id: '1',
              taskKey: 'PROJ-1',
              branch: null,
              title: 'Cached',
              note: null,
              status: 'todo',
              sortOrder: 'a0',
              taskPriority: 'none',
              dueAt: null,
              engine: null,
              runState: null,
              runStateUpdatedAt: null,
              project: null,
              updatedAt: '2026-04-21T00:00:00.000Z',
              archivedAt: null,
              labels: [],
            },
          ],
          hold: [],
          ready: [],
          done: [],
          archived: [],
        },
        focusedTask: null,
      },
      updatedAt: '2026-04-21T00:00:00.000Z',
    });

    render(<OfflineBoardHydrator boardKey="PROJ" />);

    await waitFor(() => {
      expect(hydrateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          columns: expect.objectContaining({
            todo: [expect.objectContaining({ taskKey: 'PROJ-1', title: 'Cached' })],
          }),
        }),
      );
    });
  });
});
