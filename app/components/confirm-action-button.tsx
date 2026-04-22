'use client';

import { Button, type ButtonProps, Group, Modal, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { type CSSProperties, type ReactNode, useCallback, useRef, useState } from 'react';

type ConfirmActionButtonProps = ButtonProps & {
  /** Modal title */
  confirmTitle?: string;
  /** Modal body text */
  confirmMessage?: ReactNode;
  /** Confirm button label */
  confirmLabel?: string;
  /** If provided, submit the form with this ID on confirm */
  formId?: string;
  /** If provided, called on confirm (used when no formId) */
  onConfirm?: () => void | Promise<void>;
  /** Button children (trigger label) */
  children: ReactNode;
};

const CONFIRM_BUTTON_STYLE = {
  '--button-bg': 'var(--ui-danger)',
  '--button-hover': 'color-mix(in srgb, var(--ui-danger), var(--ui-surface-strong) 18%)',
  '--button-color': 'var(--ui-surface-strong)',
  '--button-bd': '1px solid color-mix(in srgb, var(--ui-danger), transparent 18%)',
} as CSSProperties;

export function ConfirmActionButton({
  confirmTitle = 'Confirm deletion',
  confirmMessage = 'This action cannot be undone. Are you sure?',
  confirmLabel = 'Delete',
  formId,
  onConfirm,
  children,
  ...buttonProps
}: ConfirmActionButtonProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const handleConfirm = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);

    try {
      if (formId) {
        const form = document.getElementById(formId) as HTMLFormElement | null;
        form?.requestSubmit();
      } else if (onConfirm) {
        await onConfirm();
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
      close();
    }
  }, [formId, onConfirm, close]);

  return (
    <>
      <Button {...buttonProps} onClick={open}>
        {children}
      </Button>
      <Modal opened={opened} onClose={close} title={confirmTitle} centered size="sm">
        <Stack gap="md">
          <Text size="sm">{confirmMessage}</Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} loading={busy} style={CONFIRM_BUTTON_STYLE}>
              {confirmLabel}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
