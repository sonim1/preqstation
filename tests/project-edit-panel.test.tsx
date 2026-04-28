// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useAutoSaveMock = vi.hoisted(() => vi.fn());
const notifications = vi.hoisted(() => ({
  showErrorNotification: vi.fn(),
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

vi.mock('@/lib/notifications', () => notifications);

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

    useAutoSaveMock.mockReturnValue({
      markDirty: vi.fn(),
      triggerSave: vi.fn(),
      syncSnapshot: vi.fn(),
      status: 'idle',
      isDirty: false,
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

  it('shows autosave guidance and dirty feedback inside the edit form', () => {
    useAutoSaveMock.mockReturnValue({
      markDirty: vi.fn(),
      triggerSave: vi.fn(),
      syncSnapshot: vi.fn(),
      status: 'idle',
      isDirty: true,
    });

    const html = renderProjectEditPanel({
      id: 'project-1',
      name: 'Project One',
      projectKey: 'PROJ',
      description: 'Updated description',
      status: 'paused',
      priority: 4,
      bgImage: null,
      bgImageCredit: null,
      repoUrl: null,
      vercelUrl: null,
    });

    expect(html).toContain('Autosaves after each change.');
    expect(html).toContain('Unsaved changes.');
  });

  it('passes an async submit callback to autosave and surfaces server-action failures', async () => {
    let capturedSubmit: ((form: HTMLFormElement) => void | Promise<void>) | undefined;
    useAutoSaveMock.mockImplementation(
      (_formRef: React.RefObject<HTMLFormElement | null>, _delay: number, options?: unknown) => {
        capturedSubmit = (
          options as { submit?: (form: HTMLFormElement) => Promise<void> } | undefined
        )?.submit;
        return {
          markDirty: vi.fn(),
          triggerSave: vi.fn(),
          syncSnapshot: vi.fn(),
          status: 'idle',
          isDirty: false,
        };
      },
    );

    const updateProjectAction = vi.fn(async () => ({
      ok: false as const,
      message: 'Failed to update project.',
    }));

    renderToStaticMarkup(
      <MantineProvider>
        <ProjectEditPanel
          selectedProject={{
            id: 'project-1',
            name: 'Project One',
            projectKey: 'PROJ',
            description: null,
            status: 'active',
            priority: 2,
            bgImage: null,
            bgImageCredit: null,
            repoUrl: null,
            vercelUrl: null,
          }}
          updateProjectAction={updateProjectAction}
        />
      </MantineProvider>,
    );

    const form = document.createElement('form');
    form.innerHTML = `
      <input type="hidden" name="projectId" value="project-1" />
      <input type="text" name="name" value="Project One" />
    `;

    expect(capturedSubmit).toBeTypeOf('function');
    await expect(capturedSubmit!(form as HTMLFormElement)).rejects.toThrow(
      'Failed to update project.',
    );
    expect(notifications.showErrorNotification).toHaveBeenCalledWith('Failed to update project.');
    expect(updateProjectAction).toHaveBeenCalledTimes(1);
  });
});
