'use client';

import { Button, type ButtonProps } from '@mantine/core';
import Link from 'next/link';
import type { ComponentPropsWithoutRef } from 'react';

type LinkButtonProps = ButtonProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, 'style' | 'className'>;

export function LinkButton(props: LinkButtonProps) {
  return <Button component={Link} {...props} />;
}
