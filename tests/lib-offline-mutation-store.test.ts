import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { openOfflineDb } from '@/lib/offline/db';
import {
  buildOfflineCreateMutationId,
  buildOfflinePatchMutationId,
  buildOptimisticTasksFromQueuedCreates,
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

  it('preserves a queued base note fingerprint when later offline edits omit it', async () => {
    await queueOfflinePatchMutation({
      taskKey: 'PROJ-401',
      payload: {
        note: 'First offline rewrite',
        baseNoteFingerprint: 'task-note:v1:12:abcdef',
      },
    });
    await queueOfflinePatchMutation({
      taskKey: 'PROJ-401',
      payload: {
        title: 'Renamed offline',
        baseNoteFingerprint: undefined,
      },
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
          note: 'First offline rewrite',
          baseNoteFingerprint: 'task-note:v1:12:abcdef',
        },
      },
    ]);
  });

  it('preserves a queued base title fingerprint when later offline edits omit it', async () => {
    await queueOfflinePatchMutation({
      taskKey: 'PROJ-401',
      payload: {
        title: 'First offline rename',
        baseTitleFingerprint: 'task-title:v1:12:abcdef',
      },
    });
    await queueOfflinePatchMutation({
      taskKey: 'PROJ-401',
      payload: {
        note: 'Later offline rewrite',
        baseTitleFingerprint: undefined,
      },
    });

    const queued = await listQueuedOfflineMutations();

    expect(queued).toEqual([
      {
        id: buildOfflinePatchMutationId('PROJ-401'),
        kind: 'patch',
        createdAt: expect.any(String),
        taskKey: 'PROJ-401',
        payload: {
          title: 'First offline rename',
          note: 'Later offline rewrite',
          baseTitleFingerprint: 'task-title:v1:12:abcdef',
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

  it('builds optimistic board tasks from queued offline create records', () => {
    const tasks = buildOptimisticTasksFromQueuedCreates(
      [
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
      ],
      {
        'project-1': { id: 'project-1', name: 'Project PROJ', projectKey: 'PROJ' },
      },
      {
        'label-1': { id: 'label-1', name: 'Bug', color: 'red' },
      },
    );

    expect(tasks).toEqual([
      expect.objectContaining({
        id: 'offline-task:OFFLINE-123',
        taskKey: 'OFFLINE-123',
        title: 'Offline card',
        status: 'inbox',
        sortOrder: 'a0',
        project: expect.objectContaining({ id: 'project-1', projectKey: 'PROJ' }),
        labels: [expect.objectContaining({ id: 'label-1', name: 'Bug', color: 'red' })],
      }),
    ]);
  });
});
