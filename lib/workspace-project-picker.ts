export type WorkspaceProjectOption = { id: string; name: string; projectKey: string };

export const LAST_PROJECT_KEY_STORAGE = 'pm:lastProjectKey';
export const RECENT_PROJECTS_STORAGE = 'pm:recentProjects';
const RECENT_PROJECTS_MAX = 3;

const EMPTY_KEYS: string[] = [];
let _cachedRecentRaw: string | null = null;
let _cachedRecentKeys: string[] = EMPTY_KEYS;

export function readRecentProjectKeys(): string[] {
  if (typeof window === 'undefined') return EMPTY_KEYS;
  try {
    const value = window.localStorage.getItem(RECENT_PROJECTS_STORAGE);
    if (!value) return EMPTY_KEYS;
    if (value === _cachedRecentRaw) return _cachedRecentKeys;
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return EMPTY_KEYS;
    _cachedRecentRaw = value;
    _cachedRecentKeys = parsed.filter((k): k is string => typeof k === 'string');
    return _cachedRecentKeys;
  } catch {
    return EMPTY_KEYS;
  }
}

export function pushRecentProjectKey(projectKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = readRecentProjectKeys();
    const next = [
      projectKey,
      ...current.filter((k) => k.toUpperCase() !== projectKey.toUpperCase()),
    ].slice(0, RECENT_PROJECTS_MAX);
    window.localStorage.setItem(RECENT_PROJECTS_STORAGE, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
}

export function extractProjectKeyFromPath(pathname: string): string | null {
  const boardMatch = pathname.match(/^\/board\/([^/]+)/);
  if (boardMatch) return boardMatch[1];
  const projectMatch = pathname.match(/^\/project\/([^/]+)/);
  if (projectMatch) return projectMatch[1];
  return null;
}

export function findProjectByKey(
  projectOptions: WorkspaceProjectOption[],
  projectKey: string | null | undefined,
) {
  const normalized = (projectKey || '').trim();
  if (!normalized) return null;
  return (
    projectOptions.find(
      (project) => project.projectKey.toUpperCase() === normalized.toUpperCase(),
    ) || null
  );
}

export function resolvePickerProject(params: {
  pathname: string;
  rememberedProjectKey: string | null;
  projectOptions: WorkspaceProjectOption[];
}) {
  const pathProjectKey = extractProjectKeyFromPath(params.pathname);
  const fromPath = findProjectByKey(params.projectOptions, pathProjectKey);
  if (fromPath) return { project: fromPath, source: 'path' as const };

  const fromMemory = findProjectByKey(params.projectOptions, params.rememberedProjectKey);
  if (fromMemory) return { project: fromMemory, source: 'memory' as const };

  return { project: null, source: 'none' as const };
}

export function getProjectSelectHref(pathname: string, projectKey: string | null) {
  void pathname;
  if (!projectKey) return '/board';
  return `/board/${projectKey}`;
}

export function getWorkspaceProjectSubtitle(project: WorkspaceProjectOption | null) {
  if (!project) return 'AI Command Center';
  return `Current project: ${project.name}`;
}
