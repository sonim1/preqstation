// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hydrateMock = vi.hoisted(() => vi.fn());
const getSnapshotMock = vi.hoisted(() => vi.fn());
const putSnapshotMock = vi.hoisted(() => vi.fn());
const listQueuedOfflineMutationsMock = vi.hoisted(() => vi.fn());
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

vi.mock('@/lib/offline/mutation-store', async () => {
  const actual = await vi.importActual<typeof import('@/lib/offline/mutation-store')>(
    '@/lib/offline/mutation-store',
  );
  return {
    ...actual,
    listQueuedOfflineMutations: listQueuedOfflineMutationsMock,
  };
});

import { OfflineBoardHydrator } from '@/app/components/offline-board-hydrator';

describe('app/components/offline-board-hydrator', () => {
  beforeEach(() => {
    hydrateMock.mockReset();
    getSnapshotMock.mockReset();
    putSnapshotMock.mockReset();
    listQueuedOfflineMutationsMock.mockReset();
    useFocusedTaskMock.mockReset();
    useKanbanColumnsMock.mockReset();
    getSnapshotMock.mockResolvedValue(null);
    putSnapshotMock.mockResolvedValue(undefined);
    listQueuedOfflineMutationsMock.mockResolvedValue([]);
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

  it('stores queued offline creates in the board snapshot so refresh keeps them visible', async () => {
    listQueuedOfflineMutationsMock.mockResolvedValue([
      {
        id: 'create:OFFLINE-123',
        kind: 'create',
        clientTaskKey: 'OFFLINE-123',
        createdAt: '2026-05-06T10:00:00.000Z',
        payload: {
          title: 'Offline card',
          note: '',
          projectId: 'project-1',
          labelIds: ['label-1'],
          taskPriority: 'none',
          status: 'inbox',
          sortOrder: 'a0',
        },
      },
    ]);
    useKanbanColumnsMock.mockReturnValue({
      inbox: [],
      todo: [
        {
          id: '1',
          taskKey: 'PROJ-1',
          branch: null,
          title: 'Existing',
          note: null,
          status: 'todo',
          sortOrder: 'a0',
          taskPriority: 'none',
          dueAt: null,
          engine: null,
          runState: null,
          runStateUpdatedAt: null,
          project: { id: 'project-1', name: 'Project PROJ', projectKey: 'PROJ' },
          updatedAt: '2026-05-06T10:00:00.000Z',
          archivedAt: null,
          labels: [{ id: 'label-1', name: 'Bug', color: 'red' }],
        },
      ],
      hold: [],
      ready: [],
      done: [],
      archived: [],
    });

    render(<OfflineBoardHydrator boardKey="PROJ" />);

    await waitFor(() => {
      expect(putSnapshotMock).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            columns: expect.objectContaining({
              inbox: [
                expect.objectContaining({
                  taskKey: 'OFFLINE-123',
                  title: 'Offline card',
                  labels: [expect.objectContaining({ id: 'label-1', name: 'Bug', color: 'red' })],
                }),
              ],
            }),
          }),
        }),
      );
    });
  });
});
