import { describe, expect, it, vi } from 'vitest';

import { subscribeMediaQuery } from '@/lib/match-media';

describe('subscribeMediaQuery', () => {
  it('uses addEventListener/removeEventListener when available', () => {
    const listener = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();

    const mediaQuery = {
      addEventListener,
      removeEventListener,
    } as unknown as MediaQueryList;

    const unsubscribe = subscribeMediaQuery(mediaQuery, listener);

    expect(addEventListener).toHaveBeenCalledWith('change', listener);

    unsubscribe();

    expect(removeEventListener).toHaveBeenCalledWith('change', listener);
  });

  it('falls back to addListener/removeListener when addEventListener is unavailable', () => {
    const listener = vi.fn();
    const addListener = vi.fn();
    const removeListener = vi.fn();

    const mediaQuery = {
      addListener,
      removeListener,
    } as unknown as MediaQueryList;

    const unsubscribe = subscribeMediaQuery(mediaQuery, listener);

    expect(addListener).toHaveBeenCalledWith(listener);

    unsubscribe();

    expect(removeListener).toHaveBeenCalledWith(listener);
  });

  it('returns a no-op unsubscribe when no listener API is available', () => {
    const listener = vi.fn();
    const mediaQuery = {} as MediaQueryList;

    const unsubscribe = subscribeMediaQuery(mediaQuery, listener);

    expect(unsubscribe).toBeTypeOf('function');
    expect(() => unsubscribe()).not.toThrow();
  });
});
