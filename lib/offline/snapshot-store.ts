import { type OfflineSnapshotRecord, openOfflineDb } from '@/lib/offline/db';

export type { OfflineSnapshotRecord } from '@/lib/offline/db';

export async function putSnapshot<TPayload>(record: OfflineSnapshotRecord<TPayload>) {
  const db = await openOfflineDb();
  await db.put('snapshots', record as OfflineSnapshotRecord);
}

export async function getSnapshot<TPayload>(id: string) {
  const db = await openOfflineDb();
  return ((await db.get('snapshots', id)) as OfflineSnapshotRecord<TPayload> | undefined) ?? null;
}
