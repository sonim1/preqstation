'use client';

import { Alert } from '@mantine/core';
import { IconWifiOff } from '@tabler/icons-react';

import { useOfflineStatus } from './offline-status-provider';

export function OfflineBanner() {
  const { online } = useOfflineStatus();

  if (online) {
    return null;
  }

  return (
    <Alert
      color="yellow"
      variant="light"
      icon={<IconWifiOff size={16} />}
      mb="md"
      data-offline-banner="true"
    >
      You are offline. Recent board snapshots and task drafts are available until the backend can be
      reached again.
    </Alert>
  );
}
