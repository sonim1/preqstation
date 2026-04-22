'use client';

import { Group, Kbd, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useTerminology } from './terminology-provider';

export const COMMAND_PALETTE_OPEN_EVENT = 'pm:command-palette:open';

type CommandPaletteTriggerProps = {
  onOpen?: () => void;
  variant?: 'compact' | 'full';
};

export function CommandPaletteTrigger({ onOpen, variant = 'full' }: CommandPaletteTriggerProps) {
  const terminology = useTerminology();
  const openPalette = useCallback(() => {
    onOpen?.();
    window.dispatchEvent(new Event(COMMAND_PALETTE_OPEN_EVENT));
  }, [onOpen]);
  const isCompact = variant === 'compact';

  return (
    <UnstyledButton
      type="button"
      aria-label="Open search"
      onClick={openPalette}
      style={{ cursor: 'pointer' }}
      className={`command-palette-trigger${isCompact ? ' command-palette-trigger--compact' : ''}`}
      data-command-palette-trigger={variant}
      data-command-palette-trigger-variant={variant}
    >
      <Group gap={10} wrap="nowrap">
        <IconSearch size={15} className="command-palette-trigger-icon" />
        {isCompact ? null : (
          <>
            <Stack gap={0} className="command-palette-trigger-copy">
              <Text size="sm" fw={600} className="command-palette-trigger-label">
                {`Search ${terminology.task.pluralLower}, pages, projects`}
              </Text>
            </Stack>
            <Kbd size="xs" className="command-palette-trigger-shortcut">
              ⌘K
            </Kbd>
          </>
        )}
      </Group>
    </UnstyledButton>
  );
}
