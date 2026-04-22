import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const formAction = vi.hoisted(() => vi.fn());
const useAutoSaveMock = vi.hoisted(() => vi.fn());
const effectState = vi.hoisted(() => ({
  callIndex: 0,
  depsByIndex: new Map<number, ReadonlyArray<unknown> | undefined>(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useActionState: () => [null, formAction],
    useEffect: (effect: () => void | (() => void), deps?: ReadonlyArray<unknown>) => {
      const index = effectState.callIndex++;
      const previous = effectState.depsByIndex.get(index);
      const changed =
        !deps ||
        !previous ||
        deps.length !== previous.length ||
        deps.some(
          (dependency, dependencyIndex) => !Object.is(dependency, previous[dependencyIndex]),
        );

      effectState.depsByIndex.set(index, deps);
      if (changed) {
        effect();
      }
    },
  };
});

vi.mock('@/app/components/auto-save-indicator', () => ({
  AutoSaveIndicator: () => <div data-testid="auto-save-indicator" />,
}));

vi.mock('@/app/components/live-markdown-editor', () => ({
  LiveMarkdownEditor: () => <div data-testid="live-markdown-editor" />,
}));

vi.mock('@/app/components/project-background-picker', () => ({
  ProjectBackgroundPicker: () => <div data-testid="project-background-picker" />,
}));

vi.mock('@/app/hooks/use-auto-save', () => ({
  useAutoSave: useAutoSaveMock,
}));

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: vi.fn(),
}));

import { ProjectEditPanel } from '@/app/components/panels/project-edit-panel';
import type { ProjectBackgroundCredit } from '@/lib/project-backgrounds';

function renderProjectEditPanel(selectedProject: {
  id: string;
  name: string;
  projectKey: string;
  description: string | null;
  status: string;
  priority: number;
  bgImage: string | null;
  bgImageCredit: ProjectBackgroundCredit | null;
  repoUrl: string | null;
  vercelUrl: string | null;
}) {
  effectState.callIndex = 0;

  return renderToStaticMarkup(
    <MantineProvider>
      <ProjectEditPanel
        selectedProject={selectedProject}
        updateProjectAction={vi.fn(async () => ({ ok: true as const }))}
      />
    </MantineProvider>,
  );
}

describe('app/components/panels/project-edit-panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    effectState.callIndex = 0;
    effectState.depsByIndex.clear();

    useAutoSaveMock.mockReturnValue({
      markDirty: vi.fn(),
      triggerSave: vi.fn(),
      syncSnapshot: vi.fn(),
      status: 'idle',
    });

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('reruns the autosave snapshot when refreshed project data changes without a new project id', () => {
    const syncSnapshot = vi.fn();
    useAutoSaveMock.mockReturnValue({
      markDirty: vi.fn(),
      triggerSave: vi.fn(),
      syncSnapshot,
      status: 'idle',
    });

    renderProjectEditPanel({
      id: 'project-1',
      name: 'Project One',
      projectKey: 'PROJ',
      description: 'Initial description',
      status: 'active',
      priority: 2,
      bgImage: null,
      bgImageCredit: null,
      repoUrl: null,
      vercelUrl: null,
    });

    renderProjectEditPanel({
      id: 'project-1',
      name: 'Project One',
      projectKey: 'PROJ',
      description: 'Updated description',
      status: 'paused',
      priority: 4,
      bgImage: 'mountains',
      bgImageCredit: {
        provider: 'unsplash',
        creatorName: 'Photographer',
        creatorUrl: 'https://example.com/photographer',
        sourceName: 'Unsplash',
        sourceUrl: 'https://example.com/photo',
        license: 'Unsplash License',
        licenseUrl: 'https://example.com/license',
      },
      repoUrl: 'https://github.com/example/project-one',
      vercelUrl: 'https://project-one.vercel.app',
    });

    expect(syncSnapshot).toHaveBeenCalledTimes(2);
  });
});
