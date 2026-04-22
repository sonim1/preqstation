import { describe, expect, it } from 'vitest';

import {
  applyMarkdownEnterShortcut,
  applyMarkdownShiftTabShortcut,
  applyMarkdownTabShortcut,
} from '@/lib/live-markdown-shortcuts';

describe('lib/live-markdown-shortcuts', () => {
  it('continues a checklist item on enter when the current line has content', () => {
    expect(applyMarkdownEnterShortcut('- [ ] item', '- [ ] item'.length)).toEqual({
      nextCursor: '- [ ] item\n- [ ] '.length,
      nextMarkdown: '- [ ] item\n- [ ] ',
    });
  });

  it('removes an empty checklist marker on enter', () => {
    expect(applyMarkdownEnterShortcut('- [ ] ', '- [ ] '.length)).toEqual({
      nextCursor: 0,
      nextMarkdown: '',
    });
  });

  it('continues a bullet list item on enter when the current line has content', () => {
    expect(applyMarkdownEnterShortcut('- item', '- item'.length)).toEqual({
      nextCursor: '- item\n- '.length,
      nextMarkdown: '- item\n- ',
    });
  });

  it('removes an empty bullet list marker on enter', () => {
    expect(applyMarkdownEnterShortcut('- ', '- '.length)).toEqual({
      nextCursor: 0,
      nextMarkdown: '',
    });
  });

  it('nests a list item once when the previous line provides same-level context', () => {
    const markdown = '- parent\n- child';
    expect(applyMarkdownTabShortcut(markdown, markdown.length)).toEqual({
      nextCursor: markdown.length + 4,
      nextMarkdown: '- parent\n    - child',
    });
  });

  it('falls back to literal indentation after one structured nesting step', () => {
    const markdown = '- parent\n    - child';
    expect(applyMarkdownTabShortcut(markdown, markdown.length)).toEqual({
      nextCursor: markdown.length + 2,
      nextMarkdown: '- parent\n      - child',
    });
  });

  it('falls back to literal indentation when there is no previous list context', () => {
    expect(applyMarkdownTabShortcut('- orphan', '- orphan'.length)).toEqual({
      nextCursor: '- orphan'.length + 2,
      nextMarkdown: '  - orphan',
    });
  });

  it('outdents a structured checklist item on shift+tab', () => {
    const markdown = '- parent\n    - [ ] child';
    expect(applyMarkdownShiftTabShortcut(markdown, markdown.length)).toEqual({
      nextCursor: markdown.length - 4,
      nextMarkdown: '- parent\n- [ ] child',
    });
  });

  it('outdents a bullet list item one literal step after structured nesting', () => {
    const markdown = '- parent\n      - child';
    expect(applyMarkdownShiftTabShortcut(markdown, markdown.length)).toEqual({
      nextCursor: markdown.length - 2,
      nextMarkdown: '- parent\n    - child',
    });
  });

  it('outdents a plain indented line on shift+tab', () => {
    const markdown = '  plain text';
    expect(applyMarkdownShiftTabShortcut(markdown, markdown.length)).toEqual({
      nextCursor: markdown.length - 2,
      nextMarkdown: 'plain text',
    });
  });
});
