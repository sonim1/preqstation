export const PROJECT_STATUSES = ['active', 'paused', 'done'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const [ACTIVE_PROJECT_STATUS, PAUSED_PROJECT_STATUS, DONE_PROJECT_STATUS] = PROJECT_STATUSES;
export const DEFAULT_PROJECT_STATUS: ProjectStatus = ACTIVE_PROJECT_STATUS;

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  done: 'Done',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  [ACTIVE_PROJECT_STATUS]: 'green',
  [PAUSED_PROJECT_STATUS]: 'orange',
  [DONE_PROJECT_STATUS]: 'indigo',
};

export function isProjectStatus(value: string | null | undefined): value is ProjectStatus {
  const normalized = (value || '').trim();
  return PROJECT_STATUSES.includes(normalized as ProjectStatus);
}

export function projectStatusOptionData() {
  return PROJECT_STATUSES.map((status) => ({
    value: status,
    label: PROJECT_STATUS_LABELS[status],
  }));
}
