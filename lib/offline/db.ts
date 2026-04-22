import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

export type OfflineDraftRecord = {
  id: string;
  scope: 'task-edit';
  entityKey: string;
  fields: {
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

interface OfflineDbSchema extends DBSchema {
  drafts: {
    key: string;
    value: OfflineDraftRecord;
  };
  snapshots: {
    key: string;
    value: OfflineSnapshotRecord;
  };
}

export const OFFLINE_DB_NAME = 'preqstation-offline';
export const OFFLINE_DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OfflineDbSchema>> | null = null;

export function openOfflineDb() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDbSchema>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'id' });
        }
      },
    });
  }

  return dbPromise;
}
