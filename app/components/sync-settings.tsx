'use client';
import { Group, NativeSelect, Stack, Text } from '@mantine/core';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { SettingStatusMessage } from '@/app/components/setting-status-message';
import controlClasses from '@/app/components/settings-controls.module.css';

const INTERVAL_OPTIONS = [
  { value: '10000', label: '10 seconds' },
  { value: '30000', label: '30 seconds' },
  { value: '60000', label: '1 minute' },
  { value: '120000', label: '2 minutes' },
  { value: '300000', label: '5 minutes' },
];

interface SyncSettingsProps {
  defaultValue: string;
}

export function SyncSettings({ defaultValue }: SyncSettingsProps) {
  const initialValue = defaultValue || '60000';
  const [savedInterval, setSavedInterval] = useState(initialValue);
  const [interval, setInterval] = useState(initialValue);
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
    (value: string) => {
      const previousValue = savedInterval;
      setInterval(value);
      startTransition(async () => {
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        setStatus(null);
        try {
          const res = await fetch('/api/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'sync_interval', value }),
          });
          if (res.ok) {
            setSavedInterval(value);
            setStatus({ tone: 'success', message: 'Sync interval saved.' });
            statusTimeoutRef.current = setTimeout(() => {
              setStatus((current) =>
                current?.tone === 'success' && current.message === 'Sync interval saved.'
                  ? null
                  : current,
              );
            }, 2000);
            return;
          }
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setInterval(previousValue);
          setStatus({ tone: 'error', message: body?.error || 'Failed to save sync interval.' });
        } catch {
          setInterval(previousValue);
          setStatus({ tone: 'error', message: 'Failed to save sync interval.' });
        }
      });
    },
    [savedInterval],
  );

  return (
    <Stack gap="sm">
      <Group align="flex-end" gap="sm" wrap="wrap">
        <NativeSelect
          label="Auto-refresh interval"
          description="How often the app checks for new changes from other tabs or API. Lower values use more network requests."
          value={interval}
          onChange={(event) => handleChange(event.currentTarget.value)}
          data={INTERVAL_OPTIONS}
          className={`${controlClasses.field} ${controlClasses.touchInput}`}
          disabled={isPending}
        />
      </Group>
      <div className={controlClasses.statusSlot}>
        {status ? <SettingStatusMessage tone={status.tone} message={status.message} /> : null}
      </div>
      <Text size="xs" c="dimmed">
        When online, the workspace checks for changes from the API and other browser tabs at this
        interval. If the backend cannot be reached, the workspace stays in offline mode until
        connectivity returns.
      </Text>
    </Stack>
  );
}
