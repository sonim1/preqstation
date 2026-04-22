'use client';

import { Group, Stack, Switch, Text } from '@mantine/core';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { SettingStatusMessage } from '@/app/components/setting-status-message';
import controlClasses from '@/app/components/settings-controls.module.css';

type KitchenModeSettingsProps = {
  defaultValue: boolean;
};

export function KitchenModeSettings({ defaultValue }: KitchenModeSettingsProps) {
  const [savedEnabled, setSavedEnabled] = useState(defaultValue);
  const [enabled, setEnabled] = useState(defaultValue);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    },
    [],
  );

  const handleChange = useCallback(
    (value: boolean) => {
      const previousValue = savedEnabled;
      setEnabled(value);
      startTransition(async () => {
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        setStatus(null);
        try {
          const res = await fetch('/api/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'kitchen_mode', value: String(value) }),
          });
          if (res.ok) {
            setSavedEnabled(value);
            setStatus({ tone: 'success', message: 'Kitchen mode updated.' });
            statusTimeoutRef.current = setTimeout(() => {
              setStatus((current) =>
                current?.tone === 'success' && current.message === 'Kitchen mode updated.'
                  ? null
                  : current,
              );
            }, 2000);
            return;
          }
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setEnabled(previousValue);
          setStatus({ tone: 'error', message: body?.error || 'Failed to update kitchen mode.' });
        } catch {
          setEnabled(previousValue);
          setStatus({ tone: 'error', message: 'Failed to update kitchen mode.' });
        }
      });
    },
    [savedEnabled],
  );

  return (
    <Stack gap="sm">
      <Group align="center" gap="sm" wrap="wrap">
        <Switch
          checked={enabled}
          onChange={(event) => handleChange(event.currentTarget.checked)}
          label="Kitchen Mode"
          description="Switch mapped UI copy from PREQSTATION terms to kitchen terminology."
          disabled={isPending}
          size="lg"
          className={controlClasses.touchSwitch}
        />
      </Group>
      <div className={controlClasses.statusSlot}>
        {status ? <SettingStatusMessage tone={status.tone} message={status.message} /> : null}
      </div>
      <Text size="xs" c="dimmed">
        Current PREQSTATION terms stay default. Kitchen Mode updates display copy only: Task -&gt;
        Ticket, Ready -&gt; Pass, Done -&gt; Order Up, Hold -&gt; 86&apos;d.
      </Text>
      <Text size="xs" c="dimmed">
        Routes, API payloads, task keys, and stored statuses remain unchanged.
      </Text>
    </Stack>
  );
}
