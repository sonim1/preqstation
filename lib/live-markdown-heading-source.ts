import { type ElementTransformer } from '@lexical/markdown';
import { $createHeadingNode, HeadingNode, type HeadingTagType } from '@lexical/rich-text';
import {
  $applyNodeReplacement,
  $createParagraphNode,
  $createTextNode,
  $isElementNode,
  $isParagraphNode,
  $isTextNode,
  type EditorConfig,
  ElementNode,
  type LexicalNode,
  type NodeKey,
  ParagraphNode,
  type SerializedParagraphNode,
  type Spread,
} from 'lexical';

export const LIVE_HEADING_MARKER_STYLE = 'color: var(--live-editor-heading-marker-color);';
export const LIVE_HEADING_SOURCE_SYNC_TAG = 'live-heading-source-sync';

type SerializedLiveHeadingSourceNode = Spread<
  {
    headingTag: HeadingTagType;
  },
  SerializedParagraphNode
>;

type ParsedHeadingSource = {
  markerLength: number;
  prefixLength: number;
  tag: HeadingTagType;
};

const NEVER_MATCH_HEADING_SOURCE_IMPORT = /(?!)/;

export class LiveHeadingSourceNode extends ParagraphNode {
  __headingTag: HeadingTagType;

  static getType(): string {
    return 'live-heading-source';
  }

  static clone(node: LiveHeadingSourceNode): LiveHeadingSourceNode {
    return new LiveHeadingSourceNode(node.__headingTag, node.__key);
  }

  constructor(headingTag: HeadingTagType, key?: NodeKey) {
    super(key);
    this.__headingTag = headingTag;
  }

  getHeadingTag(): HeadingTagType {
    return (this.getLatest() as LiveHeadingSourceNode).__headingTag;
  }

  setHeadingTag(headingTag: HeadingTagType): LiveHeadingSourceNode {
    const self = this.getWritable() as LiveHeadingSourceNode;
    self.__headingTag = headingTag;
    return self;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    element.dataset.liveEditorHeadingSource = this.__headingTag;
    return element;
  }

  updateDOM(prevNode: LiveHeadingSourceNode, dom: HTMLElement, config: EditorConfig): boolean {
    const shouldReplace = super.updateDOM(prevNode, dom, config);
    if (prevNode.__headingTag !== this.__headingTag) {
      dom.dataset.liveEditorHeadingSource = this.__headingTag;
    }
    return shouldReplace;
  }

  static importJSON(serializedNode: SerializedLiveHeadingSourceNode): LiveHeadingSourceNode {
    const node = $createLiveHeadingSourceNode(serializedNode.headingTag);
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    node.setTextFormat(serializedNode.textFormat);
    node.setTextStyle(serializedNode.textStyle);
    return node;
  }

  exportJSON(): SerializedLiveHeadingSourceNode {
    return {
      ...super.exportJSON(),
      headingTag: this.getHeadingTag(),
      type: 'live-heading-source',
      version: 1,
    };
  }
}

export function $createLiveHeadingSourceNode(headingTag: HeadingTagType): LiveHeadingSourceNode {
  return $applyNodeReplacement(new LiveHeadingSourceNode(headingTag));
}

export function $isLiveHeadingSourceNode(
  node: LexicalNode | null | undefined,
): node is LiveHeadingSourceNode {
  return node instanceof LiveHeadingSourceNode;
}

export function getMarkdownHeadingMarker(tag: HeadingTagType): string {
  return '#'.repeat(Number(tag.slice(1)));
}

