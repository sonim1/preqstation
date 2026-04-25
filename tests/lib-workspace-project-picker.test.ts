import { describe, expect, it } from 'vitest';

import {
  extractProjectKeyFromPath,
  findProjectByKey,
  getProjectSelectHref,
  getWorkspaceProjectSubtitle,
  resolvePickerProject,
  type WorkspaceProjectOption,
} from '@/lib/workspace-project-picker';

const projectOptions: WorkspaceProjectOption[] = [
  { id: 'p1', name: 'Project One', projectKey: 'PROJ', status: 'active' },
  { id: 'p2', name: 'App Two', projectKey: 'APP', status: 'paused' },
  { id: 'p3', name: 'Done Three', projectKey: 'DONE', status: 'done' },
];

describe('lib/workspace-project-picker', () => {
  it('extractProjectKeyFromPath supports board and project routes', () => {
    expect(extractProjectKeyFromPath('/board/PROJ')).toBe('PROJ');
    expect(extractProjectKeyFromPath('/project/APP')).toBe('APP');
    expect(extractProjectKeyFromPath('/settings')).toBeNull();
  });

  it('findProjectByKey matches project key case-insensitively', () => {
    expect(findProjectByKey(projectOptions, 'proj')?.id).toBe('p1');
    expect(findProjectByKey(projectOptions, ' APP ')?.id).toBe('p2');
    expect(findProjectByKey(projectOptions, 'MISSING')).toBeNull();
  });

  it('resolvePickerProject prioritizes path scope over remembered scope', () => {
    const resolved = resolvePickerProject({
      pathname: '/board/PROJ',
      rememberedProjectKey: 'APP',
      projectOptions,
    });

    expect(resolved.source).toBe('path');
    expect(resolved.project?.projectKey).toBe('PROJ');
  });

  it('resolvePickerProject falls back to remembered project on global routes', () => {
    const resolved = resolvePickerProject({
      pathname: '/connections',
      rememberedProjectKey: 'done',
      projectOptions,
    });

    expect(resolved.source).toBe('memory');
    expect(resolved.project?.projectKey).toBe('DONE');
  });

  it('resolvePickerProject ignores remembered paused boards on global routes', () => {
    const resolved = resolvePickerProject({
      pathname: '/connections',
      rememberedProjectKey: 'app',
      projectOptions,
    });

    expect(resolved.source).toBe('none');
    expect(resolved.project).toBeNull();
  });

  it('resolvePickerProject returns none when remembered key is invalid', () => {
    const resolved = resolvePickerProject({
      pathname: '/dashboard',
      rememberedProjectKey: 'UNKNOWN',
      projectOptions,
    });

    expect(resolved.source).toBe('none');
    expect(resolved.project).toBeNull();
  });

  it('getProjectSelectHref routes project selections to board destinations', () => {
    expect(getProjectSelectHref('/board', 'PROJ')).toBe('/board/PROJ');
    expect(getProjectSelectHref('/project/APP', 'PROJ')).toBe('/board/PROJ');
    expect(getProjectSelectHref('/projects', 'PROJ')).toBe('/board/PROJ');
    expect(getProjectSelectHref('/dashboard', 'PROJ')).toBe('/board/PROJ');
    expect(getProjectSelectHref('/settings', 'PROJ')).toBe('/board/PROJ');
    expect(getProjectSelectHref('/connections', 'PROJ')).toBe('/board/PROJ');
    expect(getProjectSelectHref('/settings', null)).toBe('/board');
  });

  it('getWorkspaceProjectSubtitle returns current project label when selected', () => {
    expect(getWorkspaceProjectSubtitle(projectOptions[0])).toBe('Current project: Project One');
  });

  it('getWorkspaceProjectSubtitle falls back to default subtitle', () => {
    expect(getWorkspaceProjectSubtitle(null)).toBe('AI Command Center');
  });
});
