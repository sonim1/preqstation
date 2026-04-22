'use client';

import { LoadMoreButton } from '@/app/components/load-more-button';
import { useInfiniteScroll } from '@/app/hooks/use-infinite-scroll';

type InfiniteScrollTriggerProps = {
  active: boolean;
  hasMore: boolean;
  loading: boolean;
  disabled?: boolean;
  resetKey: string;
  onLoadMore: () => void;
  showManualFallback?: boolean;
};

export function InfiniteScrollTrigger({
  active,
  hasMore,
  loading,
  disabled = false,
  resetKey,
  onLoadMore,
  showManualFallback = false,
}: InfiniteScrollTriggerProps) {
  const { ref } = useInfiniteScroll({
    active,
    hasMore,
    loading,
    disabled,
    resetKey,
    onLoadMore,
  });

  if (!hasMore) {
    return null;
  }

  if (showManualFallback) {
    return <LoadMoreButton onClick={onLoadMore} disabled={disabled} loading={loading} />;
  }

  return (
    <div
      ref={ref}
      data-infinite-scroll-trigger="true"
      aria-hidden="true"
      style={{ blockSize: 1, inlineSize: '100%' }}
    />
  );
}
