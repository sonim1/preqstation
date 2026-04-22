'use client';

import { notifications } from '@mantine/notifications';

type TaskCompletionNotification = {
  taskKey: string;
  taskTitle: string;
  statusTo: string;
};

export function showErrorNotification(message: string) {
  notifications.show({
    title: 'Error',
    message,
    color: 'red',
    autoClose: 5000,
  });
}

export function showSuccessNotification(message: string) {
  notifications.show({
    title: 'Done',
    message,
    color: 'green',
    autoClose: 3000,
  });
}

export function showTaskCompletionNotification(notification: TaskCompletionNotification) {
  const statusLabel =
    notification.statusTo === 'done'
      ? 'Done'
      : notification.statusTo === 'ready'
        ? 'Ready'
        : notification.statusTo;

  notifications.show({
    title: `${notification.taskKey} moved to ${statusLabel}`,
    message: notification.taskTitle,
    color: statusLabel === 'Done' ? 'green' : 'orange',
    autoClose: 4000,
  });
}
