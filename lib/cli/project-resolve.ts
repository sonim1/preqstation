import { readFileSync } from 'node:fs';

export type ProjectMapEntry = {
  project_key: string;
  repo_root?: string;
  files?: string[];
};

export function loadProjectMap(path: string | undefined) {
  if (!path) return [];
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
    projects?: ProjectMapEntry[];
  };
  return parsed.projects ?? [];
}

export function resolveProjectEntry(projectKey: string, entries: ProjectMapEntry[]) {
  const normalized = projectKey.trim().toUpperCase();
  return entries.find((entry) => entry.project_key.toUpperCase() === normalized) ?? null;
}
