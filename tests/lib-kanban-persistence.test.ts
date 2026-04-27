import { describe, expect, it } from 'vitest';

import type { KanbanColumns, KanbanTask } from '@/lib/kanban-helpers';
import {
  collectRecoveryTaskKeys,
  drainKanbanMutationQueue,
  hasKanbanServerSnapshotChanged,
  type QueuedKanbanMutation,
  shouldApplyKanbanServerSnapshot,
  shouldRefreshKanbanAfterPersist,
} from '@/lib/kanban-persistence';

function buildTask(overrides: Partial<KanbanTask> = {}): KanbanTask {
  return {
    id: 'task-1',
    taskKey: 'PROJ-1',
    title: 'Ship refresh sync',
    note: '- [ ] verify sync',
    status: 'todo',
    sortOrder: 'a0',
    taskPriority: 'none',
    dueAt: null,
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    project: null,
    updatedAt: '2026-03-10T00:00:00.000Z',
    archivedAt: null,
    labels: [],
    ...overrides,
  };
}

function buildColumns(task: KanbanTask): KanbanColumns {
  return {
    inbox: [],
    todo: [task],
    hold: [],
    ready: [],
    done: [],
    archived: [],
  };
}

describe('lib/kanban-persistence', () => {
  it('runs queued mutations sequentially', async () => {
    const order: string[] = [];
    const queue: QueuedKanbanMutation[] = [
      {
        run: async () => {
          order.push('first:start');
          await Promise.resolve();
          order.push('first:end');
        },
      },
      {
        run: async () => {
          order.push('second');
        },
      },
    ];

    await drainKanbanMutationQueue(queue);

    expect(order).toEqual(['first:start', 'first:end', 'second']);
    expect(queue).toHaveLength(0);
  });

  it('drains mutations appended while execution is already in progress', async () => {
    const order: string[] = [];
    const queue: QueuedKanbanMutation[] = [
      {
        run: async () => {
          order.push('first');
          queue.push({
            run: async () => {
              order.push('second');
            },
          });
        },
      },
    ];

    await drainKanbanMutationQueue(queue);

    expect(order).toEqual(['first', 'second']);
    expect(queue).toHaveLength(0);
  });

  it('blocks server snapshot hydration while queued work is pending', () => {
    expect(shouldApplyKanbanServerSnapshot({ isPersisting: false, queuedCount: 0 })).toBe(true);
    expect(shouldApplyKanbanServerSnapshot({ isPersisting: true, queuedCount: 0 })).toBe(false);
    expect(shouldApplyKanbanServerSnapshot({ isPersisting: false, queuedCount: 2 })).toBe(false);
  });

  it('detects refreshed server snapshots when ids and order stay the same but task metadata changes', () => {
    const previous = buildColumns(buildTask());
    const next = buildColumns(
      buildTask({
        updatedAt: '2026-03-10T00:05:00.000Z',
        title: 'Ship outbox sync',
        taskPriority: 'high',
        labels: [{ id: 'label-1', name: 'bugfix', color: 'red' }],
        note: '- [x] verify sync',
      }),
    );

    expect(hasKanbanServerSnapshotChanged(previous, next)).toBe(true);
  });

  it('detects refreshed server snapshots when only the dispatch target changes', () => {
    const previous = buildColumns(buildTask({ dispatchTarget: 'telegram' }));
    const next = buildColumns(buildTask({ dispatchTarget: 'hermes-telegram' }));

    expect(hasKanbanServerSnapshotChanged(previous, next)).toBe(true);
  });

  it('ignores server snapshots when the rendered kanban task state is unchanged', () => {
    const previous = buildColumns(buildTask());
    const next = buildColumns(buildTask());

    expect(hasKanbanServerSnapshotChanged(previous, next)).toBe(false);
  });

  it('collects only the affected task keys for targeted persistence recovery', () => {
    const previous = {
      ...buildColumns(buildTask()),
      todo: [
        buildTask({ id: 'task-1', taskKey: 'PROJ-255', sortOrder: 'a0' }),
        buildTask({ id: 'task-2', taskKey: 'PROJ-256', sortOrder: 'b0' }),
      ],
    };
    const optimistic = {
      ...buildColumns(buildTask()),
      todo: [
        buildTask({ id: 'task-2', taskKey: 'PROJ-256', sortOrder: 'b0' }),
        buildTask({ id: 'task-1', taskKey: 'PROJ-255', sortOrder: 'c0' }),
      ],
    };

    expect(collectRecoveryTaskKeys(previous, optimistic)).toEqual(['PROJ-255']);
  });

  it('keeps the optimistic board state after successful persistence', () => {
    expect(shouldRefreshKanbanAfterPersist({ didFail: false, didRepairFail: false })).toBe(false);
  });

  it('skips route refresh when targeted repair succeeds after persistence fails', () => {
    expect(shouldRefreshKanbanAfterPersist({ didFail: true, didRepairFail: false })).toBe(false);
  });

  it('falls back to route refresh only when targeted repair also fails', () => {
    expect(shouldRefreshKanbanAfterPersist({ didFail: true, didRepairFail: true })).toBe(true);
  });
});
