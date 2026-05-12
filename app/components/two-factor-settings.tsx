'use client';

import { Badge, Button, Group, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useActionState, useState, useTransition } from 'react';

import type {
  StartTwoFactorSetupResult,
  TwoFactorActionState,
} from '@/app/(workspace)/(main)/settings/two-factor-actions';
import { SettingStatusMessage } from '@/app/components/setting-status-message';
import controlClasses from '@/app/components/settings-controls.module.css';

type TwoFactorSettingsProps = {
  enabled: boolean;
  startAction: () => Promise<StartTwoFactorSetupResult>;
  confirmAction: (
    prevState: TwoFactorActionState | null,
    formData: FormData,
  ) => Promise<TwoFactorActionState>;
  disableAction: (
    prevState: TwoFactorActionState | null,
    formData: FormData,
  ) => Promise<TwoFactorActionState>;
};

type SetupState = {
  otpauthUri: string;
  setupToken: string;
};

export function TwoFactorSettings({
  enabled,
  startAction,
  confirmAction,
  disableAction,
}: TwoFactorSettingsProps) {
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [status, setStatus] = useState<TwoFactorActionState | null>(null);
  const [confirmState, confirmFormAction, isConfirmPending] = useActionState(confirmAction, null);
  const [disableState, disableFormAction, isDisablePending] = useActionState(disableAction, null);
  const [isStartPending, startTransition] = useTransition();
  const visibleStatus = status ?? disableState ?? confirmState;

  function handleStartSetup() {
    startTransition(async () => {
      setStatus(null);
      const result = await startAction();
      if (!result.ok) {
        setStatus(result);
        return;
      }
      setSetup({
        otpauthUri: result.otpauthUri,
        setupToken: result.setupToken,
      });
    });
  }

  return (
    <Stack gap="sm">
      <Group gap="sm" justify="space-between" align="center">
        <Group gap="xs" align="center">
          <Text fw={600}>Authenticator app</Text>
          {enabled ? (
            <Badge color="green" variant="light">
              Enabled
            </Badge>
          ) : null}
        </Group>
      </Group>

      {enabled ? (
        <form action={disableFormAction}>
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Authentication codes are required after owner password sign-in.
            </Text>
            <TextInput
              id="two-factor-disable-code"
              name="totpCode"
              label="Authentication code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
            <Button type="submit" color="red" variant="light" loading={isDisablePending}>
              Disable
            </Button>
          </Stack>
        </form>
      ) : null}

      {!enabled && !setup ? (
        <Button
          type="button"
          className={controlClasses.touchButton}
          loading={isStartPending}
          onClick={handleStartSetup}
        >
          Set up authenticator app
        </Button>
      ) : null}

      {!enabled && setup ? (
        <form action={confirmFormAction}>
          <Stack gap="sm">
            <Textarea label="Setup URI" value={setup.otpauthUri} readOnly minRows={3} />
            <input type="hidden" name="setupToken" value={setup.setupToken} readOnly />
            <TextInput
              id="two-factor-setup-code"
              name="totpCode"
              label="Authentication code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
            <Button type="submit" loading={isConfirmPending}>
              Confirm
            </Button>
          </Stack>
        </form>
      ) : null}

      <div className={controlClasses.statusSlot}>
        {visibleStatus ? (
          <SettingStatusMessage
            tone={visibleStatus.ok ? 'success' : 'error'}
            message={visibleStatus.message}
          />
        ) : null}
      </div>
    </Stack>
  );
}
