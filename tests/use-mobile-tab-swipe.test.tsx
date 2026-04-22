import type { TouchEvent } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useRefMock = vi.hoisted(() => vi.fn());
const useCallbackMock = vi.hoisted(() => vi.fn());

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useRef: useRefMock,
    useCallback: useCallbackMock,
  };
});

import { useMobileTabSwipe } from '@/app/hooks/use-mobile-tab-swipe';

function touchStart(clientX: number, clientY: number) {
  return {
    touches: [{ clientX, clientY }],
  } as unknown as TouchEvent<Element>;
}

function touchEnd(clientX: number, clientY: number) {
  return {
    changedTouches: [{ clientX, clientY }],
  } as unknown as TouchEvent<Element>;
}

describe('useMobileTabSwipe', () => {
  beforeEach(() => {
    useRefMock.mockReset();
    useCallbackMock.mockReset();

    useRefMock.mockImplementation(<T,>(initialValue: T) => ({ current: initialValue }));
    useCallbackMock.mockImplementation(<T,>(callback: T) => callback);
  });

  it('moves to the next tab on a left swipe', () => {
    const onTabChange = vi.fn();
    const swipeHandlers = useMobileTabSwipe(['inbox', 'todo', 'hold'], 'todo', onTabChange);

    swipeHandlers.onTouchStart(touchStart(180, 120));
    swipeHandlers.onTouchEnd(touchEnd(100, 130));

    expect(onTabChange).toHaveBeenCalledWith('hold');
  });

  it('moves to the previous tab on a right swipe', () => {
    const onTabChange = vi.fn();
    const swipeHandlers = useMobileTabSwipe(['inbox', 'todo', 'hold'], 'todo', onTabChange);

    swipeHandlers.onTouchStart(touchStart(100, 120));
    swipeHandlers.onTouchEnd(touchEnd(180, 130));

    expect(onTabChange).toHaveBeenCalledWith('inbox');
  });

  it('ignores swipes below the threshold', () => {
    const onTabChange = vi.fn();
    const swipeHandlers = useMobileTabSwipe(['inbox', 'todo', 'hold'], 'todo', onTabChange);

    swipeHandlers.onTouchStart(touchStart(120, 120));
    swipeHandlers.onTouchEnd(touchEnd(80, 122));

    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('ignores vertical-dominant gestures', () => {
    const onTabChange = vi.fn();
    const swipeHandlers = useMobileTabSwipe(['inbox', 'todo', 'hold'], 'todo', onTabChange);

    swipeHandlers.onTouchStart(touchStart(180, 120));
    swipeHandlers.onTouchEnd(touchEnd(110, 240));

    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('accepts horizontal swipes when the horizontal and vertical deltas are equal', () => {
    const onTabChange = vi.fn();
    const swipeHandlers = useMobileTabSwipe(['inbox', 'todo', 'hold'], 'todo', onTabChange);

    swipeHandlers.onTouchStart(touchStart(180, 120));
    swipeHandlers.onTouchEnd(touchEnd(120, 180));

    expect(onTabChange).toHaveBeenCalledWith('hold');
  });

  it('does nothing on a right swipe from the first tab', () => {
    const onTabChange = vi.fn();
    const swipeHandlers = useMobileTabSwipe(['inbox', 'todo', 'hold'], 'inbox', onTabChange);

    swipeHandlers.onTouchStart(touchStart(100, 120));
    swipeHandlers.onTouchEnd(touchEnd(180, 130));

    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('does nothing on a left swipe from the last tab', () => {
    const onTabChange = vi.fn();
    const swipeHandlers = useMobileTabSwipe(['inbox', 'todo', 'hold'], 'hold', onTabChange);

    swipeHandlers.onTouchStart(touchStart(180, 120));
    swipeHandlers.onTouchEnd(touchEnd(100, 130));

    expect(onTabChange).not.toHaveBeenCalled();
  });
});
