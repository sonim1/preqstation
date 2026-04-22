'use client';

import { Button, type ButtonProps } from '@mantine/core';
import type { ComponentPropsWithoutRef } from 'react';

type LoadMoreButtonProps = Pick<ButtonProps, 'disabled' | 'loading'> &
  Pick<ComponentPropsWithoutRef<'button'>, 'onClick' | 'style'>;

export function LoadMoreButton({ disabled, loading, onClick, style }: LoadMoreButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      size="xs"
      style={style}
      variant="default"
      w="fit-content"
    >
      Load more
    </Button>
  );
}
