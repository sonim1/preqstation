import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reactHooks = vi.hoisted(() => ({
  useActionState: vi.fn(),
  useId: vi.fn(() => 'settings-feedback'),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();

  return {
    ...actual,
    useActionState: reactHooks.useActionState,
    useId: reactHooks.useId,
  };
});

import {
  SettingsLabelForm,
  SettingsLabelNameInput,
  TaskLabelColorField,
  TaskLabelColorPicker,
} from '@/app/components/settings-label-form';

describe('app/components/settings-label-form', () => {
  beforeEach(() => {
    reactHooks.useActionState.mockReset();
    reactHooks.useActionState.mockReturnValue([null, vi.fn()]);
  });

  it('renders regular children while preserving the shared error message for name validation', () => {
    reactHooks.useActionState.mockReturnValue([
      { ok: false, message: 'Please enter a valid label name.', field: 'name' },
      vi.fn(),
    ]);

    const html = renderToStaticMarkup(
      <MantineProvider>
        <SettingsLabelForm action={vi.fn(async () => null)}>
          <SettingsLabelNameInput aria-label="Label name" name="name" />
          <TaskLabelColorField ariaLabel="Label color" label="Label color" showLabel={false} />
        </SettingsLabelForm>
      </MantineProvider>,
    );

    expect(html).toMatch(/<input[^>]*aria-label="Label name"/);
    expect(html).not.toMatch(
      /<button[^>]*aria-label="Label color"[^>]*aria-describedby="settings-feedback"/,
    );
    expect(html).toContain('Please enter a valid label name.');
  });

  it('isolates color validation from the name field', () => {
    reactHooks.useActionState.mockReturnValue([
      { ok: false, message: 'Please choose a valid label color.', field: 'color' },
      vi.fn(),
    ]);

    const html = renderToStaticMarkup(
      <MantineProvider>
        <SettingsLabelForm action={vi.fn(async () => null)}>
          <SettingsLabelNameInput aria-label="Label name" name="name" />
          <TaskLabelColorField ariaLabel="Label color" label="Label color" showLabel={false} />
        </SettingsLabelForm>
      </MantineProvider>,
    );

    expect(html).not.toMatch(/<input[^>]*aria-label="Label name"[^>]*aria-invalid="true"/);
    expect(html).toMatch(
      /<button[^>]*aria-label="Label color"[^>]*aria-describedby="settings-feedback"[^>]*aria-invalid="true"/,
    );
  });

  it('supports a controlled task label color picker for non-form label creation flows', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <SettingsLabelForm action={vi.fn(async () => null)}>
          <TaskLabelColorPicker
            value="red"
            onChange={vi.fn()}
            ariaLabel="Task label color"
            label="Task label color"
            showLabel={false}
          />
        </SettingsLabelForm>
      </MantineProvider>,
    );

    expect(html).toContain('aria-label="Task label color"');
    expect(html).toContain('>Red<');
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
