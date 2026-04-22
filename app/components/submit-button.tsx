'use client';

import { Button, type ButtonProps } from '@mantine/core';
import { useFormStatus } from 'react-dom';

type SubmitButtonProps = ButtonProps & {
  children: React.ReactNode;
};

export function SubmitButton({ children, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} disabled={pending} {...props}>
      {children}
    </Button>
  );
}
