import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const values = vi.fn();
  const insert = vi.fn(() => ({ values }));
  const client = { insert };
  return {
    client,
    insert,
    values,
  };
});

vi.mock('@/lib/db', () => ({
  db: mocked.client,
}));

vi.mock('@/lib/db/schema', () => ({
  eventsOutbox: 'eventsOutbox',
}));

import {
  ENTITY_TASK,
  TASK_UPDATED,
  writeOutboxEvent,
  writeOutboxEventStandalone,
} from '@/lib/outbox';

describe('lib/outbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes transactional outbox inserts for live sync events', async () => {
    await writeOutboxEvent({
      tx: mocked.client as never,
      ownerId: 'owner-1',
      projectId: 'project-1',
      eventType: TASK_UPDATED,
      entityType: ENTITY_TASK,
      entityId: 'PROJ-1',
      payload: { status: 'done' },
    });

    expect(mocked.insert).toHaveBeenCalledWith('eventsOutbox');
    expect(mocked.values).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        projectId: 'project-1',
        eventType: TASK_UPDATED,
        entityType: ENTITY_TASK,
        entityId: 'PROJ-1',
        payload: { status: 'done' },
      }),
    );
  });

  it('writes standalone outbox inserts for live sync events', async () => {
    await writeOutboxEventStandalone({
      ownerId: 'owner-1',
      projectId: 'project-1',
      eventType: TASK_UPDATED,
      entityType: ENTITY_TASK,
      entityId: 'PROJ-1',
      payload: { status: 'done' },
    });

    expect(mocked.insert).toHaveBeenCalledWith('eventsOutbox');
    expect(mocked.values).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        projectId: 'project-1',
        eventType: TASK_UPDATED,
        entityType: ENTITY_TASK,
        entityId: 'PROJ-1',
        payload: { status: 'done' },
      }),
    );
  });
});
