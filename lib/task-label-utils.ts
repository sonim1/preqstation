export type TaskLabelSummary = {
  id: string;
  name: string;
  color?: string | null;
};

type ExtractTaskLabelsParams = {
  labels?: Array<TaskLabelSummary | null | undefined> | null | undefined;
  labelAssignments?:
    | Array<{ label?: TaskLabelSummary | null | undefined } | null | undefined>
    | null
    | undefined;
  label?: TaskLabelSummary | null | undefined;
};

export function normalizeTaskLabelIds(labelIds?: Array<string | null | undefined> | null) {
  const rawValues = labelIds ?? [];

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of rawValues) {
    const trimmed = String(value || '').trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function getTaskLabelIdsFromFormData(formData: FormData, name = 'labelIds') {
  return normalizeTaskLabelIds(formData.getAll(name).map((entry) => String(entry)));
}

export function extractTaskLabels(task: ExtractTaskLabelsParams | null | undefined) {
  if (!task) return [];

  if (Array.isArray(task.labels)) {
    return task.labels.filter((label): label is TaskLabelSummary => Boolean(label));
  }

  if (Array.isArray(task.labelAssignments)) {
    return task.labelAssignments
      .map((assignment) => assignment?.label)
      .filter((label): label is TaskLabelSummary => Boolean(label));
  }

  return task.label ? [task.label] : [];
}

export function summarizeTaskLabelNames(labels: Array<{ name: string }> | null | undefined) {
  if (!labels || labels.length === 0) return 'No labels';
  return labels.map((label) => label.name).join(', ');
}
