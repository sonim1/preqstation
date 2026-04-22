import { Group, Stack, Text, ThemeIcon } from '@mantine/core';
import type { CSSProperties, ReactNode } from 'react';

const EMPTY_STATE_ICON_STYLE = {
  '--ti-bd': '1px solid color-mix(in srgb, var(--ui-border), transparent 12%)',
  '--ti-bg': 'color-mix(in srgb, var(--ui-neutral-soft), var(--ui-surface-strong) 24%)',
  '--ti-color': 'var(--ui-muted-text)',
} as CSSProperties;

type EmptyStateProps = {
  icon?: ReactNode;
  iconClassName?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  align?: 'center' | 'start';
  compact?: boolean;
  className?: string;
};

export function EmptyState({
  icon,
  iconClassName,
  title,
  description,
  action,
  align = 'center',
  compact,
  className,
}: EmptyStateProps) {
  if (compact) {
    if (action) {
      return (
        <Group justify="space-between" align="center" wrap="wrap" py="xs" className={className}>
          <Text c="dimmed" size="sm">
            {title}
          </Text>
          {action}
        </Group>
      );
    }
    return (
      <Text c="dimmed" size="sm" ta="center" py="xs" className={className}>
        {title}
      </Text>
    );
  }

  return (
    <Stack
      align={align === 'start' ? 'flex-start' : 'center'}
      gap="xs"
      py="md"
      className={className}
    >
      {icon ? (
        <ThemeIcon className={iconClassName} size="xl" radius="xl" style={EMPTY_STATE_ICON_STYLE}>
          {icon}
        </ThemeIcon>
      ) : null}
      <Text c="dimmed" fw={500} ta={align === 'start' ? 'left' : 'center'}>
        {title}
      </Text>
      {description ? (
        <Text c="dimmed" size="sm" ta={align === 'start' ? 'left' : 'center'} maw={280}>
          {description}
        </Text>
      ) : null}
      {action ? (
        <Group gap="xs" mt={4} justify={align === 'start' ? 'flex-start' : 'center'}>
          {action}
        </Group>
      ) : null}
    </Stack>
  );
}
