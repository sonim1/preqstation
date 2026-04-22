import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/components/terminology-provider', () => ({
  useTerminology: () => ({
    task: {
      singular: 'Task',
      plural: 'Tasks',
      singularLower: 'task',
      pluralLower: 'tasks',
    },
  }),
}));

import * as commandPalette from '@/app/components/command-palette';
import { KITCHEN_TERMINOLOGY } from '@/lib/terminology';

describe('command palette spotlight props', () => {
  it('returns scrollable spotlight props with a safe max height cap', () => {
    expect(commandPalette.getCommandPaletteSpotlightProps).toBeTypeOf('function');

    if (!commandPalette.getCommandPaletteSpotlightProps) {
      return;
    }

    expect(commandPalette.getCommandPaletteSpotlightProps(0)).toEqual({
      maxHeight: 400,
      scrollable: true,
    });
    expect(commandPalette.getCommandPaletteSpotlightProps(600)).toEqual({
      maxHeight: 300,
      scrollable: true,
    });
    expect(commandPalette.getCommandPaletteSpotlightProps(1200)).toEqual({
      maxHeight: 400,
      scrollable: true,
    });
  });
});

describe('command palette task helpers', () => {
  const baseArgs = {
    projectOptions: [{ id: 'project-1', name: 'Alpha', projectKey: 'ALPHA' }],
    dashboardHref: '/dashboard',
    projectsHref: '/projects',
    kanbanHref: '/board',
    settingsHref: '/settings',
    apiKeysHref: '/connections',
  };

  it('builds board task-edit hrefs for task hits', () => {
    expect(commandPalette.buildCommandPaletteTaskHref).toBeTypeOf('function');

    if (!commandPalette.buildCommandPaletteTaskHref) {
      return;
    }

    expect(
      commandPalette.buildCommandPaletteTaskHref({
        projectKey: 'ALPHA',
        taskKey: 'PROJ-12',
      }),
    ).toBe('/board/ALPHA?panel=task-edit&taskId=PROJ-12');
    expect(
      commandPalette.buildCommandPaletteTaskHref({
        projectKey: 'ALPHA',
        taskKey: 'PROJ 12/ä',
      }),
    ).toBe('/board/ALPHA?panel=task-edit&taskId=PROJ%2012%2F%C3%A4');
  });

  it('adds searched task hits as a dedicated Tasks group', () => {
    expect(commandPalette.resolveCommandPaletteActionGroups).toBeTypeOf('function');

    if (!commandPalette.resolveCommandPaletteActionGroups) {
      return;
    }

    const navigate = () => undefined;
    const groups = commandPalette.resolveCommandPaletteActionGroups({
      ...baseArgs,
      query: 'deploy',
      taskSearchState: 'ready' as const,
      terminology: KITCHEN_TERMINOLOGY,
      taskHits: [
        {
          taskId: 'task-1',
          taskKey: 'PROJ-12',
          title: 'Deploy pipeline fix',
          status: 'todo',
          project: {
            id: 'project-1',
            name: 'Alpha',
            projectKey: 'ALPHA',
          },
        },
      ],
      navigate,
    });

    expect(groups).toContainEqual(
      expect.objectContaining({
        group: 'Tickets',
        actions: expect.arrayContaining([
          expect.objectContaining({
            id: 'task-PROJ-12',
            label: 'Deploy pipeline fix',
            description: 'Alpha PROJ-12',
          }),
        ]),
      }),
    );
  });

  it('keeps navigation visible while task search is loading', () => {
    expect(commandPalette.resolveCommandPaletteActionGroups).toBeTypeOf('function');

    if (!commandPalette.resolveCommandPaletteActionGroups) {
      return;
    }

    const navigate = () => undefined;
    const groups = commandPalette.resolveCommandPaletteActionGroups({
      ...baseArgs,
      query: 'deploy',
      taskSearchState: 'loading' as const,
      taskHits: [],
      navigate,
    });

    expect(groups).toContainEqual(expect.objectContaining({ group: 'Navigation' }));
    expect(groups).toContainEqual(
      expect.objectContaining({
        group: 'Tasks',
        actions: [
          expect.objectContaining({ id: 'task-search-loading', label: 'Searching tasks...' }),
        ],
      }),
    );
  });

  it('shows an empty task group when a task search has no matches', () => {
    expect(commandPalette.resolveCommandPaletteActionGroups).toBeTypeOf('function');

    if (!commandPalette.resolveCommandPaletteActionGroups) {
      return;
    }

    const navigate = () => undefined;
    const groups = commandPalette.resolveCommandPaletteActionGroups({
      ...baseArgs,
      query: 'zzz',
      taskSearchState: 'empty' as const,
      terminology: KITCHEN_TERMINOLOGY,
      taskHits: [],
      navigate,
    });

    expect(groups).toContainEqual(
      expect.objectContaining({
        group: 'Tickets',
        actions: [
          expect.objectContaining({ id: 'task-search-empty', label: 'No matching tickets' }),
        ],
      }),
    );
  });

  it('keeps real task hits in the Tasks group without loading placeholders', () => {
    expect(commandPalette.resolveCommandPaletteActionGroups).toBeTypeOf('function');

    if (!commandPalette.resolveCommandPaletteActionGroups) {
      return;
    }

    const navigate = () => undefined;
    const groups = commandPalette.resolveCommandPaletteActionGroups({
      ...baseArgs,
      query: 'deploy',
      taskSearchState: 'ready' as const,
      taskHits: [
        {
          taskId: 'task-1',
          taskKey: 'PROJ-12',
          title: 'Deploy pipeline fix',
          status: 'todo',
          project: {
            id: 'project-1',
            name: 'Alpha',
            projectKey: 'ALPHA',
          },
        },
      ],
      navigate,
    });
    const taskGroup = groups.find((group) => group.group === 'Tasks');

    expect(taskGroup?.actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'task-PROJ-12' })]),
    );
    expect(taskGroup?.actions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'task-search-loading' })]),
    );
    expect(taskGroup?.actions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'task-search-empty' })]),
    );
  });

  it('uses connections wording in the navigation group', () => {
    expect(commandPalette.resolveCommandPaletteActionGroups).toBeTypeOf('function');

    if (!commandPalette.resolveCommandPaletteActionGroups) {
      return;
    }

    const groups = commandPalette.resolveCommandPaletteActionGroups({
      ...baseArgs,
      navigate: () => undefined,
    });
    const navigationGroup = groups.find((group) => group.group === 'Navigation');

    expect(navigationGroup?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'nav-connections',
          label: 'Connections',
          description: 'Manage connections',
        }),
      ]),
    );
    expect(navigationGroup?.actions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'API Keys' })]),
    );
  });
});

describe('command palette trigger', () => {
  it('exposes an explicit accessible name for the icon-only mobile header state', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MantineProvider,
        null,
        React.createElement(commandPalette.CommandPaletteTrigger, { variant: 'compact' }),
      ),
    );

    expect(html).toContain('aria-label="Open search"');
    expect(html).toContain('command-palette-trigger--compact');
    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).not.toContain('Search tasks, pages, projects');
  });
});
