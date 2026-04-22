import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/components/load-more-button', () => ({
  LoadMoreButton: ({ disabled, loading }: { disabled?: boolean; loading?: boolean }) => (
    <div
      data-load-more-button="true"
      data-disabled={disabled ? 'true' : 'false'}
      data-loading={loading ? 'true' : 'false'}
    >
      Load more
    </div>
  ),
}));

import { InfiniteScrollTrigger } from '@/app/components/infinite-scroll-trigger';

describe('app/components/infinite-scroll-trigger', () => {
  it('renders a sentinel marker during automatic paging', () => {
    const html = renderToStaticMarkup(
      <InfiniteScrollTrigger
        active={true}
        hasMore={true}
        loading={false}
        resetKey="10"
        onLoadMore={() => {}}
      />,
    );

    expect(html).toContain('data-infinite-scroll-trigger="true"');
    expect(html).not.toContain('data-load-more-button="true"');
  });

  it('renders the manual retry fallback when automatic paging is paused', () => {
    const html = renderToStaticMarkup(
      <InfiniteScrollTrigger
        active={true}
        hasMore={true}
        loading={true}
        disabled={true}
        resetKey="10"
        onLoadMore={() => {}}
        showManualFallback={true}
      />,
    );

    expect(html).toContain('data-load-more-button="true"');
    expect(html).toContain('data-disabled="true"');
    expect(html).toContain('data-loading="true"');
    expect(html).not.toContain('data-infinite-scroll-trigger="true"');
  });
});
