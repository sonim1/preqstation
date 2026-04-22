import { $createCodeNode, CodeNode } from '@lexical/code';
import { $createTextNode, $getRoot, createEditor, ParagraphNode } from 'lexical';
import { describe, expect, it } from 'vitest';

import {
  detectClosedCodeFence,
  shouldExitCodeBlockOnArrowRight,
  splitCodeNodeAtClosingFence,
} from '@/lib/live-markdown-code-block';

describe('lib/live-markdown-code-block', () => {
  it('detects a standalone closing fence and preserves trailing markdown', () => {
    expect(detectClosedCodeFence('console.log(1)\n```\nafter paragraph')).toEqual({
      code: 'console.log(1)',
      trailingMarkdown: 'after paragraph',
    });
  });

  it('ignores fence-like text that is not a standalone closing fence line', () => {
    expect(detectClosedCodeFence('console.log("```")')).toBeNull();
  });

  it('allows ArrowRight to leave a code block only at the collapsed end position', () => {
    expect(
      shouldExitCodeBlockOnArrowRight({
        cursor: 18,
        selectionLength: 0,
        textLength: 18,
      }),
    ).toBe(true);

    expect(
      shouldExitCodeBlockOnArrowRight({
        cursor: 17,
        selectionLength: 0,
        textLength: 18,
      }),
    ).toBe(false);
  });

  it('moves trailing text after a closing fence into a following paragraph', () => {
    const editor = createEditor({ nodes: [CodeNode] });

    editor.update(
      () => {
        const root = $getRoot();
        const code = $createCodeNode();
        code.append($createTextNode('console.log(1)\n```\nafter paragraph'));
        root.append(code);

        splitCodeNodeAtClosingFence(code);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getFirstChildOrThrow<CodeNode>().getTextContent()).toBe('console.log(1)');
      expect(root.getLastChildOrThrow<ParagraphNode>().getTextContent()).toBe('after paragraph');
    });
  });
});
