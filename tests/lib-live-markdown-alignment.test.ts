import { $createListItemNode, $createListNode, ListItemNode, ListNode } from '@lexical/list';
import { $createHeadingNode, HeadingNode } from '@lexical/rich-text';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
  type ElementFormatType,
  ParagraphNode,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import { normalizeUnsupportedBlockAlignment } from '@/lib/live-markdown-alignment';

describe('lib/live-markdown-alignment', () => {
  it.each(['center', 'right', 'justify', 'end'] satisfies ElementFormatType[])(
    'resets unsupported %s block alignment recursively',
    (format) => {
      const editor = createEditor({ nodes: [HeadingNode, ListNode, ListItemNode] });
      let changed = false;

      editor.update(
        () => {
          const root = $getRoot();
          const heading = $createHeadingNode('h2');
          heading.setFormat(format);
          heading.append($createTextNode('Heading'));

          const list = $createListNode('bullet');
          const listItem = $createListItemNode();
          listItem.setFormat(format);
          listItem.append($createTextNode('Checklist item'));
          list.append(listItem);

          root.append(heading, list);
          changed = normalizeUnsupportedBlockAlignment(root);
        },
        { discrete: true },
      );

      editor.getEditorState().read(() => {
        const root = $getRoot();
        const heading = root.getFirstChildOrThrow<HeadingNode>();
        const list = root.getLastChildOrThrow<ListNode>();
        const listItem = list.getFirstChildOrThrow<ListItemNode>();

        expect(changed).toBe(true);
        expect(heading.getFormatType()).toBe('');
        expect(listItem.getFormatType()).toBe('');
        expect(list.getListType()).toBe('bullet');
        expect(list.getFirstChild()?.getTextContent()).toBe('Checklist item');
      });
    },
  );

  it.each(['', 'left', 'start'] satisfies ElementFormatType[])(
    'keeps supported %s block alignment unchanged',
    (format) => {
      const editor = createEditor();
      let changed = false;

      editor.update(
        () => {
          const root = $getRoot();
          const paragraph = $createParagraphNode();
          paragraph.setFormat(format);
          paragraph.append($createTextNode('Paragraph'));
          root.append(paragraph);
          changed = normalizeUnsupportedBlockAlignment(root);
        },
        { discrete: true },
      );

      editor.getEditorState().read(() => {
        const paragraph = $getRoot().getFirstChildOrThrow<ParagraphNode>();
        expect(changed).toBe(false);
        expect(paragraph.getFormatType()).toBe(format);
      });
    },
  );
});
