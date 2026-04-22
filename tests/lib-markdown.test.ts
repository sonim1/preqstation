import { describe, expect, it } from 'vitest';

import * as markdownHelpers from '@/lib/markdown';
import {
  extractMarkdownArtifacts,
  preserveTightHeadingParagraphSpacing,
  renderMarkdownToHtml,
  toggleChecklistItem,
} from '@/lib/markdown';

function compactHtml(html: string) {
  return html
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

describe('lib/markdown', () => {
  it('tracks ordered-list blocks for live editor import', () => {
    const getOrderedListBlocksForImport = (markdownHelpers as Record<string, unknown>)
      .getOrderedListBlocksForImport;

    expect(typeof getOrderedListBlocksForImport).toBe('function');
    if (typeof getOrderedListBlocksForImport !== 'function') return;

    expect(getOrderedListBlocksForImport('1. first\n2. second')).toEqual([
      { indent: 0, itemCount: 2, start: 1 },
    ]);
    expect(getOrderedListBlocksForImport('1. first\n\n1. restart')).toEqual([
      { indent: 0, itemCount: 1, start: 1 },
      { indent: 0, itemCount: 1, start: 1 },
    ]);
  });

  it('preserves tight heading-to-paragraph spacing when live export adds a formatter-only blank line', () => {
    expect(
      preserveTightHeadingParagraphSpacing(
        '## Hardware history\nIt used to be common to build PCs by hand.',
        '## Hardware history\n\nIt used to be common to build PCs by hand.',
      ),
    ).toBe('## Hardware history\nIt used to be common to build PCs by hand.');
  });

  it('preserves tight heading-to-paragraph spacing after the heading text changes', () => {
    expect(
      preserveTightHeadingParagraphSpacing('## Old title\nParagraph', '## New title\n\nParagraph'),
    ).toBe('## New title\nParagraph');
  });

  it('does not collapse heading spacing before lists or code fences', () => {
    expect(preserveTightHeadingParagraphSpacing('## Title\n\n- item', '## Title\n\n- item')).toBe(
      '## Title\n\n- item',
    );
    expect(
      preserveTightHeadingParagraphSpacing(
        '## Title\n\n```ts\nconst value = 1;\n```',
        '## Title\n\n```ts\nconst value = 1;\n```',
      ),
    ).toBe('## Title\n\n```ts\nconst value = 1;\n```');
  });

  it('renders indented unordered lists as nested lists instead of flattening them', () => {
    const html = compactHtml(renderMarkdownToHtml('- parent\n    - child'));

    expect(html).toContain('<ul><li>parent<ul><li>child</li></ul></li></ul>');
  });

  it('renders indented checklist items as nested task lists with stable task indexes', () => {
    const html = compactHtml(renderMarkdownToHtml('- [ ] parent\n    - [ ] child\n- [x] done'));

    expect(html).toContain(
      '<ul class="task-list"><li class="task-list-item"><label><input class="task-list-checkbox" type="checkbox" data-task-index="0"><span class="task-list-text">parent</span></label><ul class="task-list"><li class="task-list-item"><label><input class="task-list-checkbox" type="checkbox" data-task-index="1"><span class="task-list-text">child</span></label></li></ul></li><li class="task-list-item"><label><input class="task-list-checkbox" type="checkbox" data-task-index="2" checked><span class="task-list-text">done</span></label></li></ul>',
    );
  });

  it('keeps mixed nested bullet and checklist blocks under the same parent item', () => {
    const html = compactHtml(
      renderMarkdownToHtml('- parent\n    - [ ] child task\n    - child bullet'),
    );

    expect(html).toContain(
      '<ul><li>parent<ul class="task-list"><li class="task-list-item"><label><input class="task-list-checkbox" type="checkbox" data-task-index="0"><span class="task-list-text">child task</span></label></li></ul><ul><li>child bullet</li></ul></li></ul>',
    );
  });

  it('toggles the nested checklist item by document order index', () => {
    const markdown = '- [ ] top\n- bullet\n    - [ ] nested\n- [ ] bottom';

    expect(toggleChecklistItem(markdown, 1, true)).toBe(
      '- [ ] top\n- bullet\n    - [x] nested\n- [ ] bottom',
    );
  });

  it('omits preq-choice blocks from rendered markdown output', () => {
    const html = compactHtml(
      renderMarkdownToHtml(
        [
          '# Before',
          '',
          ':::preq-choice',
          'Which engine should handle this task?',
          '- [ ] Codex',
          '- [x] Claude',
          ':::',
          '',
          'After paragraph',
        ].join('\n'),
      ),
    );

    expect(html).toContain('<h1>Before</h1>');
    expect(html).toContain('<p>After paragraph</p>');
    expect(html).not.toContain('Which engine should handle this task?');
    expect(html).not.toContain(':::preq-choice');
  });

  it('extracts structured artifact lines with valid urls', () => {
    expect(
      extractMarkdownArtifacts(
        [
          '## Prototype',
          '',
          'Artifacts:',
          '- [image] Inbox screenshot | provider=fastio | access=private | url=https://fast.io/s/abc',
          '- [video] Walkthrough | provider=fastio | access=private | url=https://fast.io/s/def',
        ].join('\n'),
      ),
    ).toEqual([
      {
        access: 'private',
        expires: null,
        provider: 'fastio',
        title: 'Inbox screenshot',
        type: 'image',
        url: 'https://fast.io/s/abc',
      },
      {
        access: 'private',
        expires: null,
        provider: 'fastio',
        title: 'Walkthrough',
        type: 'video',
        url: 'https://fast.io/s/def',
      },
    ]);
  });

  it('removes structured artifact lines from rendered markdown body', () => {
    const html = compactHtml(
      renderMarkdownToHtml(
        [
          '# Before',
          '',
          'Artifacts:',
          '- [image] Inbox screenshot | provider=fastio | access=private | url=https://fast.io/s/abc',
          '',
          'After paragraph',
        ].join('\n'),
      ),
    );

    expect(html).toContain('<h1>Before</h1>');
    expect(html).toContain('<p>After paragraph</p>');
    expect(html).not.toContain('Inbox screenshot');
    expect(html).not.toContain('Artifacts:');
  });
});
