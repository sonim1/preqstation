import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { openOfflineDb } from '@/lib/offline/db';
import { deleteDraft, getDraft, putDraft } from '@/lib/offline/draft-store';

describe('lib/offline/draft-store', () => {
  beforeEach(async () => {
    const db = await openOfflineDb();
    await db.clear('drafts');
  });

  it('upserts and deletes task drafts by deterministic key', async () => {
    await putDraft({
      id: 'task:PROJ-415',
      scope: 'task-edit',
      entityKey: 'PROJ-415',
      fields: { title: '초안' },
      updatedAt: '2026-04-21T00:00:00.000Z',
    });

    expect(await getDraft('task:PROJ-415')).toMatchObject({
      fields: { title: '초안' },
    });

    await deleteDraft('task:PROJ-415');

    expect(await getDraft('task:PROJ-415')).toBeNull();
  });
});
