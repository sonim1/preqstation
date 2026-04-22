'use client';

import { Group, Text } from '@mantine/core';
import { useViewportSize } from '@mantine/hooks';
import type { SpotlightActionData, SpotlightActionGroupData } from '@mantine/spotlight';
import { Spotlight, spotlight } from '@mantine/spotlight';
import {
  IconDashboard,
  IconFolders,
  IconLayoutKanban,
  IconPlugConnected,
  IconSearch,
  IconSettings,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { showErrorNotification } from '@/lib/notifications';
import { DEFAULT_TERMINOLOGY, type Terminology } from '@/lib/terminology';

import { COMMAND_PALETTE_OPEN_EVENT } from './command-palette-trigger';
import { useTerminology } from './terminology-provider';

export { CommandPaletteTrigger } from './command-palette-trigger';

const COMMAND_PALETTE_MAX_HEIGHT = 400;
const COMMAND_PALETTE_SEARCH_DEBOUNCE_MS = 180;

function fuzzyMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (t.includes(q)) return 2;

  let qi = 0;
  let score = 0;
  let consecutive = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      score += consecutive;
    } else {
      consecutive = 0;
    }
  }

  return qi === q.length ? 1 + score / (q.length * q.length) : 0;
}

type SpotlightActions = SpotlightActionData | SpotlightActionGroupData;

function fuzzyFilter(query: string, actions: SpotlightActions[]): SpotlightActions[] {
  if (!query.trim()) return actions;

  return actions
    .map((action) => {
      if ('actions' in action) {
        const groupAction = action as SpotlightActionGroupData;
        if (!groupAction.actions) return null;
        if (groupAction.actions.some((groupItem) => groupItem.id?.startsWith('task-'))) {
          return groupAction.actions.length > 0 ? groupAction : null;
        }
        const filtered = groupAction.actions
          .map((a: SpotlightActionData) => ({
            action: a,
            score: Math.max(
              fuzzyMatch(query, a.label ?? ''),
              fuzzyMatch(query, a.description ?? '') * 0.8,
            ),
          }))
          .filter((r: { score: number }) => r.score > 0)
          .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

        if (filtered.length === 0) return null;
        return {
          group: groupAction.group,
          actions: filtered.map((r: { action: SpotlightActionData }) => r.action),
        };
      }
      const a = action as SpotlightActionData;
      const score = Math.max(
        fuzzyMatch(query, a.label ?? ''),
        fuzzyMatch(query, a.description ?? '') * 0.8,
      );
      return score > 0 ? action : null;
    })
    .filter(Boolean) as SpotlightActions[];
}

type ProjectOption = { id: string; name: string; projectKey: string };
export type CommandPaletteTaskHit = {
  taskId: string;
  taskKey: string;
  title: string;
  status: string;
  project: {
    id: string;
    name: string;
    projectKey: string;
  } | null;
};

type CommandPaletteTaskSearchState = 'idle' | 'loading' | 'ready' | 'empty';

export type CommandPaletteProps = {
  openOnMount?: boolean;
  projectOptions: ProjectOption[];
  dashboardHref: string;
  projectsHref: string;
  kanbanHref: string;
  settingsHref: string;
  apiKeysHref: string;
};

export function getCommandPaletteSpotlightProps(viewportHeight: number) {
  return {
    maxHeight:
      viewportHeight > 0
        ? Math.min(viewportHeight * 0.5, COMMAND_PALETTE_MAX_HEIGHT)
        : COMMAND_PALETTE_MAX_HEIGHT,
    scrollable: true as const,
  };
}

export function buildCommandPaletteTaskHref({
  projectKey,
  taskKey,
}: {
  projectKey: string;
  taskKey: string;
}) {
  return `/board/${projectKey}?panel=task-edit&taskId=${encodeURIComponent(taskKey)}`;
}

type ResolveCommandPaletteActionGroupsArgs = CommandPaletteProps & {
  query?: string;
  taskHits?: CommandPaletteTaskHit[];
  taskSearchState?: CommandPaletteTaskSearchState;
  terminology?: Terminology;
  navigate: (href: string) => void;
};

