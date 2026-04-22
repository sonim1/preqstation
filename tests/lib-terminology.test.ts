import { describe, expect, it } from 'vitest';

import { DEFAULT_TERMINOLOGY, KITCHEN_TERMINOLOGY, resolveTerminology } from '@/lib/terminology';

describe('lib/terminology', () => {
  it('keeps PREQ terminology as the default mode', () => {
    expect(resolveTerminology(false)).toBe(DEFAULT_TERMINOLOGY);
    expect(resolveTerminology(false).task.singular).toBe('Task');
    expect(resolveTerminology(false).task.pluralLower).toBe('tasks');
    expect(resolveTerminology(false).statuses.ready).toBe('Ready');
  });

  it('switches mapped task and status copy in kitchen mode', () => {
    expect(resolveTerminology(true)).toBe(KITCHEN_TERMINOLOGY);
    expect(resolveTerminology(true).task.singular).toBe('Ticket');
    expect(resolveTerminology(true).task.plural).toBe('Tickets');
    expect(resolveTerminology(true).statuses.hold).toBe("86'd");
    expect(resolveTerminology(true).statuses.ready).toBe('Pass');
    expect(resolveTerminology(true).statuses.done).toBe('Order Up');
    expect(resolveTerminology(true).agents.plural).toBe('Line Cooks');
  });
});
