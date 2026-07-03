import { loadProjectMap, resolveProjectEntry } from '@/lib/cli/project-resolve';

export function buildContextFiles(projectKey: string, projectMapPath?: string) {
  const entry = resolveProjectEntry(projectKey, loadProjectMap(projectMapPath));
  return {
    project_key: projectKey,
    repo_root: entry?.repo_root ?? null,
    files: entry?.files ?? [],
  };
}

export function buildContextDoctor(projectKey: string, projectMapPath?: string) {
  const entry = resolveProjectEntry(projectKey, loadProjectMap(projectMapPath));
  return {
    project_key: projectKey,
    status: entry ? 'ok' : 'missing_project_map_entry',
    repo_root: entry?.repo_root ?? null,
  };
}
