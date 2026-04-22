import { $isElementNode, type ElementFormatType, type LexicalNode } from 'lexical';

const SUPPORTED_BLOCK_ALIGNMENT_FORMATS = new Set<ElementFormatType>(['', 'left', 'start']);

function isUnsupportedBlockAlignment(format: ElementFormatType): boolean {
  return !SUPPORTED_BLOCK_ALIGNMENT_FORMATS.has(format);
}

export function normalizeUnsupportedBlockAlignment(node: LexicalNode | null): boolean {
  if (!$isElementNode(node) || node.isInline()) return false;

  let didChange = false;
  if (isUnsupportedBlockAlignment(node.getFormatType())) {
    node.setFormat('');
    didChange = true;
  }

  for (const child of node.getChildren()) {
    if (normalizeUnsupportedBlockAlignment(child)) {
      didChange = true;
    }
  }

  return didChange;
}
