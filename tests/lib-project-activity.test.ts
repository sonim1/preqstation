import { describe, expect, it } from 'vitest';

import { getProjectActivityStatus } from '@/lib/project-activity';

describe('lib/project-activity', () => {
  const now = new Date('2026-03-09T12:00:00.000Z');

  it('returns inactive when the project is not active', () => {
    expect(
      getProjectActivityStatus({ projectStatus: 'paused', lastWorkedAt: now, now }).status,
    ).toBe('inactive');
  });

  it('returns inactive when no work logs exist yet', () => {
    expect(
      getProjectActivityStatus({ projectStatus: 'active', lastWorkedAt: null, now }).status,
    ).toBe('inactive');
  });

  it('returns healthy when the latest work log is within 3 days', () => {
    expect(
      getProjectActivityStatus({
        projectStatus: 'active',
        lastWorkedAt: new Date('2026-03-07T12:00:00.000Z'),
        now,
      }).status,
    ).toBe('healthy');
  });

  it('accepts an ISO timestamp string from aggregated work log queries', () => {
    expect(
      getProjectActivityStatus({
        projectStatus: 'active',
        lastWorkedAt: '2026-03-07T12:00:00.000Z',
        now,
      }).status,
    ).toBe('healthy');
  });

  it('returns warning when the latest work log is within 7 days but older than 3 days', () => {
    expect(
      getProjectActivityStatus({
        projectStatus: 'active',
        lastWorkedAt: new Date('2026-03-04T12:00:00.000Z'),
        now,
      }).status,
    ).toBe('warning');
  });

  it('returns critical when the latest work log is older than 7 days', () => {
    expect(
      getProjectActivityStatus({
        projectStatus: 'active',
        lastWorkedAt: new Date('2026-02-28T12:00:00.000Z'),
        now,
      }).status,
    ).toBe('critical');
  });
});
