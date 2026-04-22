export type MarkdownShortcutResult = {
  nextMarkdown: string;
  nextCursor: number;
};

type CurrentLineInfo = {
  currentLine: string;
  lineEnd: number;
  lineStart: number;
};

const CHECKLIST_LINE_REGEX = /^(\s*- \[[ xX]\] )(.*)$/;
const BULLET_LINE_REGEX = /^(\s*- )(.*)$/;
const LIST_LINE_REGEX = /^(\s*)(- (?:\[[ xX]\] )?)(.*)$/;
const LEADING_INDENT_REGEX = /^( +)(.*)$/;
const STRUCTURED_LIST_INDENT = '    ';
const PLAIN_TEXT_INDENT = '  ';

function getCurrentLineInfo(markdown: string, cursor: number): CurrentLineInfo {
  const lineStart = markdown.lastIndexOf('\n', Math.max(cursor - 1, 0)) + 1;
  const nextNewline = markdown.indexOf('\n', cursor);
  const lineEnd = nextNewline === -1 ? markdown.length : nextNewline;

  return {
    currentLine: markdown.slice(lineStart, lineEnd),
    lineEnd,
    lineStart,
  };
}

function findPreviousNonEmptyLine(markdown: string, lineStart: number) {
  if (lineStart === 0) return null;

  const previousLines = markdown.slice(0, Math.max(lineStart - 1, 0)).split('\n');

  for (let index = previousLines.length - 1; index >= 0; index -= 1) {
    if (previousLines[index].trim()) {
      return previousLines[index];
    }
  }

  return null;
}

export function applyMarkdownEnterShortcut(
  markdown: string,
  cursor: number,
): MarkdownShortcutResult | null {
  const { currentLine, lineStart } = getCurrentLineInfo(markdown, cursor);

  const checklistMatch = currentLine.match(CHECKLIST_LINE_REGEX);
  if (checklistMatch) {
    const [, prefix, content] = checklistMatch;
    if (!content.trim()) {
      return {
        nextCursor: lineStart,
        nextMarkdown: markdown.slice(0, lineStart) + markdown.slice(cursor),
      };
    }

    const indent = prefix.match(/^\s*/)?.[0] ?? '';
    const insertion = `\n${indent}- [ ] `;

    return {
      nextCursor: cursor + insertion.length,
      nextMarkdown: markdown.slice(0, cursor) + insertion + markdown.slice(cursor),
    };
  }

  const bulletMatch = currentLine.match(BULLET_LINE_REGEX);
  if (!bulletMatch) return null;

  const [, prefix, content] = bulletMatch;
  if (!content.trim()) {
    return {
      nextCursor: lineStart,
      nextMarkdown: markdown.slice(0, lineStart) + markdown.slice(cursor),
    };
  }

  const insertion = `\n${prefix}`;

  return {
    nextCursor: cursor + insertion.length,
    nextMarkdown: markdown.slice(0, cursor) + insertion + markdown.slice(cursor),
  };
}

export function applyMarkdownTabShortcut(
  markdown: string,
  cursor: number,
): MarkdownShortcutResult | null {
  const { currentLine, lineEnd, lineStart } = getCurrentLineInfo(markdown, cursor);
  const listMatch = currentLine.match(LIST_LINE_REGEX);
  if (!listMatch) return null;

  const [, indent, marker, content] = listMatch;
  const previousLine = findPreviousNonEmptyLine(markdown, lineStart);
  const previousListMatch = previousLine?.match(LIST_LINE_REGEX) ?? null;

  const nextIndent =
    previousListMatch && previousListMatch[1] === indent
      ? `${indent}${STRUCTURED_LIST_INDENT}`
      : `${indent}${PLAIN_TEXT_INDENT}`;
  const nextLine = `${nextIndent}${marker}${content}`;

  return {
    nextCursor: cursor + (nextIndent.length - indent.length),
    nextMarkdown: `${markdown.slice(0, lineStart)}${nextLine}${markdown.slice(lineEnd)}`,
  };
}

function getOutdentWidth(indentLength: number) {
  if (
    indentLength >= STRUCTURED_LIST_INDENT.length &&
    indentLength % STRUCTURED_LIST_INDENT.length === 0
  ) {
    return STRUCTURED_LIST_INDENT.length;
  }

  return Math.min(indentLength, PLAIN_TEXT_INDENT.length);
}

export function applyMarkdownShiftTabShortcut(
  markdown: string,
  cursor: number,
): MarkdownShortcutResult | null {
  const { currentLine, lineEnd, lineStart } = getCurrentLineInfo(markdown, cursor);
  const listMatch = currentLine.match(LIST_LINE_REGEX);

  if (listMatch) {
    const [, indent, marker, content] = listMatch;
    if (!indent) return null;

    const outdentWidth = getOutdentWidth(indent.length);
    const nextIndent = indent.slice(outdentWidth);

    return {
      nextCursor: Math.max(lineStart, cursor - outdentWidth),
      nextMarkdown: `${markdown.slice(0, lineStart)}${nextIndent}${marker}${content}${markdown.slice(lineEnd)}`,
    };
  }

  const plainIndentMatch = currentLine.match(LEADING_INDENT_REGEX);
  if (!plainIndentMatch) return null;

  const [, indent, content] = plainIndentMatch;
  const outdentWidth = getOutdentWidth(indent.length);

  return {
    nextCursor: Math.max(lineStart, cursor - outdentWidth),
    nextMarkdown: `${markdown.slice(0, lineStart)}${indent.slice(outdentWidth)}${content}${markdown.slice(lineEnd)}`,
  };
}
