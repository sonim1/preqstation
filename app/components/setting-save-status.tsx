import { Group, Loader, Stack, Text } from '@mantine/core';

import controlClasses from '@/app/components/settings-controls.module.css';

import { SettingStatusMessage } from './setting-status-message';

export type SettingSaveMode = 'autosave' | 'manual';
export type SettingSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

type SettingSaveStatusProps = {
  mode: SettingSaveMode;
  state: SettingSaveState;
  errorMessage?: string | null;
  id?: string;
  dirtyMessage?: string;
  showModeHint?: boolean;
};

const MODE_HINTS: Record<SettingSaveMode, string> = {
  autosave: 'Autosaves after each change.',
  manual: 'Changes stay local until you save.',
};

export function SettingSaveStatus({
  mode,
  state,
  errorMessage,
  id,
  dirtyMessage = 'Unsaved changes.',
  showModeHint = true,
}: SettingSaveStatusProps) {
  return (
    <Stack gap={4}>
      {showModeHint ? (
        <Text size="sm" c="dimmed">
          {MODE_HINTS[mode]}
        </Text>
      ) : null}
      <div className={controlClasses.statusSlot}>
        {state === 'dirty' ? (
          <Text id={id} role="status" aria-live="polite" aria-atomic="true" size="sm" c="dimmed">
            {dirtyMessage}
          </Text>
        ) : null}
        {state === 'saving' ? (
          <Group id={id} gap={6} role="status" aria-live="polite" aria-atomic="true">
            <Loader size={14} />
            <Text size="sm" c="dimmed">
              Saving...
            </Text>
          </Group>
        ) : null}
        {state === 'saved' ? (
          <SettingStatusMessage id={id} tone="success" message="Saved." />
        ) : null}
        {state === 'error' ? (
          <SettingStatusMessage
            id={id}
            tone="error"
            message={errorMessage || 'Failed to save changes.'}
          />
        ) : null}
      </div>
    </Stack>
  );
}
