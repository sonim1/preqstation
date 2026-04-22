'use client';

import type { TouchEvent } from 'react';
import { useCallback, useRef } from 'react';

const SWIPE_THRESHOLD_PX = 50;

export function useMobileTabSwipe(
  statuses: readonly string[],
  activeTab: string,
  onTabChange: (tab: string) => void,
) {
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);

  const onTouchStart = useCallback((event: TouchEvent<Element>) => {
    startXRef.current = event.touches[0].clientX;
    startYRef.current = event.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback(
    (event: TouchEvent<Element>) => {
      if (startXRef.current === null || startYRef.current === null) {
        return;
      }

      const deltaX = event.changedTouches[0].clientX - startXRef.current;
      const deltaY = event.changedTouches[0].clientY - startYRef.current;

      startXRef.current = null;
      startYRef.current = null;

      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY)) {
        return;
      }

      const activeIndex = statuses.indexOf(activeTab);
      if (activeIndex === -1) {
        return;
      }

      if (deltaX < 0 && activeIndex < statuses.length - 1) {
        onTabChange(statuses[activeIndex + 1]);
      }

      if (deltaX > 0 && activeIndex > 0) {
        onTabChange(statuses[activeIndex - 1]);
      }
    },
    [activeTab, onTabChange, statuses],
  );

  return { onTouchStart, onTouchEnd };
}
