import { type OfflineDraftRecord, openOfflineDb } from '@/lib/offline/db';

export type { OfflineDraftRecord } from '@/lib/offline/db';

export async function putDraft(record: OfflineDraftRecord) {
  const db = await openOfflineDb();
  await db.put('drafts', record);
}

export async function getDraft(id: string) {
  const db = await openOfflineDb();
  return (await db.get('drafts', id)) ?? null;
}

export async function deleteDraft(id: string) {
  const db = await openOfflineDb();
  await db.delete('drafts', id);
}
