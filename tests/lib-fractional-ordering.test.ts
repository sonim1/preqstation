import { describe, expect, it } from 'vitest';

import { needsRebalancing, rebalanceKeys } from '@/lib/fractional-ordering';
import { computeSortOrder, type KanbanTask } from '@/lib/kanban-helpers';

function makeTask(overrides: Partial<KanbanTask> = {}): KanbanTask {
  return {
    id: 'id-1',
    taskKey: 'T-1',
    title: 'Task',
    note: null,
    status: 'todo',
    sortOrder: 'a0',
    taskPriority: 'none',
    dueAt: null,
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    project: null,
    updatedAt: new Date().toISOString(),
    archivedAt: null,
    labels: [],
    ...overrides,
  };
}

describe('fractional-ordering', () => {
  describe('needsRebalancing', () => {
    it('returns false for short keys', () => {
      expect(needsRebalancing('a0')).toBe(false);
      expect(needsRebalancing('a'.repeat(50))).toBe(false);
    });

    it('returns true for keys exceeding 50 chars', () => {
      expect(needsRebalancing('a'.repeat(51))).toBe(true);
    });
  });

  describe('rebalanceKeys', () => {
    it('generates well-spaced keys', () => {
      const keys = rebalanceKeys(5);
      expect(keys).toHaveLength(5);
      for (let i = 0; i < keys.length - 1; i++) {
        expect(keys[i] < keys[i + 1]).toBe(true);
      }
    });

    it('generates a single key', () => {
      const keys = rebalanceKeys(1);
      expect(keys).toHaveLength(1);
      expect(typeof keys[0]).toBe('string');
    });
  });

  describe('computeSortOrder', () => {
    it('generates key for empty column (insert at 0)', () => {
      const key = computeSortOrder([], 0);
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('generates key before first item (insert at top)', () => {
      const column = [makeTask({ sortOrder: 'b00' })];
      const key = computeSortOrder(column, 0);
      expect(key < 'b00').toBe(true);
    });

    it('generates key after last item (insert at bottom)', () => {
      const column = [makeTask({ sortOrder: 'a0' }), makeTask({ sortOrder: 'b00' })];
      const key = computeSortOrder(column, 2);
      expect(key > 'b00').toBe(true);
    });

    it('generates key between two items (insert in middle)', () => {
      const column = [makeTask({ sortOrder: 'a0' }), makeTask({ sortOrder: 'a5' })];
      const key = computeSortOrder(column, 1);
      expect(key > 'a0').toBe(true);
      expect(key < 'a5').toBe(true);
    });
  });
});
