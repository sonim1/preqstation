import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { openOfflineDb } from '@/lib/offline/db';
import { getSnapshot, putSnapshot } from '@/lib/offline/snapshot-store';

describe('lib/offline/snapshot-store', () => {
  beforeEach(async () => {
    const db = await openOfflineDb();
    await db.clear('snapshots');
  });

  it('stores board snapshots per project key', async () => {
    await putSnapshot({
      id: 'board:PROJ',
      kind: 'board',
      entityKey: 'PROJ',
      payload: { focusedTaskKey: null },
      updatedAt: '2026-04-21T00:00:00.000Z',
    });

    expect(await getSnapshot('board:PROJ')).toMatchObject({ kind: 'board' });
  });
});
