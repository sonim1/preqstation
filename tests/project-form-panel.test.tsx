// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replaceMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
const useActionStateMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
}));

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

vi.mock('@/app/components/project-background-picker', () => ({
  ProjectBackgroundPicker: ({ name }: { name: string }) => <input type="hidden" name={name} />,
}));

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: vi.fn(),
}));

import { ProjectFormPanel } from '@/app/components/panels/project-form-panel';

describe('app/components/panels/project-form-panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    useActionStateMock.mockReturnValue([{ ok: true, projectKey: 'QAD' }, vi.fn()]);
  });

  it('navigates to the created project when the server action succeeds', async () => {
    render(
      <MantineProvider>
        <ProjectFormPanel createProjectAction={vi.fn()} />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/project/QAD');
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
