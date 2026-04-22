'use client';

import { Box, Group, Loader, Text } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

type AutoSaveIndicatorProps = {
  status: 'idle' | 'saving' | 'saved';
  justify?: 'center' | 'flex-end';
};

export function AutoSaveIndicator({ status, justify = 'flex-end' }: AutoSaveIndicatorProps) {
  return (
    <Group gap={6} h={36} justify={justify}>
      <Box
        className="autosave-indicator-slot"
        aria-live="polite"
        style={{
          minWidth: 92,
          height: 20,
          position: 'relative',
        }}
      >
        <Group
          gap={6}
          wrap="nowrap"
          style={{
            position: 'absolute',
            inset: 0,
            justifyContent: justify,
            transition: 'opacity 160ms ease, transform 160ms ease',
            opacity: status === 'saving' ? 1 : 0,
            transform: status === 'saving' ? 'translateY(0)' : 'translateY(4px)',
          }}
        >
          <Loader size={14} />
          <Text size="sm" c="dimmed">
            Saving...
          </Text>
        </Group>
        <Group
          gap={6}
          wrap="nowrap"
          style={{
            position: 'absolute',
            inset: 0,
            justifyContent: justify,
            transition: 'opacity 160ms ease, transform 160ms ease',
            opacity: status === 'saved' ? 1 : 0,
            transform: status === 'saved' ? 'translateY(0)' : 'translateY(4px)',
          }}
        >
          <IconCheck size={14} color="var(--mantine-color-green-6)" />
          <Text size="sm" c="green">
            Saved
          </Text>
        </Group>
      </Box>
    </Group>
  );
}
