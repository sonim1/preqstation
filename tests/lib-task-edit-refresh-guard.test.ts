import { describe, expect, it } from 'vitest';

import {
  consumePendingTaskEditRefresh,
  getTaskEditRefreshState,
  markPendingTaskEditRefresh,
  setTaskEditRefreshBlocked,
  subscribeTaskEditRefresh,
} from '@/lib/task-edit-refresh-guard';

describe('lib/task-edit-refresh-guard', () => {
  it('tracks blocked state and consumes one pending refresh after unblock', () => {
    const notifications: Array<{ blocked: boolean; pending: boolean }> = [];
    const unsubscribe = subscribeTaskEditRefresh(() => {
      notifications.push(getTaskEditRefreshState());
    });

    setTaskEditRefreshBlocked(true);
    markPendingTaskEditRefresh();

    expect(getTaskEditRefreshState()).toEqual({ blocked: true, pending: true });
    expect(consumePendingTaskEditRefresh()).toBe(true);
    expect(consumePendingTaskEditRefresh()).toBe(false);
    expect(notifications).toEqual([
      { blocked: true, pending: false },
      { blocked: true, pending: true },
      { blocked: true, pending: false },
    ]);

    unsubscribe();
    setTaskEditRefreshBlocked(false);
  });
});