export function parseMarkdownHeadingSource(source: string): ParsedHeadingSource | null {
  const match = /^(#{1,6})(?:([ \t]+)(.*)|[ \t]*)$/.exec(source);
  if (!match) return null;

  const marker = match[1];
  const whitespace = match[2] ?? '';
  const tag = `h${marker.length}` as HeadingTagType;

  return {
    markerLength: marker.length,
    prefixLength: marker.length + whitespace.length,
    tag,
  };
}

function copyBlockFormat(from: ElementNode, to: ElementNode) {
  to.setDirection(from.getDirection());
  to.setFormat(from.getFormatType());
  to.setIndent(from.getIndent());
}

export function $revealHeadingAsLiveSource(heading: HeadingNode): LiveHeadingSourceNode {
  const source = $createLiveHeadingSourceNode(heading.getTag());
  const marker = $createTextNode(getMarkdownHeadingMarker(heading.getTag()));
  marker.setStyle(LIVE_HEADING_MARKER_STYLE);
  copyBlockFormat(heading, source);
  source.append(marker);
  source.append($createTextNode(' '));
  source.append(...heading.getChildren());
  heading.replace(source);
  return source;
}

function applyStyleIfChanged(node: ReturnType<typeof $createTextNode>, style: string): boolean {
  if (node.getStyle() === style) return false;
  node.setStyle(style);
  return true;
}

function $syncLiveHeadingMarkerStyle(source: LiveHeadingSourceNode, markerLength: number): boolean {
  let didChange = false;
  let offset = 0;

  for (const child of source.getChildren()) {
    const childTextSize = child.getTextContentSize();

    if (!$isTextNode(child)) {
      offset += childTextSize;
      continue;
    }

    const childStart = offset;
    const childEnd = offset + childTextSize;

    if (childStart < markerLength && childEnd > markerLength) {
      const [markerPart, restPart] = child.splitText(markerLength - childStart);
      didChange = true;
      didChange = applyStyleIfChanged(markerPart, LIVE_HEADING_MARKER_STYLE) || didChange;
      if (restPart.getStyle() === LIVE_HEADING_MARKER_STYLE) {
        restPart.setStyle('');
        didChange = true;
      }
    } else if (childEnd <= markerLength) {
      didChange = applyStyleIfChanged(child, LIVE_HEADING_MARKER_STYLE) || didChange;
    } else if (child.getStyle() === LIVE_HEADING_MARKER_STYLE) {
      child.setStyle('');
      didChange = true;
    }

    offset = childEnd;
  }

  return didChange;
}

export function $syncLiveHeadingSourceNode(source: LiveHeadingSourceNode): boolean {
  const parsedHeading = parseMarkdownHeadingSource(source.getTextContent());
  let didChange = false;

  if (parsedHeading && source.getHeadingTag() !== parsedHeading.tag) {
    source.setHeadingTag(parsedHeading.tag);
    didChange = true;
  }

  return $syncLiveHeadingMarkerStyle(source, parsedHeading?.markerLength ?? 0) || didChange;
}

export function shouldExitLiveHeadingSourceOnArrowRight(params: {
  cursor: number;
  selectionLength: number;
  textLength: number;
}) {
  return params.selectionLength === 0 && params.cursor === params.textLength;
}

export function shouldPreserveLiveHeadingSourceOnBackspace(params: {
  cursor: number;
  selectionLength: number;
}) {
  return params.selectionLength === 0 && params.cursor === 0;
}

export function $applyLiveHeadingShortcut(
  parentNode: ElementNode,
  anchorNode: LexicalNode,
  anchorOffset: number,
): boolean {
  if (!$isParagraphNode(parentNode) || $isLiveHeadingSourceNode(parentNode)) return false;
  if (!$isTextNode(anchorNode) || parentNode.getFirstChild() !== anchorNode) return false;

  const marker = anchorNode.getTextContent().slice(0, anchorOffset);
  const match = /^(#{1,6})$/.exec(marker);
  if (!match) return false;

  const heading = $createHeadingNode(`h${match[1].length}` as HeadingTagType);
  const trailingText = anchorNode.getTextContent().slice(anchorOffset);
  const nextSiblings = anchorNode.getNextSiblings();

  copyBlockFormat(parentNode, heading);

  if (trailingText) {
    anchorNode.spliceText(0, anchorOffset, '');
    heading.append(anchorNode);
  } else {
    anchorNode.remove();
  }

  heading.append(...nextSiblings);
  parentNode.replace(heading);
  heading.selectStart();

  return true;
}

function appendChildrenSkippingLeadingCharacters(
  source: ElementNode,
  target: ElementNode,
  charactersToSkip: number,
) {
  let remainingCharacters = charactersToSkip;

  for (const child of source.getChildren()) {
    if (remainingCharacters <= 0) {
      target.append(child);
      continue;
    }

    const childTextSize = child.getTextContentSize();
    if (childTextSize <= remainingCharacters) {
      child.remove();
      remainingCharacters -= childTextSize;
      continue;
    }

    if ($isTextNode(child)) {
      child.spliceText(0, remainingCharacters, '');
      target.append(child);
      remainingCharacters = 0;
      continue;
    }

    target.append($createTextNode(child.getTextContent().slice(remainingCharacters)));
    child.remove();
    remainingCharacters = 0;
  }
}

export function $collapseLiveHeadingSourceNode(
  source: LiveHeadingSourceNode,
): HeadingNode | ParagraphNode {
  const parsedHeading = parseMarkdownHeadingSource(source.getTextContent());
  const nextNode = parsedHeading ? $createHeadingNode(parsedHeading.tag) : $createParagraphNode();

  copyBlockFormat(source, nextNode);
  appendChildrenSkippingLeadingCharacters(source, nextNode, parsedHeading?.prefixLength ?? 0);
  source.replace(nextNode);

  return nextNode;
}

export function $exitLiveHeadingSourceOnArrowRight(source: LiveHeadingSourceNode) {
  $syncLiveHeadingSourceNode(source);
  const collapsedNode = $collapseLiveHeadingSourceNode(source);
  const nextSibling = collapsedNode.getNextSibling();

  if ($isElementNode(nextSibling)) {
    nextSibling.selectStart();
    return true;
  }

  collapsedNode.selectEnd();
  return true;
}

export const LIVE_HEADING_SOURCE_TRANSFORMER: ElementTransformer = {
  dependencies: [LiveHeadingSourceNode],
  export: (node) => ($isLiveHeadingSourceNode(node) ? node.getTextContent() : null),
  regExp: NEVER_MATCH_HEADING_SOURCE_IMPORT,
  replace: () => false,
  type: 'element',
};
