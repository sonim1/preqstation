'use client';

import { Text } from '@mantine/core';

import classes from '@/app/components/setting-status-message.module.css';

type SettingStatusMessageProps = {
  tone: 'success' | 'error';
  message: string;
  id?: string;
  className?: string;
};

export function SettingStatusMessage({ tone, message, id, className }: SettingStatusMessageProps) {
  const role = tone === 'error' ? 'alert' : 'status';
  const live = tone === 'error' ? 'assertive' : 'polite';

  return (
    <Text
      id={id}
      role={role}
      aria-live={live}
      aria-atomic="true"
      size="sm"
      fw={500}
      data-tone={tone}
      className={[classes.message, tone === 'success' ? classes.success : classes.error, className]
        .filter(Boolean)
        .join(' ')}
    >
      {message}
    </Text>
  );
}
