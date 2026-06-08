import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { OFFLINE_DB_VERSION, openOfflineDb } from '@/lib/offline/db';
import { putSnapshot } from '@/lib/offline/snapshot-store';
import { searchOfflineTaskSnapshots } from '@/lib/offline/task-search';

function buildTask(overrides: Record<string, unknown>) {
  return {
    id: 'task-1',
    taskKey: 'PROJ-101',
    branch: null,
    title: 'Tune local command palette',
    note: null,
    status: 'todo',
    sortOrder: 'a0',
    taskPriority: 'none',
    dueAt: null,
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    project: { id: 'project-1', name: 'Alpha Project', projectKey: 'PROJ' },
    updatedAt: '2026-06-08T12:00:00.000Z',
    archivedAt: null,
    labels: [],
    ...overrides,
  };
}

describe('lib/offline/task-search', () => {
  beforeEach(async () => {
    const db = await openOfflineDb();
    await db.clear('snapshots');
    expect(OFFLINE_DB_VERSION).toBeGreaterThanOrEqual(2);
  });

  it('returns local board snapshot task hits before server search is needed', async () => {
    await putSnapshot({
      id: 'board:PROJ',
      kind: 'board',
      entityKey: 'PROJ',
      payload: {
        columns: {
          inbox: [],
          todo: [buildTask({ taskKey: 'PROJ-101', title: 'Tune local command palette' })],
          hold: [],
          ready: [],
          done: [],
          archived: [],
        },
        focusedTask: null,
      },
      updatedAt: '2026-06-08T12:00:00.000Z',
    });

    await expect(searchOfflineTaskSnapshots('command')).resolves.toEqual([
      {
        taskId: 'task-1',
        taskKey: 'PROJ-101',
        title: 'Tune local command palette',
        status: 'todo',
        project: { id: 'project-1', name: 'Alpha Project', projectKey: 'PROJ' },
      },
    ]);
  });

  it('dedupes the same task across board snapshots and keeps the newest snapshot first', async () => {
    await putSnapshot({
      id: 'board:OLD',
      kind: 'board',
      entityKey: 'OLD',
      payload: {
        columns: {
          inbox: [],
          todo: [buildTask({ taskKey: 'PROJ-101', title: 'Old title' })],
          hold: [],
          ready: [],
          done: [],
          archived: [],
        },
        focusedTask: null,
      },
      updatedAt: '2026-06-08T11:00:00.000Z',
    });
    await putSnapshot({
      id: 'board:PROJ',
      kind: 'board',
      entityKey: 'PROJ',
      payload: {
        columns: {
          inbox: [],
          todo: [buildTask({ taskKey: 'PROJ-101', title: 'New local title' })],
          hold: [],
          ready: [],
          done: [],
          archived: [],
        },
        focusedTask: null,
      },
      updatedAt: '2026-06-08T12:00:00.000Z',
    });

    const hits = await searchOfflineTaskSnapshots('proj-101');

    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      taskKey: 'PROJ-101',
      title: 'New local title',
    });
  });
});
