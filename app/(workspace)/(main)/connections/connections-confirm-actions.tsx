'use client';

import { Button, type ButtonProps, Group, Modal, Stack, Text } from '@mantine/core';
import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

type ConfirmationRequest = {
  confirmLabel: string;
  confirmMessage: ReactNode;
  confirmTitle: string;
  formId: string;
};

type ConnectionsConfirmActionButtonProps = ButtonProps & {
  children: ReactNode;
  confirmLabel?: string;
  confirmMessage?: ReactNode;
  confirmTitle?: string;
  formId: string;
};

type ConnectionsConfirmActionContextValue = (request: ConfirmationRequest) => void;

const ConnectionsConfirmActionContext = createContext<ConnectionsConfirmActionContextValue | null>(
  null,
);

const CONFIRM_BUTTON_STYLE = {
  '--button-bg': 'var(--ui-danger)',
  '--button-hover': 'color-mix(in srgb, var(--ui-danger), var(--ui-surface-strong) 18%)',
  '--button-color': 'var(--ui-surface-strong)',
  '--button-bd': '1px solid color-mix(in srgb, var(--ui-danger), transparent 18%)',
} as CSSProperties;

export function ConnectionsConfirmActionProvider({ children }: { children: ReactNode }) {
  const [pendingAction, setPendingAction] = useState<ConfirmationRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const busyRef = useRef(false);

  const close = useCallback(() => {
    if (busyRef.current) return;
    setErrorMessage(null);
    setPendingAction(null);
  }, []);

  const requestConfirmation = useCallback((request: ConfirmationRequest) => {
    setErrorMessage(null);
    setPendingAction(request);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!pendingAction || busyRef.current) return;

    busyRef.current = true;
    setBusy(true);

    try {
      const form = document.getElementById(pendingAction.formId) as HTMLFormElement | null;
      if (!form) {
        setErrorMessage('Unable to find that action. Refresh and try again.');
        return;
      }

      setErrorMessage(null);
      form.requestSubmit();
      setPendingAction(null);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [pendingAction]);

  return (
    <ConnectionsConfirmActionContext.Provider value={requestConfirmation}>
      {children}
      <Modal
        opened={pendingAction !== null}
        onClose={close}
        title={pendingAction?.confirmTitle ?? 'Confirm action'}
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">{pendingAction?.confirmMessage}</Text>
          {errorMessage ? (
            <Text size="sm" role="alert" style={{ color: 'var(--ui-danger)' }}>
              {errorMessage}
            </Text>
          ) : null}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} loading={busy} style={CONFIRM_BUTTON_STYLE}>
              {pendingAction?.confirmLabel ?? 'Confirm'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </ConnectionsConfirmActionContext.Provider>
  );
}

export function ConnectionsConfirmActionButton({
  children,
  confirmLabel = 'Confirm',
  confirmMessage = 'This action cannot be undone. Are you sure?',
  confirmTitle = 'Confirm action',
  formId,
  ...buttonProps
}: ConnectionsConfirmActionButtonProps) {
  const requestConfirmation = useContext(ConnectionsConfirmActionContext);

  if (!requestConfirmation) {
    throw new Error('ConnectionsConfirmActionButton must be used within its provider');
  }

  return (
    <Button
      {...buttonProps}
      onClick={() =>
        requestConfirmation({
          confirmLabel,
          confirmMessage,
          confirmTitle,
          formId,
        })
      }
    >
      {children}
    </Button>
  );
}
