// @vitest-environment jsdom

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandPalette, type CommandPaletteTaskHit } from '@/app/components/command-palette';

type SpotlightPropsSnapshot = {
  actions: Array<{
    actions?: Array<{ description?: string; label?: string }>;
    group?: string;
  }>;
  onQueryChange: (query: string) => void;
};

const searchOfflineTaskSnapshotsMock = vi.hoisted(() => vi.fn());
const showErrorNotificationMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());
const spotlightState = vi.hoisted(() => ({
  close: vi.fn(),
  open: vi.fn(),
  props: null as SpotlightPropsSnapshot | null,
}));

vi.mock('@mantine/hooks', () => ({
  useViewportSize: () => ({ height: 800 }),
}));

vi.mock('@mantine/spotlight', () => ({
  Spotlight: (props: SpotlightPropsSnapshot) => {
    spotlightState.props = props;
    return null;
  },
  spotlight: {
    close: spotlightState.close,
    open: spotlightState.open,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

vi.mock('@/lib/offline/task-search', () => ({
  searchOfflineTaskSnapshots: searchOfflineTaskSnapshotsMock,
}));

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: showErrorNotificationMock,
}));

vi.mock('@/app/components/terminology-provider', () => ({
  useTerminology: () => ({
    task: {
      plural: 'Tasks',
      pluralLower: 'tasks',
      singular: 'Task',
      singularLower: 'task',
    },
  }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function hit(taskKey: string, title: string): CommandPaletteTaskHit {
  return {
    taskId: `task:${taskKey}`,
    taskKey,
    title,
    status: 'todo',
    project: { id: 'project-1', name: 'Alpha', projectKey: 'ALPHA' },
  };
}

function actionText() {
  return (
    spotlightState.props?.actions
      .flatMap((group) => group.actions ?? [])
      .map((action) => `${action.label ?? ''} ${action.description ?? ''}`)
      .join(' ') ?? ''
  );
}

describe('app/components/command-palette async search', () => {
  beforeEach(() => {
    searchOfflineTaskSnapshotsMock.mockReset();
    showErrorNotificationMock.mockReset();
    routerPushMock.mockReset();
    spotlightState.close.mockReset();
    spotlightState.open.mockReset();
    spotlightState.props = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not publish stale local results when a failed server search is aborted mid-fallback', async () => {
    vi.useFakeTimers();
    const staleLocalSearch = deferred<CommandPaletteTaskHit[]>();
    const nextLocalSearch = deferred<CommandPaletteTaskHit[]>();
    const fetchMock = vi.fn().mockRejectedValue(new Error('server unavailable'));

    searchOfflineTaskSnapshotsMock
      .mockReturnValueOnce(staleLocalSearch.promise)
      .mockReturnValueOnce(nextLocalSearch.promise);
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CommandPalette
        projectOptions={[]}
        dashboardHref="/dashboard"
        projectsHref="/projects"
        kanbanHref="/board"
        settingsHref="/settings"
        apiKeysHref="/connections"
      />,
    );

    await act(async () => {
      spotlightState.props?.onQueryChange('stale');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      spotlightState.props?.onQueryChange('fresh');
    });
    await act(async () => {
      staleLocalSearch.resolve([hit('ALPHA-1', 'Stale result')]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(actionText()).not.toContain('Stale result');
    expect(showErrorNotificationMock).not.toHaveBeenCalled();
  });
});
