import { ACTIVE_PROJECT_STATUS } from '@/lib/project-meta';

export type ProjectActivityStatus = 'inactive' | 'healthy' | 'warning' | 'critical';

export const PROJECT_ACTIVITY_STATUS_META: Record<
  ProjectActivityStatus,
  { color: string; label: string }
> = {
  inactive: {
    color: 'var(--mantine-color-gray-5)',
    label: 'Inactive - no recent work logs',
  },
  healthy: {
    color: 'var(--mantine-color-green-5)',
    label: 'Updated within 3 days',
  },
  warning: {
    color: 'var(--mantine-color-yellow-5)',
    label: 'Updated within 7 days',
  },
  critical: {
    color: 'var(--mantine-color-red-5)',
    label: 'No work log update in over 7 days',
  },
};

export function getProjectActivityStatus(params: {
  projectStatus: string;
  lastWorkedAt: Date | string | null;
  now?: Date;
}) {
  if (params.projectStatus !== ACTIVE_PROJECT_STATUS || !params.lastWorkedAt) {
    return {
      status: 'inactive' as const,
      ...PROJECT_ACTIVITY_STATUS_META.inactive,
    };
  }

  const now = params.now ?? new Date();
  const lastWorkedAt =
    params.lastWorkedAt instanceof Date ? params.lastWorkedAt : new Date(params.lastWorkedAt);

  if (Number.isNaN(lastWorkedAt.getTime())) {
    return {
      status: 'inactive' as const,
      ...PROJECT_ACTIVITY_STATUS_META.inactive,
    };
  }

  const ageDays = (now.getTime() - lastWorkedAt.getTime()) / 86400000;

  if (ageDays <= 3) {
    return {
      status: 'healthy' as const,
      ...PROJECT_ACTIVITY_STATUS_META.healthy,
    };
  }

  if (ageDays <= 7) {
    return {
      status: 'warning' as const,
      ...PROJECT_ACTIVITY_STATUS_META.warning,
    };
  }

  return {
    status: 'critical' as const,
    ...PROJECT_ACTIVITY_STATUS_META.critical,
  };
}
