/* @vitest-environment jsdom */

import { ListItemNode, ListNode } from '@lexical/list';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { MantineProvider } from '@mantine/core';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { $createParagraphNode, $createTextNode, $getRoot, type LexicalEditor } from 'lexical';
import { useEffect } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  LiveChecklistShortcutPlugin,
  LiveMarkdownEditor,
} from '@/app/components/live-markdown-editor';

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

function renderEditorWithControls(defaultValue: string) {
  const onContentChange = vi.fn();
  const onExternalUpdateApplied = vi.fn();
  const view = render(
    <MantineProvider>
      <LiveMarkdownEditor
        name="description"
        label="Description"
        defaultValue={defaultValue}
        onContentChange={onContentChange}
        onExternalUpdateApplied={onExternalUpdateApplied}
        autoFocus={false}
      />
    </MantineProvider>,
  );

  return {
    onContentChange,
    onExternalUpdateApplied,
    rerenderDefaultValue: (nextDefaultValue: string) => {
      view.rerender(
        <MantineProvider>
          <LiveMarkdownEditor
            name="description"
            label="Description"
            defaultValue={nextDefaultValue}
            onContentChange={onContentChange}
            onExternalUpdateApplied={onExternalUpdateApplied}
            autoFocus={false}
          />
        </MantineProvider>,
      );
    },
    rerenderExternalUpdate: (externalUpdate: {
      markdown: string;
      version: number;
      cursorIndex?: number | null;
    }) => {
      view.rerender(
        <MantineProvider>
          <LiveMarkdownEditor
            name="description"
            label="Description"
            defaultValue={defaultValue}
            externalUpdate={externalUpdate}
            onContentChange={onContentChange}
            onExternalUpdateApplied={onExternalUpdateApplied}
            autoFocus={false}
          />
        </MantineProvider>,
      );
    },
    ...view,
  };
}

function getHiddenMarkdownInput(container: HTMLElement) {
  const input = container.querySelector('input[name="description"]');
  expect(input).toBeInstanceOf(HTMLInputElement);
  return input as HTMLInputElement;
}

function EditorHandlePlugin({ onReady }: { onReady: (editor: LexicalEditor) => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    onReady(editor);
  }, [editor, onReady]);

  return null;
}

function renderChecklistShortcutHarness() {
  let editor: LexicalEditor | null = null;
  const onReady = vi.fn((nextEditor: LexicalEditor) => {
    editor = nextEditor;
  });
  const view = render(
    <LexicalComposer
      initialConfig={{
        namespace: 'checklist-shortcut-test',
        onError: (error: Error) => {
          throw error;
        },
        theme: {
          paragraph: 'live-editor-paragraph',
          list: {
            listitemChecked: 'live-editor-li-checked',
            listitemUnchecked: 'live-editor-li-unchecked',
          },
        },
        nodes: [ListNode, ListItemNode],
      }}
    >
      <RichTextPlugin
        contentEditable={<ContentEditable aria-label="Checklist shortcut test editor" />}
        placeholder={null}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <LiveChecklistShortcutPlugin />
      <EditorHandlePlugin onReady={onReady} />
    </LexicalComposer>,
  );

  expect(onReady).toHaveBeenCalled();
  expect(editor).not.toBeNull();
  return { editor: editor!, ...view };
}

function setHarnessParagraph(editor: LexicalEditor, text: string) {
  act(() => {
    editor.update(() => {
      const root = $getRoot();
      const paragraph = $createParagraphNode();
      const textNode = $createTextNode(text);

      root.clear();
      paragraph.append(textNode);
      root.append(paragraph);
      textNode.select(text.length, text.length);
    });
  });
}

describe('LiveMarkdownEditor spacing reconciliation', () => {
  it('renders stable classes for live and markdown reading surfaces', async () => {
    const { container } = renderEditor('Read me');

    const liveEditor = await screen.findByLabelText('Description live editor');
    const shell = container.querySelector('.live-editor-shell');

    expect(shell).not.toBeNull();
    expect(shell?.contains(liveEditor)).toBe(true);
    expect(liveEditor.classList.contains('live-editor-input')).toBe(true);

    fireEvent.click(screen.getByRole('radio', { name: 'Markdown' }));

    const rawInput = await screen.findByLabelText('Description markdown source');
    expect(rawInput).toBeInstanceOf(HTMLTextAreaElement);
    expect(rawInput.classList.contains('live-editor-raw-input')).toBe(true);
  });

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

  it('converts an unchecked checklist marker as soon as the closing bracket lands', async () => {
    const { container, editor } = renderChecklistShortcutHarness();

    setHarnessParagraph(editor, '- [ ]');

    await waitFor(() => {
      expect(container.querySelector('.live-editor-li-unchecked')).not.toBeNull();
    });
  });

  it('converts a checked checklist marker as soon as the closing bracket lands', async () => {
    const { container, editor } = renderChecklistShortcutHarness();

    setHarnessParagraph(editor, '- [x]');

    await waitFor(() => {
      expect(container.querySelector('.live-editor-li-checked')).not.toBeNull();
    });
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

  it('does not reseed live mode when rehydrated defaultValue sanitizes to the current markdown', async () => {
    const markdown = 'Saved note';
    const { container, rerenderDefaultValue } = renderEditorWithControls(markdown);

    const editor = await screen.findByLabelText('Description live editor');

    rerenderDefaultValue(
      [markdown, '', ':::preq-choice', 'question: Keep existing note?', ':::'].join('\n'),
    );

    await waitFor(() => {
      expect(getHiddenMarkdownInput(container).value).toBe(markdown);
    });
    expect(screen.getByLabelText('Description live editor')).toBe(editor);
  });

  it('clears dirty state when defaultValue rehydrates the user edit', async () => {
    const { container, onContentChange, rerenderDefaultValue } =
      renderEditorWithControls('Saved note');

    await screen.findByLabelText('Description live editor');
    fireEvent.click(screen.getByRole('radio', { name: 'Markdown' }));

    const textarea = await screen.findByLabelText('Description markdown source');
    fireEvent.change(textarea, { target: { value: 'User edit' } });

    expect(onContentChange).toHaveBeenCalledWith('User edit');
    expect(getHiddenMarkdownInput(container).value).toBe('User edit');

    rerenderDefaultValue(
      ['User edit', '', ':::preq-choice', 'question: Keep existing note?', ':::'].join('\n'),
    );

    await waitFor(() => {
      expect(getHiddenMarkdownInput(container).value).toBe('User edit');
    });
    expect(screen.getByLabelText('Description markdown source')).toBe(textarea);

    rerenderDefaultValue('Server replacement');

    await waitFor(() => {
      expect(getHiddenMarkdownInput(container).value).toBe('Server replacement');
    });
    expect(
      (screen.getByLabelText('Description markdown source') as HTMLTextAreaElement).value,
    ).toBe('Server replacement');
  });

  it('keeps an external update when defaultValue still has the old markdown', async () => {
    const { container, onExternalUpdateApplied, rerenderExternalUpdate } =
      renderEditorWithControls('Saved note');

    rerenderExternalUpdate({ markdown: 'External note', version: 1 });

    await waitFor(() => {
      expect(onExternalUpdateApplied).toHaveBeenCalledWith('External note');
    });
    expect(getHiddenMarkdownInput(container).value).toBe('External note');
  });
});
