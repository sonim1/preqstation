// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useAutoSaveMock = vi.hoisted(() => vi.fn());
const useOfflineStatusMock = vi.hoisted(() => vi.fn());
const notifications = vi.hoisted(() => ({
  showErrorNotification: vi.fn(),
}));

vi.mock('@/app/components/live-markdown-editor', () => ({
  LiveMarkdownEditor: () => <div data-testid="live-markdown-editor" />,
}));

vi.mock('@/app/components/project-background-picker', () => ({
  ProjectBackgroundPicker: () => <div data-testid="project-background-picker" />,
}));

vi.mock('@/app/components/panels/agent-instructions-panel', () => ({
  AgentInstructionsPanel: ({ value }: { value?: string | null }) => (
    <div data-testid="agent-instructions-panel" data-agent-instructions={value ?? ''} />
  ),
}));

vi.mock('@/app/components/panels/deploy-settings-panel', () => ({
  DeploySettingsPanel: ({
    projects,
  }: {
    projects: Array<{ deployStrategy: { strategy: string; default_branch: string } }>;
  }) => (
    <div
      data-testid="deploy-settings-panel"
      data-deploy-strategy={projects[0]?.deployStrategy.strategy ?? ''}
      data-default-branch={projects[0]?.deployStrategy.default_branch ?? ''}
    />
  ),
}));

vi.mock('@/app/components/panels/project-labels-panel', () => ({
  ProjectLabelsPanel: ({
    labels,
  }: {
    labels: Array<{ id: string; name: string; color: string; usageCount: number }>;
  }) => (
    <div
      data-testid="project-labels-panel"
      data-label-names={labels.map((label) => label.name).join(',')}
    />
  ),
}));

vi.mock('@/app/hooks/use-auto-save', () => ({
  useAutoSave: useAutoSaveMock,
}));

vi.mock('@/app/components/offline-status-provider', () => ({
  useOfflineStatus: () => useOfflineStatusMock(),
}));

vi.mock('@/lib/notifications', () => notifications);

import { ProjectEditPanel } from '@/app/components/panels/project-edit-panel';
import { TerminologyProvider } from '@/app/components/terminology-provider';
import type { ProjectBackgroundCredit } from '@/lib/project-backgrounds';
import {
  DEFAULT_TERMINOLOGY,
  getProjectEditTerminology,
  type Terminology,
} from '@/lib/terminology';

type RenderProjectEditPanelOptions = {
  labelManagement?: React.ComponentProps<typeof ProjectEditPanel>['labelManagement'];
  createLabelAction?: React.ComponentProps<typeof ProjectEditPanel>['createLabelAction'];
  updateLabelAction?: React.ComponentProps<typeof ProjectEditPanel>['updateLabelAction'];
  deleteLabelAction?: React.ComponentProps<typeof ProjectEditPanel>['deleteLabelAction'];
  configurationManagement?: React.ComponentProps<
    typeof ProjectEditPanel
  >['configurationManagement'];
  updateAgentInstructionsAction?: React.ComponentProps<
    typeof ProjectEditPanel
  >['updateAgentInstructionsAction'];
  updateDeploySettingsAction?: React.ComponentProps<
    typeof ProjectEditPanel
  >['updateDeploySettingsAction'];
  terminology?: Terminology;
};