function buildCommandPaletteTaskStatusAction({
  id,
  label,
  description,
}: {
  id: string;
  label: string;
  description: string;
}) {
  return {
    id,
    label,
    description,
    disabled: true,
    children: (
      <div className="command-palette-task-action">
        <Text fw={600} size="sm" className="command-palette-task-title">
          {label}
        </Text>
        <Text size="xs" c="dimmed" className="command-palette-task-project">
          {description}
        </Text>
      </div>
    ),
  } satisfies SpotlightActionData;
}

export function resolveCommandPaletteActionGroups({
  projectOptions,
  dashboardHref,
  projectsHref,
  kanbanHref,
  settingsHref,
  apiKeysHref,
  query = '',
  taskHits = [],
  taskSearchState = 'idle',
  terminology = DEFAULT_TERMINOLOGY,
  navigate,
}: ResolveCommandPaletteActionGroupsArgs): SpotlightActionGroupData[] {
  const trimmedQuery = query.trim();
  const taskGroupLabel = terminology.task.plural;
  const taskPluralLower = terminology.task.pluralLower;
  const taskSingularLower = terminology.task.singularLower;
  const taskActions =
    taskSearchState === 'loading'
      ? [
          buildCommandPaletteTaskStatusAction({
            id: 'task-search-loading',
            label: `Searching ${taskPluralLower}...`,
            description: `Fetching matching ${taskPluralLower}`,
          }),
        ]
      : taskSearchState === 'empty' && trimmedQuery
        ? [
            buildCommandPaletteTaskStatusAction({
              id: 'task-search-empty',
              label: `No matching ${taskPluralLower}`,
              description: `Try a different ${taskSingularLower} title or key`,
            }),
          ]
        : taskSearchState === 'ready'
          ? taskHits
              .filter((taskHit) => taskHit.project)
              .map((taskHit) => {
                const project = taskHit.project!;
                return {
                  id: `task-${taskHit.taskKey}`,
                  label: taskHit.title,
                  description: `${project.name} ${taskHit.taskKey}`,
                  leftSection: <IconLayoutKanban size={18} />,
                  keywords: [
                    taskHit.taskKey,
                    project.name,
                    project.projectKey,
                    taskHit.title,
                    taskHit.status,
                  ],
                  onClick: () =>
                    navigate(
                      buildCommandPaletteTaskHref({
                        projectKey: project.projectKey,
                        taskKey: taskHit.taskKey,
                      }),
                    ),
                  children: (
                    <div className="command-palette-task-action">
                      <Text fw={600} size="sm" className="command-palette-task-title">
                        {taskHit.title}
                      </Text>
                      <Group
                        justify="space-between"
                        gap="sm"
                        wrap="nowrap"
                        className="command-palette-task-meta"
                      >
                        <Text size="xs" c="dimmed" className="command-palette-task-project">
                          {project.name}
                        </Text>
                        <Text size="xs" c="dimmed" className="command-palette-task-key">
                          {taskHit.taskKey}
                        </Text>
                      </Group>
                    </div>
                  ),
                } satisfies SpotlightActionData;
              })
          : [];

  const groups: SpotlightActionGroupData[] = [];

  if (taskActions.length > 0) {
    groups.push({
      group: taskGroupLabel,
      actions: taskActions,
    });
  }

  groups.push({
    group: 'Navigation',
    actions: [
      {
        id: 'nav-dashboard',
        label: 'Dashboard',
        description: 'Go to main dashboard',
        leftSection: <IconDashboard size={18} />,
        onClick: () => navigate(dashboardHref),
      },
      {
        id: 'nav-projects',
        label: 'Projects',
        description: 'Project list',
        leftSection: <IconFolders size={18} />,
        onClick: () => navigate(projectsHref),
      },
      {
        id: 'nav-board',
        label: 'Board',
        description: 'Kanban board',
        leftSection: <IconLayoutKanban size={18} />,
        onClick: () => navigate(kanbanHref),
      },
      {
        id: 'nav-settings',
        label: 'Settings',
        description: 'Settings',
        leftSection: <IconSettings size={18} />,
        onClick: () => navigate(settingsHref),
      },
      {
        id: 'nav-connections',
        label: 'Connections',
        description: 'Manage connections',
        leftSection: <IconPlugConnected size={18} />,
        onClick: () => navigate(apiKeysHref),
      },
    ],
  });

  groups.push({
    group: 'Projects',
    actions: projectOptions.map((project) => ({
      id: `project-${project.projectKey}`,
      label: project.name,
      description: project.projectKey,
      leftSection: <IconFolders size={18} />,
      onClick: () => navigate(`/project/${project.projectKey}`),
    })),
  });

  groups.push({
    group: 'Boards',
    actions: projectOptions.map((project) => ({
      id: `board-${project.projectKey}`,
      label: `${project.name} Board`,
      description: `${project.projectKey} kanban board`,
      leftSection: <IconLayoutKanban size={18} />,
      onClick: () => navigate(`/board/${project.projectKey}`),
    })),
  });

  return groups.filter((group) => group.actions.length > 0);
}

