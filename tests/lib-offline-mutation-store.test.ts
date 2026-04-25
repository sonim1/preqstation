import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { openOfflineDb } from '@/lib/offline/db';
import {
  buildOfflineCreateMutationId,
  buildOfflinePatchMutationId,
  listQueuedOfflineMutations,
  queueOfflineCreateMutation,
  queueOfflinePatchMutation,
  rekeyOfflinePatchMutation,
} from '@/lib/offline/mutation-store';

describe('lib/offline/mutation-store', () => {
  beforeEach(async () => {
    const db = await openOfflineDb();
    await db.clear('mutations');
  });

  it('stores one merged patch record per task key', async () => {
    await queueOfflinePatchMutation({
      taskKey: 'PROJ-401',
      payload: { title: 'First title', note: 'First note' },
    });
    await queueOfflinePatchMutation({
      taskKey: 'PROJ-401',
      payload: { taskPriority: 'high' },
    });

    const queued = await listQueuedOfflineMutations();

    expect(queued).toEqual([
      {
        id: buildOfflinePatchMutationId('PROJ-401'),
        kind: 'patch',
        createdAt: expect.any(String),
        taskKey: 'PROJ-401',
        payload: {
          title: 'First title',
          note: 'First note',
          taskPriority: 'high',
        },
      },
    ]);
  });

  it('preserves previously queued patch fields when a later payload leaves them undefined', async () => {
    await queueOfflinePatchMutation({
      taskKey: 'PROJ-401',
      payload: { status: 'todo', sortOrder: 'a1' },
    });
    await queueOfflinePatchMutation({
      taskKey: 'PROJ-401',
      payload: { title: 'Renamed offline', sortOrder: undefined },
    });

    const queued = await listQueuedOfflineMutations();

    expect(queued).toEqual([
      {
        id: buildOfflinePatchMutationId('PROJ-401'),
        kind: 'patch',
        createdAt: expect.any(String),
        taskKey: 'PROJ-401',
        payload: {
          title: 'Renamed offline',
          status: 'todo',
          sortOrder: 'a1',
        },
      },
    ]);
  });

  it('merges offline edits into the queued create record for local tasks', async () => {
    await queueOfflineCreateMutation({
      taskKey: 'OFFLINE-123456789',
      payload: {
        title: 'Draft task',
        note: '',
        projectId: 'project-1',
        labelIds: [],
        taskPriority: 'none',
        status: 'inbox',
        sortOrder: 'a0',
      },
    });

    await queueOfflinePatchMutation({
      taskKey: 'OFFLINE-123456789',
      payload: {
        note: 'Edited offline',
        status: 'todo',
        sortOrder: 'a1',
      },
    });

    const queued = await listQueuedOfflineMutations();

    expect(queued).toEqual([
      {
        id: buildOfflineCreateMutationId('OFFLINE-123456789'),
        kind: 'create',
        clientTaskKey: 'OFFLINE-123456789',
        createdAt: expect.any(String),
        payload: {
          title: 'Draft task',
          note: 'Edited offline',
          projectId: 'project-1',
          labelIds: [],
          taskPriority: 'none',
          status: 'todo',
          sortOrder: 'a1',
        },
      },
    ]);
  });

  it('preserves queued create fields when later offline edits omit optional values', async () => {
    await queueOfflineCreateMutation({
      taskKey: 'OFFLINE-123456789',
      payload: {
        title: 'Draft task',
        note: '',
        projectId: 'project-1',
        labelIds: [],
        taskPriority: 'none',
        status: 'inbox',
        sortOrder: 'a0',
      },
    });
    await queueOfflinePatchMutation({
      taskKey: 'OFFLINE-123456789',
      payload: {
        status: 'todo',
        sortOrder: 'a1',
      },
    });
    await queueOfflinePatchMutation({
      taskKey: 'OFFLINE-123456789',
      payload: {
        title: 'Draft task renamed',
        sortOrder: undefined,
      },
    });

    const queued = await listQueuedOfflineMutations();

    expect(queued).toEqual([
      {
        id: buildOfflineCreateMutationId('OFFLINE-123456789'),
        kind: 'create',
        clientTaskKey: 'OFFLINE-123456789',
        createdAt: expect.any(String),
        payload: {
          title: 'Draft task renamed',
          note: '',
          projectId: 'project-1',
          labelIds: [],
          taskPriority: 'none',
          status: 'todo',
          sortOrder: 'a1',
        },
      },
    ]);
  });

  it('rekeys queued patches after an offline task receives a real task key', async () => {
    await queueOfflinePatchMutation({
      taskKey: 'OFFLINE-123456789',
      payload: { title: 'Rename after sync' },
    });

    await rekeyOfflinePatchMutation({
      previousTaskKey: 'OFFLINE-123456789',
      nextTaskKey: 'PROJ-512',
    });

    const queued = await listQueuedOfflineMutations();

    expect(queued).toEqual([
      {
        id: buildOfflinePatchMutationId('PROJ-512'),
        kind: 'patch',
        createdAt: expect.any(String),
        taskKey: 'PROJ-512',
        payload: { title: 'Rename after sync' },
      },
    ]);
  });
});
