'use client';

import { Button, Group, Select, Stack, Text } from '@mantine/core';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { SettingStatusMessage } from '@/app/components/setting-status-message';
import controlClasses from '@/app/components/settings-controls.module.css';
import { resolveDisplayTimeZone } from '@/lib/date-time';

function getTimeZoneOptions(defaultValue: string) {
  const fallbackValue = resolveDisplayTimeZone(defaultValue);
  const supportedValues =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : null;
  const values = supportedValues ? [...supportedValues] : [fallbackValue];

  if (fallbackValue && !values.includes(fallbackValue)) {
    values.unshift(fallbackValue);
  }

  return values.map((value) => ({ value, label: value }));
}

export function TimezoneSettings({ defaultValue }: { defaultValue: string }) {
  const initialValue = resolveDisplayTimeZone(defaultValue);
  const [savedValue, setSavedValue] = useState(initialValue);
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const options = useMemo(() => getTimeZoneOptions(defaultValue), [defaultValue]);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    },
    [],
  );

  function saveTimezone() {
    const nextValue = value;
    const previousValue = savedValue;
    startTransition(async () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
      setStatus(null);
      try {
        const response = await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'timezone', value: nextValue }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setValue(previousValue);
          setStatus({ tone: 'error', message: body?.error || 'Failed to save timezone.' });
          return;
        }

        setSavedValue(nextValue);
        setStatus({ tone: 'success', message: 'Timezone saved.' });
        statusTimeoutRef.current = setTimeout(() => {
          setStatus((current) =>
            current?.tone === 'success' && current.message === 'Timezone saved.' ? null : current,
          );
        }, 2000);
      } catch {
        setValue(previousValue);
        setStatus({ tone: 'error', message: 'Failed to save timezone.' });
      }
    });
  }

  return (
    <Stack gap="sm">
      <Group align="flex-end" gap="sm" wrap="wrap">
        <Select
          aria-label="Timezone"
          label="Timezone"
          description="Search for an IANA timezone and save it for workspace dates and timestamps."
          data={options}
          value={value}
          onChange={(nextValue) => setValue(nextValue ?? savedValue)}
          searchable
          placeholder="Search timezones"
          className={`${controlClasses.fieldWide} ${controlClasses.touchInput}`}
          disabled={isPending}
        />
        <Button
          onClick={saveTimezone}
          disabled={isPending || !value}
          className={controlClasses.touchButton}
        >
          Save timezone
        </Button>
      </Group>
      <div className={controlClasses.statusSlot}>
        {status ? <SettingStatusMessage tone={status.tone} message={status.message} /> : null}
      </div>
      <Text size="xs" c="dimmed">
        Date-only labels render as yyyy-mm-dd, and timestamps follow this saved timezone.
      </Text>
    </Stack>
  );
}
