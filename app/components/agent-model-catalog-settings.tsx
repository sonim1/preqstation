'use client';

import { Button, Group, Stack, Textarea } from '@mantine/core';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { SettingStatusMessage } from '@/app/components/setting-status-message';
import controlClasses from '@/app/components/settings-controls.module.css';
import { type AgentModelCatalog, serializeAgentModelCatalog } from '@/lib/agent-model-catalog';

type AgentModelCatalogSettingsProps = {
  defaultValue: AgentModelCatalog;
};

export function AgentModelCatalogSettings({ defaultValue }: AgentModelCatalogSettingsProps) {
  const initialValue = useMemo(() => serializeAgentModelCatalog(defaultValue), [defaultValue]);
  const [savedValue, setSavedValue] = useState(initialValue);
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSavedValue(initialValue);
    setValue(initialValue);
  }, [initialValue]);

  useEffect(
    () => () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    },
    [],
  );

  function saveCatalog() {
    const nextValue = value.trim();

    startTransition(async () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
      setStatus(null);

      try {
        const response = await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'agent_model_catalog', value: nextValue }),
        });
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (!response.ok) {
          setStatus({ tone: 'error', message: body?.error || 'Failed to save model catalog.' });
          return;
        }

        setSavedValue(nextValue);
        setValue(nextValue);
        setStatus({ tone: 'success', message: 'Model catalog saved.' });
        statusTimeoutRef.current = setTimeout(() => {
          setStatus((current) =>
            current?.tone === 'success' && current.message === 'Model catalog saved.'
              ? null
              : current,
          );
        }, 2000);
      } catch {
        setStatus({ tone: 'error', message: 'Failed to save model catalog.' });
      }
    });
  }

  return (
    <Stack gap="sm">
      <Textarea
        aria-label="Agent model catalog"
        label="Model catalog JSON"
        autosize
        minRows={8}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        disabled={isPending}
        className={`${controlClasses.fieldWide} ${controlClasses.touchInput}`}
      />
      <Group align="center" gap="sm" wrap="wrap" className={controlClasses.buttonGroup}>
        <Button
          type="button"
          onClick={saveCatalog}
          disabled={isPending || value.trim() === savedValue}
          className={controlClasses.touchButton}
        >
          Save model catalog
        </Button>
      </Group>
      <div className={controlClasses.statusSlot}>
        {status ? <SettingStatusMessage tone={status.tone} message={status.message} /> : null}
      </div>
    </Stack>
  );
}
