import { describe, expect, it, vi } from 'vitest';

import { buildMoveIntentRequest, requestMoveIntent } from '@/app/components/kanban-board';
import type { KanbanColumns } from '@/lib/kanban-helpers';

function buildColumns(): KanbanColumns {
  return {
    inbox: [],
    todo: [],
    hold: [],
    ready: [
      {
        id: 'task-5',
        taskKey: 'PROJ-5',
        title: 'Left neighbor',
        note: null,
        branch: null,
        status: 'ready',
        sortOrder: 'a0',
        taskPriority: 'none',
        dueAt: null,
        engine: null,
        runState: null,
        runStateUpdatedAt: null,
        project: null,
        updatedAt: '2026-04-01T00:00:00.000Z',
        archivedAt: null,
        labels: [],
      },
      {
        id: 'task-7',
        taskKey: 'PROJ-7',
        title: 'Moved task',
        note: null,
        branch: null,
        status: 'ready',
        sortOrder: 'a1',
        taskPriority: 'none',
        dueAt: null,
        engine: null,
        runState: null,
        runStateUpdatedAt: null,
        project: null,
        updatedAt: '2026-04-01T00:00:00.000Z',
        archivedAt: null,
        labels: [],
      },
      {
        id: 'task-9',
        taskKey: 'PROJ-9',
        title: 'Right neighbor',
        note: null,
        branch: null,
        status: 'ready',
        sortOrder: 'a2',
        taskPriority: 'none',
        dueAt: null,
        engine: null,
        runState: null,
        runStateUpdatedAt: null,
        project: null,
        updatedAt: '2026-04-01T00:00:00.000Z',
        archivedAt: null,
        labels: [],
      },
    ],
    done: [],
    archived: [],
  };
}

describe('app/components/kanban-board persistence helpers', () => {
  it('builds move-intent payloads from neighboring task keys in the destination lane', () => {
    expect(
      buildMoveIntentRequest({
        columns: buildColumns(),
        taskKey: 'PROJ-7',
        targetStatus: 'ready',
      }),
    ).toEqual({
      taskKey: 'PROJ-7',
      targetStatus: 'ready',
      afterTaskKey: 'PROJ-5',
      beforeTaskKey: 'PROJ-9',
    });
  });

  it('persists drag moves through /api/todos/move instead of per-task PATCH writes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        boardTask: { taskKey: 'PROJ-7', status: 'ready', sortOrder: 'a1' },
      }),
    });

    await requestMoveIntent(fetchMock, {
      taskKey: 'PROJ-7',
      targetStatus: 'ready',
      afterTaskKey: 'PROJ-5',
      beforeTaskKey: 'PROJ-9',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/todos/move',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