export function CommandPalette({
  openOnMount = false,
  projectOptions,
  dashboardHref,
  projectsHref,
  kanbanHref,
  settingsHref,
  apiKeysHref,
}: CommandPaletteProps) {
  const router = useRouter();
  const terminology = useTerminology();
  const { height: vh } = useViewportSize();
  const spotlightProps = getCommandPaletteSpotlightProps(vh);
  const didOpenOnMountRef = useRef(false);
  const [query, setQuery] = useState('');
  const [taskHits, setTaskHits] = useState<CommandPaletteTaskHit[]>([]);
  const [taskSearchState, setTaskSearchState] = useState<CommandPaletteTaskSearchState>('idle');

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      spotlight.close();
    },
    [router],
  );

  const resetTaskSearch = useCallback(() => {
    setQuery('');
    setTaskHits([]);
    setTaskSearchState('idle');
  }, []);

  useEffect(() => {
    const openPalette = () => spotlight.open();

    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, openPalette);
    return () => {
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, openPalette);
    };
  }, []);

  useEffect(() => {
    if (!openOnMount || didOpenOnMountRef.current) return;
    didOpenOnMountRef.current = true;
    spotlight.open();
  }, [openOnMount]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setTaskHits([]);
      setTaskSearchState('idle');
      return;
    }

    const controller = new AbortController();
    setTaskHits([]);
    setTaskSearchState('loading');
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({ q: trimmedQuery });
          const response = await fetch(`/api/todos/search?${params.toString()}`, {
            credentials: 'same-origin',
            signal: controller.signal,
          });

          if (!response.ok) {
            let detail = '';
            try {
              const payload = (await response.json()) as { error?: unknown };
              if (typeof payload.error === 'string') detail = payload.error;
            } catch {
              /* ignore */
            }

            const message = detail
              ? `${terminology.task.singular} search failed (${response.status}): ${detail}`
              : `${terminology.task.singular} search failed (${response.status})`;
            throw new Error(message);
          }

          const payload = (await response.json()) as { results?: CommandPaletteTaskHit[] };
          if (controller.signal.aborted) return;
          const nextTaskHits = payload.results ?? [];
          setTaskHits(nextTaskHits);
          setTaskSearchState(nextTaskHits.length > 0 ? 'ready' : 'empty');
        } catch (error) {
          if (controller.signal.aborted) return;
          setTaskHits([]);
          setTaskSearchState('idle');
          const message =
            error instanceof Error
              ? error.message
              : `${terminology.task.singular} search failed. Please try again.`;
          showErrorNotification(message);
        }
      })();
    }, COMMAND_PALETTE_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, terminology.task.singular]);

  const actions = useMemo(() => {
    return resolveCommandPaletteActionGroups({
      projectOptions,
      dashboardHref,
      projectsHref,
      kanbanHref,
      settingsHref,
      apiKeysHref,
      query,
      taskHits,
      taskSearchState,
      terminology,
      navigate,
    });
  }, [
    projectOptions,
    dashboardHref,
    projectsHref,
    kanbanHref,
    settingsHref,
    apiKeysHref,
    query,
    taskHits,
    taskSearchState,
    terminology,
    navigate,
  ]);

  return (
    <Spotlight
      actions={actions}
      query={query}
      onQueryChange={setQuery}
      onSpotlightClose={resetTaskSearch}
      shortcut={['mod + k']}
      nothingFound="No results"
      searchProps={{
        leftSection: <IconSearch size={18} />,
        placeholder: `Search ${terminology.task.pluralLower}, pages, projects...`,
      }}
      filter={fuzzyFilter}
      highlightQuery
      {...spotlightProps}
    />
  );
}
