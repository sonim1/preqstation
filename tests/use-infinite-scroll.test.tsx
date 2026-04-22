import { describe, expect, it } from 'vitest';

import { canAutoLoad, shouldTriggerForKey } from '@/app/hooks/use-infinite-scroll';

describe('app/hooks/use-infinite-scroll', () => {
  it('allows auto-loading only when the trigger is active and idle', () => {
    expect(canAutoLoad({ active: true, hasMore: true, loading: false, disabled: false })).toBe(
      true,
    );
    expect(canAutoLoad({ active: false, hasMore: true, loading: false, disabled: false })).toBe(
      false,
    );
    expect(canAutoLoad({ active: true, hasMore: false, loading: false, disabled: false })).toBe(
      false,
    );
    expect(canAutoLoad({ active: true, hasMore: true, loading: true, disabled: false })).toBe(
      false,
    );
    expect(canAutoLoad({ active: true, hasMore: true, loading: false, disabled: true })).toBe(
      false,
    );
  });

  it('triggers only once per pagination key while the sentinel remains intersecting', () => {
    expect(
      shouldTriggerForKey({
        resetKey: '10',
        lastTriggeredKey: null,
        isIntersecting: true,
      }),
    ).toBe(true);
    expect(
      shouldTriggerForKey({
        resetKey: '10',
        lastTriggeredKey: '10',
        isIntersecting: true,
      }),
    ).toBe(false);
    expect(
      shouldTriggerForKey({
        resetKey: '20',
        lastTriggeredKey: '10',
        isIntersecting: true,
      }),
    ).toBe(true);
    expect(
      shouldTriggerForKey({
        resetKey: '20',
        lastTriggeredKey: '10',
        isIntersecting: false,
      }),
    ).toBe(false);
  });
});