function renderProjectEditPanel(
  selectedProject: {
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
  },
  options: RenderProjectEditPanelOptions = {},
) {
  return renderToStaticMarkup(
    <MantineProvider>
      <TerminologyProvider terminology={options.terminology ?? DEFAULT_TERMINOLOGY}>
        <ProjectEditPanel
          selectedProject={selectedProject}
          updateProjectAction={vi.fn(async () => ({ ok: true as const }))}
          labelManagement={options.labelManagement}
          createLabelAction={options.createLabelAction}
          updateLabelAction={options.updateLabelAction}
          deleteLabelAction={options.deleteLabelAction}
          configurationManagement={options.configurationManagement}
          updateAgentInstructionsAction={options.updateAgentInstructionsAction}
          updateDeploySettingsAction={options.updateDeploySettingsAction}
        />
      </TerminologyProvider>
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
    useOfflineStatusMock.mockReturnValue({ online: true });

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

  it('renders project label management outside the autosave project form when provided', () => {
    const noopLabelAction = vi.fn(async () => ({ ok: true as const }));
    const html = renderProjectEditPanel(
      {
        id: 'project-1',
        name: 'Project One',
        projectKey: 'PROJ',
        description: 'Updated description',
        status: 'active',
        priority: 3,
        bgImage: null,
        bgImageCredit: null,
        repoUrl: null,
        vercelUrl: null,
      },
      {
        labelManagement: {
          labels: [{ id: 'label-1', name: 'Bug', color: 'red', usageCount: 2 }],
          taskSingularLower: 'task',
          taskPluralLower: 'tasks',
        },
        createLabelAction: noopLabelAction,
        updateLabelAction: noopLabelAction,
        deleteLabelAction: noopLabelAction,
        terminology: {
          ...DEFAULT_TERMINOLOGY,
          projectEdit: {
            ...getProjectEditTerminology(DEFAULT_TERMINOLOGY),
            labelsTitle: 'Tags',
          },
        },
      },
    );

    expect(html).toContain('data-project-edit-label-management="true"');
    expect(html).toContain('Tags');
    expect(html).not.toContain('<h4 class="">Labels</h4>');
    expect(html).toContain('data-testid="project-labels-panel"');
    expect(html).toContain('data-label-names="Bug"');
    expect(html.indexOf('</form>')).toBeLessThan(
      html.indexOf('data-project-edit-label-management="true"'),
    );
  });

  it('renders project configuration management outside the autosave project form when provided', () => {
    const noopSettingsAction = vi.fn(async () => ({ ok: true as const }));
    const html = renderProjectEditPanel(
      {
        id: 'project-1',
        name: 'Project One',
        projectKey: 'PROJ',
        description: 'Updated description',
        status: 'active',
        priority: 3,
        bgImage: null,
        bgImageCredit: null,
        repoUrl: null,
        vercelUrl: null,
      },
      {
        configurationManagement: {
          projectId: 'project-1',
          projectName: 'Project One',
          agentInstructions: 'Keep it sharp.',
          deployStrategy: {
            strategy: 'feature_branch',
            default_branch: 'main',
            auto_pr: true,
            commit_on_review: true,
            squash_merge: false,
          },
        },
        updateAgentInstructionsAction: noopSettingsAction,
        updateDeploySettingsAction: noopSettingsAction,
      },
    );

    expect(html).toContain('data-project-edit-configuration-management="true"');
    expect(html).toContain('data-testid="agent-instructions-panel"');
    expect(html).toContain('data-agent-instructions="Keep it sharp."');
    expect(html).toContain('data-testid="deploy-settings-panel"');
    expect(html).toContain('data-deploy-strategy="feature_branch"');
    expect(html.indexOf('</form>')).toBeLessThan(
      html.indexOf('data-project-edit-configuration-management="true"'),
    );
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

  it('does not call the project update server action while offline', async () => {
    let capturedSubmit: ((form: HTMLFormElement) => void | Promise<void>) | undefined;
    useOfflineStatusMock.mockReturnValue({ online: false });
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
    const updateProjectAction = vi.fn(async () => ({ ok: true as const }));

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

    await expect(capturedSubmit!(form as HTMLFormElement)).rejects.toThrow(
      'Project edits are available after reconnecting.',
    );
    expect(updateProjectAction).not.toHaveBeenCalled();
    expect(notifications.showErrorNotification).toHaveBeenCalledWith(
      'Project edits are available after reconnecting.',
    );
  });
});
