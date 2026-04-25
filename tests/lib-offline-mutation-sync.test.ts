import { describe, expect, it, vi } from 'vitest';

import { flushOfflineMutations } from '@/lib/offline/mutation-sync';

const listQueuedOfflineMutationsMock = vi.hoisted(() => vi.fn());
const deleteOfflineMutationMock = vi.hoisted(() => vi.fn());
const rekeyOfflinePatchMutationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/offline/mutation-store', () => ({
  deleteOfflineMutation: deleteOfflineMutationMock,
  listQueuedOfflineMutations: listQueuedOfflineMutationsMock,
  rekeyOfflinePatchMutation: rekeyOfflinePatchMutationMock,
}));

describe('lib/offline/mutation-sync', () => {
  it('rekeys queued patch mutations after syncing an offline-created task', async () => {
    listQueuedOfflineMutationsMock.mockResolvedValueOnce([
      {
        id: 'create:OFFLINE-123456789',
        kind: 'create',
        clientTaskKey: 'OFFLINE-123456789',
        createdAt: '2026-04-25T12:00:00.000Z',
        payload: {
          title: 'Offline task',
          note: 'Saved offline',
          projectId: 'project-1',
          labelIds: [],
          taskPriority: 'none',
          status: 'inbox',
          sortOrder: 'a0',
        },
      },
    ]);

    const onApplied = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        boardTask: {
          id: 'task-1',
          taskKey: 'PROJ-900',
          title: 'Offline task',
          note: 'Saved offline',
          branch: null,
          status: 'inbox',
          sortOrder: 'a0',
          taskPriority: 'none',
          dueAt: null,
          engine: null,
          runState: null,
          runStateUpdatedAt: null,
          project: { id: 'project-1', name: 'Alpha', projectKey: 'PROJ' },
          updatedAt: '2026-04-25T12:01:00.000Z',
          archivedAt: null,
          labels: [],
        },
      }),
    });

    const result = await flushOfflineMutations({ fetchImpl: fetchMock, onApplied });

    expect(result).toEqual({ appliedCount: 1, error: null, halted: false });
    expect(deleteOfflineMutationMock).toHaveBeenCalledWith('create:OFFLINE-123456789');
    expect(rekeyOfflinePatchMutationMock).toHaveBeenCalledWith({
      previousTaskKey: 'OFFLINE-123456789',
      nextTaskKey: 'PROJ-900',
    });
    expect(onApplied).toHaveBeenCalledWith({
      kind: 'create',
      previousTaskKey: 'OFFLINE-123456789',
      boardTask: expect.objectContaining({ taskKey: 'PROJ-900' }),
    });
  });

  it('hydrates focused task payloads returned from offline patch replay', async () => {
    listQueuedOfflineMutationsMock.mockResolvedValueOnce([
      {
        id: 'patch:PROJ-512',
        kind: 'patch',
        createdAt: '2026-04-25T12:00:00.000Z',
        taskKey: 'PROJ-512',
        payload: { title: 'Renamed offline' },
      },
    ]);

    const onApplied = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        boardTask: {
          id: 'task-512',
          taskKey: 'PROJ-512',
          title: 'Renamed offline',
          note: 'Body',
          branch: null,
          status: 'todo',
          sortOrder: 'a0',
          taskPriority: 'none',
          dueAt: null,
          engine: null,
          runState: null,
          runStateUpdatedAt: null,
          project: { id: 'project-1', name: 'Alpha', projectKey: 'PROJ' },
          updatedAt: '2026-04-25T12:02:00.000Z',
          archivedAt: null,
          labels: [],
        },
        focusedTask: {
          id: 'task-512',
          taskKey: 'PROJ-512',
          title: 'Renamed offline',
          branch: null,
          note: 'Body',
          projectId: 'project-1',
          labelIds: [],
          labels: [],
          taskPriority: 'none',
          status: 'todo',
          engine: null,
          runState: null,
          runStateUpdatedAt: null,
          workLogs: [
            {
              id: 'log-1',
              title: 'Edited',
              createdAt: '2026-04-25T12:02:00.000Z',
              workedAt: '2026-04-25T12:02:00.000Z',
              todo: null,
            },
          ],
        },
      }),
    });

    await flushOfflineMutations({ fetchImpl: fetchMock, onApplied });

    expect(deleteOfflineMutationMock).toHaveBeenCalledWith('patch:PROJ-512');
    expect(onApplied).toHaveBeenCalledWith({
      kind: 'patch',
      taskKey: 'PROJ-512',
      boardTask: expect.objectContaining({ taskKey: 'PROJ-512' }),
      focusedTask: expect.objectContaining({
        taskKey: 'PROJ-512',
        workLogs: [expect.objectContaining({ workedAt: expect.any(Date) })],
      }),
    });
  });
});
