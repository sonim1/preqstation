import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { openOfflineDb } from '@/lib/offline/db';

describe('lib/offline/db', () => {
  beforeEach(async () => {
    const db = await openOfflineDb();
    await db.clear('drafts');
    await db.clear('mutations');
    await db.clear('snapshots');
  });

  it('opens one offline db with drafts, mutations, and snapshots stores', async () => {
    const db = await openOfflineDb();

    expect(db.objectStoreNames.contains('drafts')).toBe(true);
    expect(db.objectStoreNames.contains('mutations')).toBe(true);
    expect(db.objectStoreNames.contains('snapshots')).toBe(true);
  });
});
