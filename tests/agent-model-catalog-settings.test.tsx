// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentModelCatalogSettings } from '@/app/components/agent-model-catalog-settings';
import { DEFAULT_AGENT_MODEL_CATALOG } from '@/lib/agent-model-catalog';

function renderSettings() {
  return render(
    <MantineProvider>
      <AgentModelCatalogSettings defaultValue={DEFAULT_AGENT_MODEL_CATALOG} />
    </MantineProvider>,
  );
}

describe('app/components/agent-model-catalog-settings', () => {
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
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('uses the server-normalized catalog value after a successful save', async () => {
    const normalizedCatalog =
      '{"claude-code":[],"codex":[{"label":"gpt-5-codex","value":"gpt-5-codex"}],"gemini-cli":[]}';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, value: normalizedCatalog }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderSettings();

    const textarea = screen.getByLabelText('Model catalog JSON');
    const saveButton = screen.getByRole('button', { name: 'Save model catalog' });
    fireEvent.change(textarea, {
      target: {
        value: '{"codex":["gpt-5-codex"],"claude-code":[],"gemini-cli":[]}',
      },
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe(normalizedCatalog);
    });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('preserves the edited catalog after a validation failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Agent model catalog must be valid JSON.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderSettings();

    const textarea = screen.getByLabelText('Model catalog JSON');
    fireEvent.change(textarea, { target: { value: '{' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save model catalog' }));

    await waitFor(() => {
      expect(screen.getByText('Agent model catalog must be valid JSON.')).toBeTruthy();
    });
    expect((textarea as HTMLTextAreaElement).value).toBe('{');
  });

  it('preserves the edited catalog after a network failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    renderSettings();

    const textarea = screen.getByLabelText('Model catalog JSON');
    fireEvent.change(textarea, { target: { value: '{"codex":["gpt-5-codex"]}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save model catalog' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to save model catalog.')).toBeTruthy();
    });
    expect((textarea as HTMLTextAreaElement).value).toBe('{"codex":["gpt-5-codex"]}');
  });
});
