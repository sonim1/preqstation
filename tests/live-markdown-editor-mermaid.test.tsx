/* @vitest-environment jsdom */

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { LiveMarkdownEditor } from '@/app/components/live-markdown-editor';

const initialize = vi.fn();
const run = vi.fn().mockResolvedValue(undefined);

vi.mock('mermaid', () => ({
  default: {
    initialize,
    run,
  },
}));

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  vi.stubGlobal('requestAnimationFrame', ((callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  }) as typeof requestAnimationFrame);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

beforeEach(() => {
  initialize.mockClear();
  run.mockReset();
  run.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderEditor(defaultValue: string) {
  return render(
    <MantineProvider>
      <LiveMarkdownEditor
        name="description"
        label="Description"
        defaultValue={defaultValue}
        autoFocus={false}
      />
    </MantineProvider>,
  );
}

function getHiddenMarkdownInput(container: HTMLElement) {
  const input = container.querySelector('input[name="description"]');
  expect(input).toBeInstanceOf(HTMLInputElement);
  return input as HTMLInputElement;
}

describe('LiveMarkdownEditor mermaid diagrams', () => {
  it('renders mermaid fences as live diagrams while preserving markdown source', async () => {
    const markdown = '```mermaid\nflowchart LR\n  A --> B\n```';
    const { container } = renderEditor(markdown);

    await waitFor(() => {
      expect(container.querySelector('.live-editor-mermaid-block')).not.toBeNull();
      expect(run).toHaveBeenCalledTimes(1);
    });

    expect(container.querySelector('.live-editor-code-block')).toBeNull();
    expect(getHiddenMarkdownInput(container).value).toBe(markdown);

    fireEvent.click(screen.getByRole('radio', { name: 'Markdown' }));

    await waitFor(() => {
      expect(
        (screen.getByLabelText('Description markdown source') as HTMLTextAreaElement).value,
      ).toBe(markdown);
    });
    expect(getHiddenMarkdownInput(container).value).toBe(markdown);

    fireEvent.click(screen.getByRole('radio', { name: 'Live' }));

    await waitFor(() => {
      expect(container.querySelector('.live-editor-mermaid-block')).not.toBeNull();
      expect(run).toHaveBeenCalledTimes(2);
    });
    expect(getHiddenMarkdownInput(container).value).toBe(markdown);
  });

  it('keeps mermaid source available when preview rendering fails', async () => {
    run.mockRejectedValueOnce(new Error('bad diagram'));
    const markdown = '```mermaid\nflowchart LR\n  A -->\n```';
    const { container } = renderEditor(markdown);

    await waitFor(() => {
      expect(container.querySelector('.live-editor-mermaid-source')?.textContent).toContain(
        'flowchart LR',
      );
    });

    expect(getHiddenMarkdownInput(container).value).toBe(markdown);
  });
});
