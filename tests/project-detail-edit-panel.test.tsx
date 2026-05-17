// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  window.history.replaceState(
    null,
    '',
    initialOpened ? '/project/PQST?panel=project-edit' : '/project/PQST',
  );

  render(
    <MantineProvider>
      <ProjectDetailEditPanelProvider
        initialOpened={initialOpened}
        editHref="/project/PQST?panel=project-edit"
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

  it('opens edit details in place and updates history without a route navigation', () => {
    renderEditPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Details' }));

    expect(screen.getByTestId('project-edit-modal')).toBeTruthy();
    expect(window.location.pathname).toBe('/project/PQST');
    expect(window.location.search).toBe('?panel=project-edit');

    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));

    expect(screen.queryByTestId('project-edit-modal')).toBeNull();
    expect(window.location.pathname).toBe('/project/PQST');
    expect(window.location.search).toBe('');
  });

  it('still opens from the direct project-edit URL', () => {
    renderEditPanel(true);

    expect(screen.getByTestId('project-edit-modal')).toBeTruthy();
    expect(window.location.search).toBe('?panel=project-edit');
  });
});
