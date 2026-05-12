import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => ({
  requireOwnerUser: vi.fn(),
  client: {
    query: {
      eventsOutbox: {
        findMany: vi.fn(),
      },
    },
  },
}));

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: unknown) => unknown) =>
    callback(mocked.client),
}));

import { GET } from '@/app/api/events/route';

function request(search = '') {
  return new Request(`${TEST_BASE_URL}/api/events${search}`);
}

function queryParamValues(value: unknown): unknown[] {
  if (!value || typeof value !== 'object') return [];

  if (value.constructor.name === 'Param' && 'value' in value) {
    return [value.value];
  }

  const queryChunks = 'queryChunks' in value ? value.queryChunks : undefined;
  if (!Array.isArray(queryChunks)) return [];

  return queryChunks.flatMap((chunk) => queryParamValues(chunk));
}

describe('app/api/events/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.client.query.eventsOutbox.findMany.mockResolvedValue([]);
  });

  it('returns the latest cursor without replaying events when no after cursor is provided', async () => {
    mocked.client.query.eventsOutbox.findMany.mockResolvedValueOnce([{ id: 42n }]);

    const response = await GET(request('?projectId=project-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ events: [], cursor: '42', staleCursor: false });
  });

  it('returns a stable zero cursor when the owner has no events yet', async () => {
    const response = await GET(request('?projectId=project-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ events: [], cursor: '0', staleCursor: false });
  });

  it('returns owner/project scoped events after the provided cursor with bigint ids serialized', async () => {
    mocked.client.query.eventsOutbox.findMany
      .mockResolvedValueOnce([{ id: 11n }])
      .mockResolvedValueOnce([
        {
          id: 12n,
          projectId: 'project-1',
          eventType: 'TASK_UPDATED',
          entityType: 'task',
          entityId: 'PQST-104',
          payload: { changedFields: ['runState'] },
          createdAt: new Date('2026-05-11T12:00:00.000Z'),
        },
      ]);

    const response = await GET(request('?projectId=project-1&after=11'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      events: [
        {
          id: '12',
          projectId: 'project-1',
          eventType: 'TASK_UPDATED',
          entityType: 'task',
          entityId: 'PQST-104',
          payload: { changedFields: ['runState'] },
          createdAt: '2026-05-11T12:00:00.000Z',
        },
      ],
      cursor: '12',
      staleCursor: false,
    });
  });

  it('marks staleCursor when cleanup has removed events newer than the requested cursor range', async () => {
    mocked.client.query.eventsOutbox.findMany
      .mockResolvedValueOnce([{ id: 25n }])
      .mockResolvedValueOnce([]);

    const response = await GET(request('?projectId=project-1&after=10'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ events: [], cursor: '25', staleCursor: true });
  });

  it('measures stale project cursors against the same project-scoped event set', async () => {
    mocked.client.query.eventsOutbox.findMany.mockReset();
    mocked.client.query.eventsOutbox.findMany.mockImplementation((options: { limit: number; where: unknown }) => {
      if (options.limit === 1) {
        return Promise.resolve(queryParamValues(options.where).includes('project-1') ? [] : [{ id: 5n }]);
      }

      return Promise.resolve([
        {
          id: 4n,
          projectId: 'project-1',
          eventType: 'TASK_UPDATED',
          entityType: 'task',
          entityId: 'PQST-104',
          payload: { changedFields: ['title'] },
          createdAt: new Date('2026-05-11T12:00:00.000Z'),
        },
      ]);
    });

    const response = await GET(request('?projectId=project-1&after=3'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      events: [
        {
          id: '4',
          projectId: 'project-1',
          eventType: 'TASK_UPDATED',
          entityType: 'task',
          entityId: 'PQST-104',
          payload: { changedFields: ['title'] },
          createdAt: '2026-05-11T12:00:00.000Z',
        },
      ],
      cursor: '4',
      staleCursor: false,
    });
  });

  it('rejects an invalid after cursor', async () => {
    const response = await GET(request('?projectId=project-1&after=not-a-cursor'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid after cursor' });
  });
});
