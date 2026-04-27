export type ProjectLabelOption = {
  id: string;
  name: string;
  color: string | null;
};

type FetchLike = (
  input: string,
  init?: {
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    credentials?: 'same-origin';
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

type CreateProjectLabelParams = {
  projectId: string;
  name: string;
  color: string;
  fetchImpl?: FetchLike;
};

type ProjectLabelsPayload = {
  labels?: ProjectLabelOption[];
  label?: ProjectLabelOption;
  error?: unknown;
};

function normalizeLabelName(name: string) {
  return name.trim().toLocaleLowerCase();
}

async function readPayload(response: Awaited<ReturnType<FetchLike>>) {
  try {
    return (await response.json()) as ProjectLabelsPayload;
  } catch {
    return {};
  }
}

async function readResponseError(
  response: Awaited<ReturnType<FetchLike>>,
  fallbackMessage: string,
) {
  const payload = await readPayload(response);
  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  return fallbackMessage;
}

export function sortProjectLabelOptions<T extends { name: string }>(labels: T[]) {
  return [...labels].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  );
}

export function upsertProjectLabelOptions<T extends { id: string; name: string }>(
  labels: T[],
  label: T,
) {
  const nextLabels = labels.filter((entry) => entry.id !== label.id);
  nextLabels.push(label);
  return sortProjectLabelOptions(nextLabels);
}

export async function listProjectLabelOptions(
  projectId: string,
  fetchImpl: FetchLike = fetch,
): Promise<ProjectLabelOption[]> {
  const response = await fetchImpl(`/api/projects/${encodeURIComponent(projectId)}/labels`, {
    method: 'GET',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error(await readResponseError(response, 'Failed to load labels.'));
  }

  const payload = await readPayload(response);
  return Array.isArray(payload.labels) ? payload.labels : [];
}

export async function createProjectLabelWithRecovery({
  projectId,
  name,
  color,
  fetchImpl = fetch,
}: CreateProjectLabelParams): Promise<{
  label: ProjectLabelOption;
  syncedLabels?: ProjectLabelOption[];
}> {
  const response = await fetchImpl(`/api/projects/${encodeURIComponent(projectId)}/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ name, color }),
  });

  if (response.ok) {
    const payload = await readPayload(response);
    if (!payload.label) {
      throw new Error('Label created, but the response was missing the label payload.');
    }

    return { label: payload.label };
  }

  if (response.status === 409) {
    const syncedLabels = await listProjectLabelOptions(projectId, fetchImpl);
    const matchedLabel = syncedLabels.find(
      (label) => normalizeLabelName(label.name) === normalizeLabelName(name),
    );

    if (!matchedLabel) {
      throw new Error('Label already exists, but it could not be recovered from the project list.');
    }

    return {
      label: matchedLabel,
      syncedLabels,
    };
  }

  throw new Error(await readResponseError(response, 'Failed to create label.'));
}
