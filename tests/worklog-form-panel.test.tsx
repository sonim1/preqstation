// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useActionStateMock = vi.hoisted(() => vi.fn());

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useActionState: useActionStateMock,
  };
});

vi.mock('@/app/components/live-markdown-editor', () => ({
  LiveMarkdownEditor: ({ name, label }: { name: string; label: string }) => (
    <textarea aria-label={label} name={name} />
  ),
}));

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: vi.fn(),
}));

import { WorklogFormPanel } from '@/app/components/panels/worklog-form-panel';
import controlClasses from '@/app/components/settings-controls.module.css';

describe('app/components/panels/worklog-form-panel', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    useActionStateMock.mockReturnValue([null, vi.fn()]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('applies the shared settings panel form class to the rendered form', () => {
    render(
      <MantineProvider>
        <WorklogFormPanel
          createWorkLogAction={vi.fn(async () => null)}
          projects={[{ id: 'project-1', name: 'Project One' }]}
        />
      </MantineProvider>,
    );

    const form = screen.getByRole('button', { name: 'Save Work Log' }).closest('form');

    expect(form?.classList.contains(controlClasses.panelForm)).toBe(true);
  });
});
