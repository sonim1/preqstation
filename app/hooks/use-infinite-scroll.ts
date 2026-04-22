'use client';

import { useCallback, useEffect, useRef } from 'react';

type UseInfiniteScrollOptions = {
  active: boolean;
  hasMore: boolean;
  loading: boolean;
  disabled?: boolean;
  resetKey: string;
  onLoadMore: () => void;
};

type CanAutoLoadOptions = Pick<
  UseInfiniteScrollOptions,
  'active' | 'hasMore' | 'loading' | 'disabled'
>;

type ShouldTriggerForKeyOptions = {
  resetKey: string;
  lastTriggeredKey: string | null;
  isIntersecting: boolean;
};

export function canAutoLoad({ active, hasMore, loading, disabled = false }: CanAutoLoadOptions) {
  return active && hasMore && !loading && !disabled;
}

export function shouldTriggerForKey({
  resetKey,
  lastTriggeredKey,
  isIntersecting,
}: ShouldTriggerForKeyOptions) {
  return isIntersecting && resetKey !== lastTriggeredKey;
}

export function useInfiniteScroll({
  active,
  hasMore,
  loading,
  disabled = false,
  resetKey,
  onLoadMore,
}: UseInfiniteScrollOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isIntersectingRef = useRef(false);
  const lastTriggeredKeyRef = useRef<string | null>(null);
  const optionsRef = useRef({
    active,
    hasMore,
    loading,
    disabled,
    resetKey,
    onLoadMore,
  });

  useEffect(() => {
    optionsRef.current = {
      active,
      hasMore,
      loading,
      disabled,
      resetKey,
      onLoadMore,
    };
  }, [active, hasMore, loading, disabled, resetKey, onLoadMore]);

  const tryLoadMore = useCallback(() => {
    const currentOptions = optionsRef.current;

    if (!canAutoLoad(currentOptions)) {
      return;
    }

    if (
      !shouldTriggerForKey({
        resetKey: currentOptions.resetKey,
        lastTriggeredKey: lastTriggeredKeyRef.current,
        isIntersecting: isIntersectingRef.current,
      })
    ) {
      return;
    }

    lastTriggeredKeyRef.current = currentOptions.resetKey;
    currentOptions.onLoadMore();
  }, []);

  useEffect(() => {
    if (!active) {
      isIntersectingRef.current = false;
      lastTriggeredKeyRef.current = null;
      return;
    }

    tryLoadMore();
  }, [active, hasMore, loading, disabled, resetKey, tryLoadMore]);

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      isIntersectingRef.current = false;

      if (!node || typeof IntersectionObserver !== 'function') {
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        isIntersectingRef.current = Boolean(entry?.isIntersecting);
        tryLoadMore();
      });

      observer.observe(node);
      observerRef.current = observer;
    },
    [tryLoadMore],
  );

  return { ref };
}
