// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reactHooks = vi.hoisted(() => ({
  useId: vi.fn(() => 'settings-feedback'),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();

  return {
    ...actual,
    useId: reactHooks.useId,
  };
});

import {
  SettingsLabelForm,
  SettingsLabelNameInput,
  TaskLabelColorField,
} from '@/app/components/settings-label-form';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('app/components/settings-label-form', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    reactHooks.useId.mockClear();
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
  });

  it('renders regular children while preserving the shared error message for name validation', async () => {
    render(
      <MantineProvider>
        <SettingsLabelForm
          action={vi.fn(async () => ({
            ok: false as const,
            message: 'Please enter a valid label name.',
            field: 'name' as const,
          }))}
        >
          <SettingsLabelNameInput aria-label="Label name" name="name" />
          <TaskLabelColorField ariaLabel="Label color" label="Label color" showLabel={false} />
        </SettingsLabelForm>
      </MantineProvider>,
    );

    fireEvent.submit(screen.getByLabelText('Label name').closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid label name.')).toBeTruthy();
    });
    expect(screen.getByLabelText('Label color').getAttribute('aria-describedby')).toBeNull();
  });

  it('isolates color validation from the name field', async () => {
    render(
      <MantineProvider>
        <SettingsLabelForm
          action={vi.fn(async () => ({
            ok: false as const,
            message: 'Please choose a valid label color.',
            field: 'color' as const,
          }))}
        >
          <SettingsLabelNameInput aria-label="Label name" name="name" />
          <TaskLabelColorField ariaLabel="Label color" label="Label color" showLabel={false} />
        </SettingsLabelForm>
      </MantineProvider>,
    );

    fireEvent.submit(screen.getByLabelText('Label name').closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByLabelText('Label color').getAttribute('aria-describedby')).toBe(
        'settings-feedback',
      );
    });
    expect(screen.getByLabelText('Label name').getAttribute('aria-invalid')).not.toBe('true');
    expect(screen.getByText('Please choose a valid label color.')).toBeTruthy();
  });

  it('surfaces dirty and saved states for manual label submits', async () => {
    const action = vi.fn(async () => ({ ok: true as const }));

    render(
      <MantineProvider>
        <SettingsLabelForm action={action}>
          <input aria-label="Label name" name="name" defaultValue="" />
          <button type="submit">Save label</button>
        </SettingsLabelForm>
      </MantineProvider>,
    );

    fireEvent.change(screen.getByLabelText('Label name'), {
      target: { value: 'Bug' },
    });

    expect(screen.getByText('Unsaved changes.')).toBeTruthy();

    fireEvent.submit(screen.getByText('Save label').closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByText('Saved.')).toBeTruthy();
    });
  });

  it('clears the saved state after a short delay', async () => {
    vi.useFakeTimers();
    const request = deferred<{ ok: true }>();
    const action = vi.fn(async () => request.promise);

    render(
      <MantineProvider>
        <SettingsLabelForm action={action}>
          <input aria-label="Label name" name="name" defaultValue="" />
          <button type="submit">Save label</button>
        </SettingsLabelForm>
      </MantineProvider>,
    );

    fireEvent.change(screen.getByLabelText('Label name'), {
      target: { value: 'Bug' },
    });
    fireEvent.submit(screen.getByText('Save label').closest('form') as HTMLFormElement);

    await act(async () => {
      request.resolve({ ok: true });
      await Promise.resolve();
    });

    expect(screen.getByText('Saved.')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(screen.queryByText('Saved.')).toBeNull();
  });

  it('disables controls and ignores duplicate submits while a save is pending', async () => {
    const request = deferred<{ ok: true }>();
    const action = vi.fn(async () => request.promise);

    render(
      <MantineProvider>
        <SettingsLabelForm action={action}>
          <input aria-label="Label name" name="name" defaultValue="" />
          <button type="submit">Save label</button>
        </SettingsLabelForm>
      </MantineProvider>,
    );

    const form = screen.getByText('Save label').closest('form') as HTMLFormElement;
    const input = screen.getByLabelText('Label name');
    const button = screen.getByText('Save label');

    fireEvent.change(input, {
      target: { value: 'Bug' },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(input.matches(':disabled')).toBe(true);
      expect(button.matches(':disabled')).toBe(true);
    });

    fireEvent.submit(form);

    expect(action).toHaveBeenCalledTimes(1);

    request.resolve({ ok: true });

    await waitFor(() => {
      expect(screen.getByText('Saved.')).toBeTruthy();
    });
  });

  it('passes through a form id for confirm-action submit flows', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <SettingsLabelForm action={vi.fn(async () => null)} id="delete-label-form">
          <SettingsLabelNameInput aria-label="Label name" name="name" />
        </SettingsLabelForm>
      </MantineProvider>,
    );

    expect(html).toMatch(/<form[^>]*id="delete-label-form"/);
  });
});
