import type { TouchEvent } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useCallbackMock = vi.hoisted(() => vi.fn());
const useEffectMock = vi.hoisted(() => vi.fn());
const useRefMock = vi.hoisted(() => vi.fn());
const useStateMock = vi.hoisted(() => vi.fn());

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useCallback: useCallbackMock,
    useEffect: useEffectMock,
    useRef: useRefMock,
    useState: useStateMock,
  };
});

import { useMobilePullToRefresh } from '@/app/hooks/use-mobile-pull-to-refresh';

function createHarness() {
  const refs: Array<{ current: unknown }> = [];
  const stateValues: unknown[] = [];
  let refIndex = 0;
  let stateIndex = 0;

  useRefMock.mockImplementation((initialValue: unknown) => {
    const index = refIndex++;
    refs[index] ??= { current: initialValue };
    return refs[index];
  });

  useStateMock.mockImplementation((initialValue: unknown) => {
    const index = stateIndex++;
    if (!(index in stateValues)) {
      stateValues[index] = initialValue;
    }

    return [
      stateValues[index],
      (value: unknown) => {
        stateValues[index] =
          typeof value === 'function'
            ? (value as (current: unknown) => unknown)(stateValues[index])
            : value;
      },
    ];
  });

  return {
    useHook(options: Parameters<typeof useMobilePullToRefresh>[0]) {
      refIndex = 0;
      stateIndex = 0;
      return useMobilePullToRefresh(options);
    },
  };
}

function touchStart(clientY: number) {
  return { touches: [{ clientY }] } as unknown as TouchEvent<HTMLDivElement>;
}

function touchMove(clientY: number) {
  return {
    touches: [{ clientY }],
    preventDefault: vi.fn(),
  } as unknown as TouchEvent<HTMLDivElement>;
}

describe('useMobilePullToRefresh', () => {
  beforeEach(() => {
    useCallbackMock.mockReset();
    useEffectMock.mockReset();
    useRefMock.mockReset();
    useStateMock.mockReset();

    useCallbackMock.mockImplementation(<T,>(callback: T) => callback);
    useEffectMock.mockImplementation(() => undefined);
  });

  it('arms and refreshes after a downward pull from the top edge', () => {
    const onRefresh = vi.fn();
    const harness = createHarness();

    let hook = harness.useHook({ activeTab: 'todo', disabled: false, onRefresh });
    hook.bindScrollContainer({ scrollTop: 0 } as HTMLDivElement);
    hook.onTouchStart(touchStart(120));
    hook.onTouchMove(touchMove(232));

    hook = harness.useHook({ activeTab: 'todo', disabled: false, onRefresh });
    expect(hook.isArmed).toBe(true);
    expect(hook.pullDistance).toBeGreaterThan(0);

    hook.onTouchEnd();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('caps the visible pull distance and reports normalized progress for the indicator', () => {
    const onRefresh = vi.fn();
    const harness = createHarness();

    let hook = harness.useHook({ activeTab: 'todo', disabled: false, onRefresh });
    hook.bindScrollContainer({ scrollTop: 0 } as HTMLDivElement);
    hook.onTouchStart(touchStart(100));
    hook.onTouchMove(touchMove(320));

    hook = harness.useHook({ activeTab: 'todo', disabled: false, onRefresh });
    expect(hook.pullDistance).toBe(56);
    expect(hook.pullProgress).toBe(1);
    expect(hook.isArmed).toBe(true);
  });

  it('does not arm when the active lane is already scrolled away from the top', () => {
    const onRefresh = vi.fn();
    const harness = createHarness();

    const hook = harness.useHook({ activeTab: 'todo', disabled: false, onRefresh });
    hook.bindScrollContainer({ scrollTop: 18 } as HTMLDivElement);
    hook.onTouchStart(touchStart(120));
    hook.onTouchMove(touchMove(232));
    hook.onTouchEnd();

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('arms after the active lane reaches the top mid-gesture and the pull continues', () => {
    const onRefresh = vi.fn();
    const harness = createHarness();
    const container = { scrollTop: 24 } as HTMLDivElement;

    let hook = harness.useHook({ activeTab: 'todo', disabled: false, onRefresh });
    hook.bindScrollContainer(container);
    hook.onTouchStart(touchStart(120));

    container.scrollTop = 10;
    hook.onTouchMove(touchMove(156));

    container.scrollTop = 0;
    hook.onTouchMove(touchMove(188));
    hook.onTouchMove(touchMove(296));

    hook = harness.useHook({ activeTab: 'todo', disabled: false, onRefresh });
    expect(hook.isArmed).toBe(true);

    hook.onTouchEnd();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('cancels the refresh when the gesture reverses upward before release', () => {
    const onRefresh = vi.fn();
    const harness = createHarness();

    let hook = harness.useHook({ activeTab: 'todo', disabled: false, onRefresh });
    hook.bindScrollContainer({ scrollTop: 0 } as HTMLDivElement);
    hook.onTouchStart(touchStart(180));
    hook.onTouchMove(touchMove(240));
    hook.onTouchMove(touchMove(150));

    hook = harness.useHook({ activeTab: 'todo', disabled: false, onRefresh });
    expect(hook.isArmed).toBe(false);
    expect(hook.pullDistance).toBe(0);

    hook.onTouchEnd();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('ignores pulls while refresh is disabled', () => {
    const onRefresh = vi.fn();
    const harness = createHarness();

    let hook = harness.useHook({ activeTab: 'todo', disabled: true, onRefresh });
    hook.bindScrollContainer({ scrollTop: 0 } as HTMLDivElement);
    hook.onTouchStart(touchStart(120));
    hook.onTouchMove(touchMove(232));

    hook = harness.useHook({ activeTab: 'todo', disabled: true, onRefresh });
    expect(hook.isArmed).toBe(false);
    expect(hook.pullDistance).toBe(0);

    hook.onTouchEnd();
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
