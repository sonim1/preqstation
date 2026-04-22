import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const execute = vi.fn();
  const where = vi.fn();
  const from = vi.fn();
  const select = vi.fn();
  const getEventOutboxCleanupCutoff = vi.fn();

  return {
    execute,
    where,
    from,
    select,
    getEventOutboxCleanupCutoff,
    db: {
      execute,
      select,
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/event-outbox-cleanup', () => ({
  getEventOutboxCleanupCutoff: mocked.getEventOutboxCleanupCutoff,
}));

import { POST } from '@/app/api/events/cleanup/route';

function flattenQueryChunks(query: { queryChunks?: unknown[] }) {
  return (query.queryChunks ?? []).flatMap((chunk) => {
    if (
      chunk &&
      typeof chunk === 'object' &&
      'value' in chunk &&
      Array.isArray((chunk as { value: unknown }).value)
    ) {
      return (chunk as { value: string[] }).value;
    }
    return [chunk];
  });
}

function postRequest(secret?: string) {
  return new Request(`${TEST_BASE_URL}/api/events/cleanup`, {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

describe('app/api/events/cleanup/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    mocked.getEventOutboxCleanupCutoff.mockReturnValue(new Date('2026-03-24T12:00:00.000Z'));
    mocked.execute.mockResolvedValue({ count: 12 });
    mocked.where.mockResolvedValue([{ count: 4 }]);
    mocked.from.mockReturnValue({ where: mocked.where });
    mocked.select.mockReturnValue({ from: mocked.from });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('serializes cleanup raw SQL cutoff as an ISO string', async () => {
    const response = await POST(postRequest('test-secret') as Parameters<typeof POST>[0]);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ deleted: 12, remaining: 4 });

    const [queryArg] = mocked.execute.mock.calls[0] ?? [];
    const chunks = flattenQueryChunks(queryArg);

    expect(chunks).toContain('2026-03-24T12:00:00.000Z');
    expect(chunks.some((chunk) => chunk instanceof Date)).toBe(false);
  });
});
