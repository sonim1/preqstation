import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

import type { KanbanStatus } from '@/lib/kanban-helpers';

export type OfflineDraftRecord = {
  id: string;
  scope: 'task-edit';
  entityKey: string;
  fields: {
    baseNoteFingerprint?: string;
    note?: string;
    title?: string;
  };
  updatedAt: string;
};

export type OfflineSnapshotRecord<TPayload = unknown> = {
  id: string;
  kind: 'board' | 'task';
  entityKey: string;
  payload: TPayload;
  updatedAt: string;
};

export type OfflineCreateMutationPayload = {
  labelIds: string[];
  note: string;
  projectId: string;
  sortOrder: string;
  status: KanbanStatus;
  taskPriority: string;
  title: string;
};

export type OfflinePatchMutationPayload = {
  labelIds?: string[];
  note?: string;
  sortOrder?: string;
  status?: KanbanStatus;
  taskPriority?: string;
  title?: string;
};

export type OfflineCreateMutationRecord = {
  id: string;
  kind: 'create';
  clientTaskKey: string;
  createdAt: string;
  payload: OfflineCreateMutationPayload;
};

export type OfflinePatchMutationRecord = {
  id: string;
  kind: 'patch';
  createdAt: string;
  payload: OfflinePatchMutationPayload;
  taskKey: string;
};

export type OfflineMutationRecord = OfflineCreateMutationRecord | OfflinePatchMutationRecord;

interface OfflineDbSchema extends DBSchema {
  drafts: {
    key: string;
    value: OfflineDraftRecord;
  };
  mutations: {
    key: string;
    value: OfflineMutationRecord;
  };
  snapshots: {
    key: string;
    value: OfflineSnapshotRecord;
  };
}

export const OFFLINE_DB_NAME = 'preqstation-offline';
export const OFFLINE_DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<OfflineDbSchema>> | null = null;

export function openOfflineDb() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDbSchema>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('mutations')) {
          db.createObjectStore('mutations', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'id' });
        }
      },
    });
  }

  return dbPromise;
}
