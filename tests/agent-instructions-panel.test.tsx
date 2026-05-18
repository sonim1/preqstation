// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentInstructionsPanel } from '@/app/components/panels/agent-instructions-panel';
import controlClasses from '@/app/components/settings-controls.module.css';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('app/components/panels/agent-instructions-panel', () => {
  afterEach(() => {
    cleanup();
  });

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
    Object.defineProperty(document, 'fonts', {
      writable: true,
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  it('shows project-wide guidance without language preset copy', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <AgentInstructionsPanel
          action={vi.fn(async () => null)}
          projectId="project-1"
          value="Follow existing component patterns."
        />
      </MantineProvider>,
    );

    expect(html).toContain('Changes stay local until you save.');
    expect(html).toContain(
      'Saved with this project and appended to every dispatched PREQ task payload',
    );
    expect(html).toContain('Optional project-wide guidance for dispatched agents.');
    expect(html).toContain('Project-wide examples');
    expect(html).toContain(
      'Follow the existing component patterns before adding new abstractions.',
    );
    expect(html).toContain('Update focused tests for behavior changes.');
    expect(html).toContain('Call out security or data-loss risks in review notes.');
    expect(html).not.toContain('Always answer in Korean');
    expect(html).toContain('max-width:100%');
    expect(html).toContain('white-space:pre-wrap');
    expect(html).toContain('overflow-wrap:anywhere');
  });

  it('keeps the textarea empty when no project instructions are saved', () => {
    render(
      <MantineProvider>
        <AgentInstructionsPanel
          action={vi.fn(async () => null)}
          projectId="project-1"
          value={null}
        />
      </MantineProvider>,
    );

    expect((screen.getByLabelText('Agent instructions') as HTMLTextAreaElement).value).toBe('');
  });

  it('applies the shared settings panel form class to the rendered form', () => {
    render(
      <MantineProvider>
        <AgentInstructionsPanel
          action={vi.fn(async () => null)}
          projectId="project-1"
          value="Follow existing component patterns."
        />
      </MantineProvider>,
    );

    const form = screen.getByLabelText('Agent instructions').closest('form');

    expect(form?.classList.contains(controlClasses.panelForm)).toBe(true);
  });

  it('surfaces dirty and saved states without refreshing the route', async () => {
    const action = vi.fn(async (_prevState: unknown, formData: FormData) => ({
      ok: true as const,
      message: `Saved ${String(formData.get('agent_instructions') || '')}`,
    }));

    render(
      <MantineProvider>
        <AgentInstructionsPanel action={action} projectId="project-1" value="Keep it sharp." />
      </MantineProvider>,
    );

    const textarea = screen.getByLabelText('Agent instructions');
    fireEvent.change(textarea, {
      target: { value: 'Run focused tests for changed behavior.' },
    });

    expect(screen.getByText('Unsaved changes.')).toBeTruthy();

    fireEvent.submit(textarea.closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByText('Saved.')).toBeTruthy();
    });

    const submittedFormData = action.mock.calls[0]?.[1] as FormData;
    expect(submittedFormData.get('projectId')).toBe('project-1');
    expect(submittedFormData.get('agent_instructions')).toBe(
      'Run focused tests for changed behavior.',
    );
  });

  it('surfaces inline save errors after submit', async () => {
    const action = vi.fn(async () => ({
      ok: false as const,
      message: 'Failed to save agent instructions.',
    }));

    render(
      <MantineProvider>
        <AgentInstructionsPanel action={action} projectId="project-1" value="Keep it sharp." />
      </MantineProvider>,
    );

    fireEvent.change(screen.getByLabelText('Agent instructions'), {
      target: { value: 'Broken instructions' },
    });
    fireEvent.submit(
      screen.getByLabelText('Agent instructions').closest('form') as HTMLFormElement,
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to save agent instructions.')).toBeTruthy();
    });
  });

  it('keeps the form dirty when edits continue after save starts', async () => {
    const request = deferred<{ ok: true }>();
    const action = vi.fn(async () => request.promise);

    render(
      <MantineProvider>
        <AgentInstructionsPanel action={action} projectId="project-1" value="Keep it sharp." />
      </MantineProvider>,
    );

    const textarea = screen.getByLabelText('Agent instructions');
    fireEvent.change(textarea, {
      target: { value: 'Run focused tests for changed behavior.' },
    });
    fireEvent.submit(textarea.closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(textarea, {
      target: { value: 'Run focused tests for changed behavior. Note review risks.' },
    });

    request.resolve({ ok: true });

    await waitFor(() => {
      expect(screen.getByText('Unsaved changes.')).toBeTruthy();
    });
    expect(screen.queryByText('Saved.')).toBeNull();
  });
});
