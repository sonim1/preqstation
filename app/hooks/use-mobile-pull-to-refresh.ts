'use client';

import type { TouchEvent } from 'react';
import { useCallback, useRef, useState } from 'react';

const PULL_MAX_PX = 56;
const PULL_REFRESH_THRESHOLD_PX = 40;
const PULL_RESISTANCE = 0.45;

export type MobilePullToRefreshTrigger = {
  pullDistance: number;
  pullProgress: number;
};

type UseMobilePullToRefreshOptions = {
  activeTab: string;
  disabled: boolean;
  onRefresh: (trigger: MobilePullToRefreshTrigger) => void;
};

export function useMobilePullToRefresh({
  activeTab,
  disabled,
  onRefresh,
}: UseMobilePullToRefreshOptions) {
  const [gestureTab, setGestureTab] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isArmed, setIsArmed] = useState(false);
  const gestureTabRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const pullProgressRef = useRef(0);
  const isArmedRef = useRef(false);

  const reset = useCallback(() => {
    gestureTabRef.current = null;
    setGestureTab(null);
    startYRef.current = null;
    pullDistanceRef.current = 0;
    pullProgressRef.current = 0;
    isArmedRef.current = false;
    setPullDistance(0);
    setIsArmed(false);
  }, []);

  const bindScrollContainer = useCallback((node: HTMLDivElement | null) => {
    scrollContainerRef.current = node;
  }, []);

  const onTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }

      startYRef.current = event.touches[0].clientY;
      const nextGestureTab = (scrollContainerRef.current?.scrollTop ?? 0) <= 0 ? activeTab : null;
      gestureTabRef.current = nextGestureTab;
      setGestureTab(nextGestureTab);
    },
    [activeTab, disabled],
  );

  const onTouchMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (gestureTabRef.current !== null && gestureTabRef.current !== activeTab) {
        reset();
        return;
      }

      if (startYRef.current === null) {
        return;
      }

      const currentY = event.touches[0].clientY;
      const deltaY = currentY - startYRef.current;
      const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;

      if (deltaY <= 0) {
        reset();
        return;
      }

      if (scrollTop > 0) {
        return;
      }

      if (gestureTabRef.current === null) {
        gestureTabRef.current = activeTab;
        setGestureTab(activeTab);
        startYRef.current = currentY;
        return;
      }

      event.preventDefault();

      const nextDistance = Math.min(PULL_MAX_PX, Math.round(deltaY * PULL_RESISTANCE));
      const nextProgress = nextDistance <= 0 ? 0 : Math.min(1, nextDistance / PULL_MAX_PX);
      const nextIsArmed = nextDistance >= PULL_REFRESH_THRESHOLD_PX;

      pullDistanceRef.current = nextDistance;
      pullProgressRef.current = nextProgress;
      isArmedRef.current = nextIsArmed;

      setPullDistance(nextDistance);
      setIsArmed(nextIsArmed);
    },
    [activeTab, reset],
  );

  const onTouchEnd = useCallback(() => {
    if (
      (gestureTabRef.current === null || gestureTabRef.current === activeTab) &&
      isArmedRef.current
    ) {
      onRefresh({
        pullDistance: pullDistanceRef.current,
        pullProgress: pullProgressRef.current,
      });
    }

    reset();
  }, [activeTab, onRefresh, reset]);

  const isGestureActive = gestureTab === null || gestureTab === activeTab;
  const visiblePullDistance = isGestureActive ? pullDistance : 0;
  const pullProgress =
    visiblePullDistance <= 0 ? 0 : Math.min(1, visiblePullDistance / PULL_MAX_PX);

  return {
    bindScrollContainer,
    isArmed: isGestureActive ? isArmed : false,
    pullDistance: visiblePullDistance,
    pullProgress,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: reset,
  };
}
