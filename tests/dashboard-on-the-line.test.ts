import { describe, expect, it } from 'vitest';

import { selectOnTheLineTodos } from '@/lib/dashboard-on-the-line';

describe('lib/dashboard-on-the-line', () => {
  it('chooses only the most recent running task as now', () => {
    const lane = selectOnTheLineTodos([
      {
        id: 'task-running-newest',
        taskKey: 'PM-101',
        status: 'todo',
        runState: 'running',
        runStateUpdatedAt: new Date('2026-04-05T10:00:00.000Z'),
        updatedAt: new Date('2026-04-05T10:00:00.000Z'),
      },
      {
        id: 'task-running-older',
        taskKey: 'PM-102',
        status: 'todo',
        runState: 'running',
        runStateUpdatedAt: new Date('2026-04-05T09:00:00.000Z'),
        updatedAt: new Date('2026-04-05T09:00:00.000Z'),
      },
      {
        id: 'task-recent-next',
        taskKey: 'PM-103',
        status: 'inbox',
        runState: null,
        runStateUpdatedAt: null,
        updatedAt: new Date('2026-04-05T08:30:00.000Z'),
        focusedAt: new Date('2026-04-05T07:00:00.000Z'),
      },
      {
        id: 'task-done',
        taskKey: 'PM-104',
        status: 'done',
        runState: null,
        runStateUpdatedAt: null,
        updatedAt: new Date('2026-04-05T11:00:00.000Z'),
      },
    ]);

    expect(lane.nowCount).toBe(1);
    expect(lane.nextCount).toBe(2);
    expect(lane.rows.map((task) => [task.taskKey, task.laneRole])).toEqual([
      ['PM-101', 'now'],
      ['PM-102', 'next'],
      ['PM-103', 'next'],
    ]);
  });

  it('uses updatedAt when runStateUpdatedAt is missing', () => {
    const lane = selectOnTheLineTodos([
      {
        id: 'task-1',
        taskKey: 'PM-201',
        status: 'todo',
        runState: null,
        runStateUpdatedAt: null,
        updatedAt: new Date('2026-04-05T10:00:00.000Z'),
      },
      {
        id: 'task-2',
        taskKey: 'PM-202',
        status: 'hold',
        runState: null,
        runStateUpdatedAt: null,
        updatedAt: new Date('2026-04-05T09:00:00.000Z'),
      },
      {
        id: 'task-3',
        taskKey: 'PM-203',
        status: 'ready',
        runState: null,
        runStateUpdatedAt: null,
        updatedAt: new Date('2026-04-05T08:00:00.000Z'),
      },
      {
        id: 'task-4',
        taskKey: 'PM-204',
        status: 'inbox',
        runState: null,
        runStateUpdatedAt: null,
        updatedAt: new Date('2026-04-05T07:00:00.000Z'),
      },
      {
        id: 'task-focused-stale',
        taskKey: 'PM-205',
        status: 'todo',
        runState: null,
        runStateUpdatedAt: null,
        updatedAt: new Date('2026-04-04T07:00:00.000Z'),
        focusedAt: new Date('2026-04-05T11:00:00.000Z'),
      },
    ]);

    expect(lane.nowCount).toBe(0);
    expect(lane.nextCount).toBe(4);
    expect(lane.rows.map((task) => task.taskKey)).toEqual(['PM-201', 'PM-202', 'PM-203', 'PM-204']);
  });
});
