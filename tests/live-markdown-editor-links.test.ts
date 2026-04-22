import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('LiveMarkdownEditor links', () => {
  it('wires live editor links to open in a new tab', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/components/live-markdown-editor.tsx'),
      'utf8',
    );

    expect(source).toContain('import { ClickableLinkPlugin }');
    expect(source).toContain(
      "const LIVE_MARKDOWN_LINK_ATTRIBUTES = { rel: 'noopener noreferrer', target: '_blank' };",
    );
    expect(source).toContain('<LinkPlugin attributes={LIVE_MARKDOWN_LINK_ATTRIBUTES} />');
    expect(source).toContain('<ClickableLinkPlugin newTab />');
  });

  it('keeps live mode editing inline instead of opening a source overlay', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/components/live-markdown-editor.tsx'),
      'utf8',
    );

    expect(source).toContain('import { CodeHighlightNode, CodeNode, registerCodeHighlighting }');
    expect(source).toContain('function CodeHighlightingPlugin()');
    expect(source).toContain('registerCodeHighlighting(editor);');
    expect(source).not.toContain('const updateActiveSourceDraft = useCallback(');
    expect(source).not.toContain('openActiveSourceFromSelection');
    expect(source).not.toContain('className="live-editor-active-source"');
    expect(source).not.toContain("data-live-editor-editing-source='true'");
    expect(source).not.toContain('findNthMatchingMarkdownBlock');
    expect(source).not.toContain('replaceNthMarkdownBlock');
    expect(source).not.toContain('onMouseUp={(event) => {');
  });

  it('registers code block exit handling in live mode', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/components/live-markdown-editor.tsx'),
      'utf8',
    );

    expect(source).toContain('import { KEY_ARROW_RIGHT_COMMAND');
    expect(source).toContain('function CodeBlockExitPlugin()');
    expect(source).toContain('editor.registerCommand(');
    expect(source).toContain('const codeNodeKey = codeNode.getKey();');
    expect(source).toContain('const currentCodeNode = $getNodeByKey(codeNodeKey);');
    expect(source).toContain('splitCodeNodeAtClosingFence(currentCodeNode)');
    expect(source).not.toContain('splitCodeNodeAtClosingFence(codeNode)');
    expect(source).toContain('<CodeBlockExitPlugin />');
  });

  it('registers editable heading source handling in live mode', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/components/live-markdown-editor.tsx'),
      'utf8',
    );

    expect(source).toContain('LiveHeadingSourceNode');
    expect(source).toContain('LIVE_HEADING_SOURCE_TRANSFORMER');
    expect(source).toContain('function LiveHeadingSourcePlugin()');
    expect(source).toContain('function LiveHeadingShortcutPlugin()');
    expect(source).toContain('<LiveHeadingSourcePlugin />');
    expect(source).toContain('<LiveHeadingShortcutPlugin />');
    expect(source).toContain('MARKDOWN_SHORTCUT_TRANSFORMERS');
    expect(source).toContain('tags.has(LIVE_HEADING_SOURCE_SYNC_TAG)');
  });

  it('registers heading source ArrowRight exit handling in live mode', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/components/live-markdown-editor.tsx'),
      'utf8',
    );

    expect(source).toContain('function LiveHeadingSourcePlugin()');
    expect(source).toContain('const unregisterArrowRight = editor.registerCommand(');
    expect(source).toContain('shouldExitLiveHeadingSourceOnArrowRight(');
    expect(source).toContain('resolveLiveHeadingSourceCursor(selection, sourceNode)');
    expect(source).toContain('$exitLiveHeadingSourceOnArrowRight(sourceNode)');
  });

  it('registers live-mode Backspace handling for headings and list items', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/components/live-markdown-editor.tsx'),
      'utf8',
    );

    expect(source).toContain('KEY_BACKSPACE_COMMAND');
    expect(source).toContain('function LiveBackspacePlugin()');
    expect(source).toContain('shouldPreserveLiveHeadingSourceOnBackspace(');
    expect(source).toContain('<LiveBackspacePlugin />');
  });

  it('wires save shortcuts in both markdown and live editor paths', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/components/live-markdown-editor.tsx'),
      'utf8',
    );

    expect(source).toContain('onSaveShortcut?: () => void;');
    expect(source).toContain('function handleSaveShortcut(');
    expect(source).toContain("event.key.toLowerCase() !== 's'");
    expect(source).toContain('!event.metaKey && !event.ctrlKey');
    expect(source).toContain('onSaveShortcut?.()');
    expect(source).toContain('onKeyDown={handleLiveEditorKeyDown}');
  });
});
