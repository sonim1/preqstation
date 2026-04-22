import { CodeNode } from '@lexical/code';
import { $createParagraphNode, $createTextNode } from 'lexical';

const CLOSING_FENCE_LINE = /^```(?:\s+)?$/;

export function detectClosedCodeFence(codeBlockText: string) {
  const lines = codeBlockText.replace(/\r\n/g, '\n').split('\n');
  const closingFenceIndex = lines.findIndex((line) => CLOSING_FENCE_LINE.test(line.trim()));

  if (closingFenceIndex < 0) {
    return null;
  }

  return {
    code: lines.slice(0, closingFenceIndex).join('\n'),
    trailingMarkdown: lines.slice(closingFenceIndex + 1).join('\n'),
  };
}

export function shouldExitCodeBlockOnArrowRight(params: {
  cursor: number;
  selectionLength: number;
  textLength: number;
}) {
  return params.selectionLength === 0 && params.cursor === params.textLength;
}

export function splitCodeNodeAtClosingFence(codeNode: CodeNode) {
  const parsed = detectClosedCodeFence(codeNode.getTextContent());
  if (!parsed) {
    return null;
  }

  codeNode.clear();

  if (parsed.code) {
    codeNode.append($createTextNode(parsed.code));
  }

  const paragraph = $createParagraphNode();

  if (parsed.trailingMarkdown) {
    paragraph.append($createTextNode(parsed.trailingMarkdown));
  }

  codeNode.insertAfter(paragraph);
  return paragraph;
}
