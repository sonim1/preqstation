/* @vitest-environment jsdom */

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { LiveMarkdownEditor } from '@/app/components/live-markdown-editor';

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
});

afterEach(() => {
  cleanup();
});

function renderEditor(defaultValue: string) {
  const onContentChange = vi.fn();
  const view = render(
    <MantineProvider>
      <LiveMarkdownEditor
        name="description"
        label="Description"
        defaultValue={defaultValue}
        onContentChange={onContentChange}
        autoFocus={false}
      />
    </MantineProvider>,
  );

  return { onContentChange, ...view };
}

function getHiddenMarkdownInput(container: HTMLElement) {
  const input = container.querySelector('input[name="description"]');
  expect(input).toBeInstanceOf(HTMLInputElement);
  return input as HTMLInputElement;
}

describe('LiveMarkdownEditor spacing reconciliation', () => {
  it('does not autosave a blank line between an ordered list and following paragraph during bootstrap', async () => {
    const markdown = '1. First item\nText right below';
    const { container, onContentChange } = renderEditor(markdown);

    await waitFor(() => {
      expect(screen.getByLabelText('Description live editor').textContent).toContain(
        'Text right below',
      );
    });

    expect(getHiddenMarkdownInput(container).value).toBe(markdown);
    expect(onContentChange).not.toHaveBeenCalled();
  });

  it('does not autosave a blank line between a checklist item and following paragraph during bootstrap', async () => {
    const markdown = '- [ ] Checklist item\nText right below';
    const { container, onContentChange } = renderEditor(markdown);

    await waitFor(() => {
      expect(screen.getByLabelText('Description live editor').textContent).toContain(
        'Text right below',
      );
    });

    expect(getHiddenMarkdownInput(container).value).toBe(markdown);
    expect(onContentChange).not.toHaveBeenCalled();
  });

  it('preserves deliberate blank lines between paragraphs during bootstrap', async () => {
    const markdown = 'First paragraph\n\nSecond paragraph';
    const { container, onContentChange } = renderEditor(markdown);

    await waitFor(() => {
      expect(screen.getByLabelText('Description live editor').textContent).toContain(
        'Second paragraph',
      );
    });

    const paragraphs = container.querySelectorAll('.live-editor-paragraph');
    // We expect 3 paragraphs: "First paragraph", empty paragraph for \n\n, and "Second paragraph"
    expect(paragraphs.length).toBeGreaterThanOrEqual(3);

    const middleParagraph = Array.from(paragraphs).find((p) => p.textContent?.trim() === '');
    expect(middleParagraph).toBeDefined();

    expect(getHiddenMarkdownInput(container).value).toBe(markdown);
    expect(onContentChange).not.toHaveBeenCalled();
  });

  it('preserves deliberate blank line runs between paragraphs during bootstrap', async () => {
    const markdown = 'First paragraph\n\n\nSecond paragraph';
    const { container, onContentChange } = renderEditor(markdown);

    await waitFor(() => {
      expect(screen.getByLabelText('Description live editor').textContent).toContain(
        'Second paragraph',
      );
    });

    const emptyParagraphs = Array.from(container.querySelectorAll('.live-editor-paragraph')).filter(
      (p) => p.textContent?.trim() === '',
    );
    expect(emptyParagraphs.length).toBeGreaterThanOrEqual(2);

    expect(getHiddenMarkdownInput(container).value).toBe(markdown);
    expect(onContentChange).not.toHaveBeenCalled();
  });

  it('maintains deliberate blank lines when switching modes', async () => {
    const markdown = 'First paragraph\n\nSecond paragraph';
    const { container } = renderEditor(markdown);

    await waitFor(() => {
      expect(screen.getByLabelText('Description live editor').textContent).toContain(
        'Second paragraph',
      );
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Markdown' }));

    await waitFor(() => {
      const textarea = screen.getByLabelText('Description markdown source') as HTMLTextAreaElement;
      expect(textarea.value).toBe(markdown);
    });
    expect(getHiddenMarkdownInput(container).value).toBe(markdown);
  });

  it('keeps tight list-to-paragraph spacing when switching from live to markdown mode', async () => {
    const markdown = '1. First item\nText right below';
    const { container } = renderEditor(markdown);

    await waitFor(() => {
      expect(screen.getByLabelText('Description live editor').textContent).toContain(
        'Text right below',
      );
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Markdown' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Description markdown source')).toBeInstanceOf(
        HTMLTextAreaElement,
      );
    });
    expect(getHiddenMarkdownInput(container).value).toBe(markdown);
  });
});
