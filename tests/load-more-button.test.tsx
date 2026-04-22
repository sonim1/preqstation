import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const buttonSpy = vi.fn(
  ({
    children,
    disabled,
    loading,
    size,
    variant,
    w,
  }: {
    children?: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
    size?: string;
    variant?: string;
    w?: string;
  }) => (
    <button
      type="button"
      data-disabled={disabled ? 'true' : 'false'}
      data-loading={loading ? 'true' : 'false'}
      data-size={size}
      data-variant={variant}
      data-width={w}
    >
      {children}
    </button>
  ),
);

vi.mock('@mantine/core', () => ({
  Button: (props: React.ComponentProps<'button'> & { loading?: boolean; w?: string }) =>
    buttonSpy(props),
}));

import { LoadMoreButton } from '@/app/components/load-more-button';

describe('app/components/load-more-button', () => {
  it('renders the shared label and forwards the required button state with locked styling', () => {
    const onClick = vi.fn();

    const html = renderToStaticMarkup(
      <LoadMoreButton onClick={onClick} disabled={true} loading={true} />,
    );

    expect(html).toContain('Load more');
    expect(html).toContain('data-disabled="true"');
    expect(html).toContain('data-loading="true"');

    expect(buttonSpy).toHaveBeenCalledTimes(1);
    expect(buttonSpy.mock.calls[0]?.[0]).toMatchObject({
      children: 'Load more',
      disabled: true,
      loading: true,
      onClick,
      size: 'xs',
      variant: 'default',
      w: 'fit-content',
    });
  });
});
