import { $convertToMarkdownString } from '@lexical/markdown';
import { $createHeadingNode, $isHeadingNode, HeadingNode } from '@lexical/rich-text';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  createEditor,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import {
  $applyLiveHeadingShortcut,
  $collapseLiveHeadingSourceNode,
  $createLiveHeadingSourceNode,
  $exitLiveHeadingSourceOnArrowRight,
  $isLiveHeadingSourceNode,
  $revealHeadingAsLiveSource,
  $syncLiveHeadingSourceNode,
  LIVE_HEADING_MARKER_STYLE,
  LIVE_HEADING_SOURCE_TRANSFORMER,
  LiveHeadingSourceNode,
  shouldExitLiveHeadingSourceOnArrowRight,
  shouldPreserveLiveHeadingSourceOnBackspace,
} from '@/lib/live-markdown-heading-source';

describe('lib/live-markdown-heading-source', () => {
  it('reveals a heading as editable markdown source text', () => {
    const editor = createEditor({ nodes: [HeadingNode, LiveHeadingSourceNode] });

    editor.update(
      () => {
        const heading = $createHeadingNode('h3');
        heading.append($createTextNode('Eat rice'));
        $getRoot().append(heading);

        const source = $revealHeadingAsLiveSource(heading);

        expect($isLiveHeadingSourceNode($getRoot().getFirstChild())).toBe(true);
        expect(source.getHeadingTag()).toBe('h3');
        expect(source.getTextContent()).toBe('### Eat rice');
      },
      { discrete: true },
    );
  });

  it('does not consume heading markers when spacing inside editable heading source', () => {
    const editor = createEditor({
      nodes: [HeadingNode, LiveHeadingSourceNode],
      onError: (error) => {
        throw error;
      },
    });

    editor.update(
      () => {
        const source = $createLiveHeadingSourceNode('h2');
        const text = $createTextNode('##Title');
        source.append(text);
        $getRoot().append(source);

        expect($applyLiveHeadingShortcut(source, text, 2)).toBe(false);
        expect(source.getTextContent()).toBe('##Title');
      },
      { discrete: true },
    );
  });

  it('keeps heading space shortcuts for ordinary paragraphs', () => {
    const editor = createEditor({
      nodes: [HeadingNode, LiveHeadingSourceNode],
      onError: (error) => {
        throw error;
      },
    });

    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        const text = $createTextNode('##Title');
        paragraph.append(text);
        $getRoot().append(paragraph);

        expect($applyLiveHeadingShortcut(paragraph, text, 2)).toBe(true);
        const heading = $getRoot().getFirstChild();

        expect($isHeadingNode(heading)).toBe(true);
        if (!$isHeadingNode(heading)) return;
        expect(heading.getTag()).toBe('h2');
        expect(heading.getTextContent()).toBe('Title');
      },
      { discrete: true },
    );
  });

  it('collapses edited heading source to the matching heading level', () => {
    const editor = createEditor({ nodes: [HeadingNode, LiveHeadingSourceNode] });

    editor.update(
      () => {
        const source = $createLiveHeadingSourceNode('h3');
        source.append($createTextNode('## Eat rice'));
        $getRoot().append(source);

        const collapsed = $collapseLiveHeadingSourceNode(source);

        expect($isHeadingNode(collapsed)).toBe(true);
        if (!$isHeadingNode(collapsed)) return;
        expect(collapsed.getTag()).toBe('h2');
        expect(collapsed.getTextContent()).toBe('Eat rice');
      },
      { discrete: true },
    );
  });

  it('syncs the editable source level from the current marker count', () => {
    const editor = createEditor({ nodes: [HeadingNode, LiveHeadingSourceNode] });

    editor.update(
      () => {
        const source = $createLiveHeadingSourceNode('h3');
        source.append($createTextNode('# Eat rice'));
        $getRoot().append(source);

        expect($syncLiveHeadingSourceNode(source)).toBe(true);
        expect(source.getHeadingTag()).toBe('h1');
      },
      { discrete: true },
    );
  });

  it('allows ArrowRight to leave a revealed heading source only at the collapsed end position', () => {
    expect(
      shouldExitLiveHeadingSourceOnArrowRight({
        cursor: '### Eat rice'.length,
        selectionLength: 0,
        textLength: '### Eat rice'.length,
      }),
    ).toBe(true);

    expect(
      shouldExitLiveHeadingSourceOnArrowRight({
        cursor: '### Eat rice'.length - 1,
        selectionLength: 0,
        textLength: '### Eat rice'.length,
      }),
    ).toBe(false);
  });

  it('keeps a revealed heading source intact when backspace is pressed at block start', () => {
    const editor = createEditor({ nodes: [HeadingNode, LiveHeadingSourceNode] });

    editor.update(
      () => {
        const source = $createLiveHeadingSourceNode('h3');
        source.append($createTextNode('### Eat rice'));
        $getRoot().append(source);

        expect(
          shouldPreserveLiveHeadingSourceOnBackspace({
            cursor: 0,
            selectionLength: 0,
          }),
        ).toBe(true);
        expect($isLiveHeadingSourceNode($getRoot().getFirstChild())).toBe(true);
        expect(source.getHeadingTag()).toBe('h3');
        expect(source.getTextContent()).toBe('### Eat rice');
      },
      { discrete: true },
    );
  });

  it('collapses the active heading source before moving selection into the next block', () => {
    const editor = createEditor({ nodes: [HeadingNode, LiveHeadingSourceNode] });

    editor.update(
      () => {
        const heading = $createHeadingNode('h3');
        heading.append($createTextNode('Eat rice'));
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('After paragraph'));
        $getRoot().append(heading, paragraph);

        const source = $revealHeadingAsLiveSource(heading);
        source.selectEnd();

        expect($exitLiveHeadingSourceOnArrowRight(source)).toBe(true);

        const collapsedHeading = $getRoot().getFirstChild();
        expect($isHeadingNode(collapsedHeading)).toBe(true);
        if (!$isHeadingNode(collapsedHeading)) return;

        expect(collapsedHeading.getTag()).toBe('h3');
        expect(collapsedHeading.getTextContent()).toBe('Eat rice');

        const selection = $getSelection();
        expect($isRangeSelection(selection)).toBe(true);
        if (!$isRangeSelection(selection)) return;

        expect(selection.anchor.getNode().getTopLevelElement()?.getTextContent()).toBe(
          'After paragraph',
        );
      },
      { discrete: true },
    );
  });

  it('styles only the visible heading marker as muted source text', () => {
    const editor = createEditor({ nodes: [HeadingNode, LiveHeadingSourceNode] });

    editor.update(
      () => {
        const source = $createLiveHeadingSourceNode('h3');
        source.append($createTextNode('### Eat rice'));
        $getRoot().append(source);

        expect($syncLiveHeadingSourceNode(source)).toBe(true);
        const [markerNode, restNode] = source.getChildren();

        expect(markerNode?.getTextContent()).toBe('###');
        expect(restNode?.getTextContent()).toBe(' Eat rice');
        expect($isTextNode(markerNode) ? markerNode.getStyle() : '').toBe(
          LIVE_HEADING_MARKER_STYLE,
        );
        expect($isTextNode(restNode) ? restNode.getStyle() : '').toBe('');
      },
      { discrete: true },
    );
  });

  it('collapses source without a heading marker back to a paragraph', () => {
    const editor = createEditor({ nodes: [HeadingNode, LiveHeadingSourceNode] });

    editor.update(
      () => {
        const source = $createLiveHeadingSourceNode('h1');
        source.append($createTextNode('Eat rice'));
        $getRoot().append(source);

        const collapsed = $collapseLiveHeadingSourceNode(source);

        expect($isParagraphNode(collapsed)).toBe(true);
        expect(collapsed.getTextContent()).toBe('Eat rice');
      },
      { discrete: true },
    );
  });

  it('exports active heading source as markdown text', () => {
    const editor = createEditor({ nodes: [LiveHeadingSourceNode] });
    let markdown = '';

    editor.update(
      () => {
        const source = $createLiveHeadingSourceNode('h3');
        source.append($createTextNode('### Eat rice'));
        $getRoot().append(source);

        markdown = $convertToMarkdownString([LIVE_HEADING_SOURCE_TRANSFORMER]);
      },
      { discrete: true },
    );

    expect(markdown).toBe('### Eat rice');
  });
});
