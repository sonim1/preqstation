// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({
  currentHref: '/project/PQST',
  push: vi.fn((href: string) => {
    navigation.currentHref = href;
  }),
  replace: vi.fn((href: string) => {
    navigation.currentHref = href;
  }),
}));

vi.mock('@/app/components/project-edit-modal', () => ({
  ProjectEditModal: ({ opened, onClose }: { opened?: boolean; onClose?: () => void }) =>
    opened ? (
      <div data-testid="project-edit-modal">
        <button onClick={onClose} type="button">
          Close panel
        </button>
      </div>
    ) : null,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.currentHref.split('?')[0],
  useRouter: () => ({
    push: navigation.push,
    replace: navigation.replace,
  }),
  useSearchParams: () => new URLSearchParams(navigation.currentHref.split('?')[1] ?? ''),
}));

import {
  ProjectDetailEditPanelButton,
  ProjectDetailEditPanelProvider,
} from '@/app/(workspace)/(main)/project/[key]/project-detail-edit-panel';

const selectedProject = {
  id: 'project-1',
  name: 'PreqStation Core',
  projectKey: 'PQST',
  description: null,
  status: 'active',
  priority: 3,
  bgImage: null,
  bgImageCredit: null,
  repoUrl: null,
  vercelUrl: null,
};

function renderEditPanel(initialOpened = false) {
  navigation.currentHref = initialOpened ? '/project/PQST?panel=project-edit' : '/project/PQST';

  return render(
    <MantineProvider>
      <ProjectDetailEditPanelProvider
        closeHref="/project/PQST"
        selectedProject={selectedProject}
        updateProjectAction={async () => ({ ok: true })}
      >
        <ProjectDetailEditPanelButton>Edit Details</ProjectDetailEditPanelButton>
      </ProjectDetailEditPanelProvider>
    </MantineProvider>,
  );
}

describe('project detail edit panel', () => {
  beforeEach(() => {
    navigation.currentHref = '/project/PQST';
    navigation.push.mockClear();
    navigation.replace.mockClear();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it('opens edit details through the Next router query state', () => {
    const view = renderEditPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Details' }));

    expect(navigation.push).toHaveBeenCalledWith('/project/PQST?panel=project-edit', {
      scroll: false,
    });

    view.rerender(
      <MantineProvider>
        <ProjectDetailEditPanelProvider
          closeHref="/project/PQST"
          selectedProject={selectedProject}
          updateProjectAction={async () => ({ ok: true })}
        >
          <ProjectDetailEditPanelButton>Edit Details</ProjectDetailEditPanelButton>
        </ProjectDetailEditPanelProvider>
      </MantineProvider>,
    );

    expect(screen.getByTestId('project-edit-modal')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));

    expect(navigation.replace).toHaveBeenCalledWith('/project/PQST', { scroll: false });

    view.rerender(
      <MantineProvider>
        <ProjectDetailEditPanelProvider
          closeHref="/project/PQST"
          selectedProject={selectedProject}
          updateProjectAction={async () => ({ ok: true })}
        >
          <ProjectDetailEditPanelButton>Edit Details</ProjectDetailEditPanelButton>
        </ProjectDetailEditPanelProvider>
      </MantineProvider>,
    );

    expect(screen.queryByTestId('project-edit-modal')).toBeNull();
  });

  it('still opens from the direct project-edit URL', () => {
    renderEditPanel(true);

    expect(screen.getByTestId('project-edit-modal')).toBeTruthy();
    expect(navigation.currentHref).toBe('/project/PQST?panel=project-edit');
  });
});
