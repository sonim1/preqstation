function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeLink(url: string) {
  try {
    const parsed = new URL(url, 'https://example.local');
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href.replace('https://example.local', '');
    }
    return null;
  } catch {
    return null;
  }
}

export type MarkdownArtifact = {
  access: string | null;
  expires: string | null;
  provider: string | null;
  title: string;
  type: 'document' | 'image' | 'video';
  url: string;
};

const checklistLineRegex = /^(\s*[-*]\s+\[)( |x|X)(\]\s+.*)$/;
const orderedListItemRegex = /^(\d{1,})\.\s+.+$/;
const markdownHeadingLineRegex = /^(#{1,6})[ \t]+.*$/;
const markdownQuoteLineRegex = /^>\s?.*$/;
const fencedCodeBlockLineRegex = /^```/;
const preqChoiceBlockOpen = ':::preq-choice';
const preqChoiceBlockClose = ':::';
const artifactSectionLabel = 'Artifacts:';
const artifactLineRegex = /^-\s+\[(image|video|document)\]\s+([^|]+?)(?:\s*\|\s*(.+))?$/i;

type MarkdownBlock =
  | {
      content: string;
      level: number;
      type: 'heading';
    }
  | {
      content: string;
      type: 'paragraph';
    }
  | MarkdownList;

type MarkdownList = {
  items: MarkdownListItem[];
  listType: 'bullet' | 'check';
  type: 'list';
};

type MarkdownListItem = {
  checked: boolean;
  children: MarkdownList[];
  content: string;
};

const checklistItemRegex = /^[-*]\s+\[( |x|X)\]\s+(.+)$/;
const bulletListItemRegex = /^[-*]\s+(.+)$/;

type HeadingParagraphBoundary = {
  blankLineCount: number;
};

function countLeadingIndent(value: string) {
  let width = 0;

  for (const char of value) {
    if (char === ' ') {
      width += 1;
      continue;
    }

    if (char === '\t') {
      width += 4;
      continue;
    }

    break;
  }

  return width;
}

function isMarkdownHeadingLine(line: string) {
  return markdownHeadingLineRegex.test(line);
}

function isMarkdownParagraphBoundaryLine(line: string) {
  if (!line.trim()) return false;

  const trimmedStart = line.trimStart();

  if (isMarkdownHeadingLine(line)) return false;
  if (markdownQuoteLineRegex.test(trimmedStart)) return false;
  if (fencedCodeBlockLineRegex.test(trimmedStart)) return false;
  if (checklistItemRegex.test(trimmedStart)) return false;
  if (bulletListItemRegex.test(trimmedStart)) return false;
  if (orderedListItemRegex.test(trimmedStart)) return false;
  if (/^(?: {4}|\t)/.test(line)) return false;

  return true;
}

function getHeadingParagraphBoundaries(source: string) {
  const boundaries: HeadingParagraphBoundary[] = [];
  const lines = source.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    if (!isMarkdownHeadingLine(lines[index])) continue;

    let cursor = index + 1;
    let blankLineCount = 0;

    while (cursor < lines.length && lines[cursor].trim() === '') {
      blankLineCount += 1;
      cursor += 1;
    }

    if (cursor < lines.length && isMarkdownParagraphBoundaryLine(lines[cursor])) {
      boundaries.push({ blankLineCount });
    }
  }

  return boundaries;
}

export function preserveTightHeadingParagraphSpacing(
  currentMarkdown: string,
  nextMarkdown: string,
) {
  if (!currentMarkdown || !nextMarkdown) return nextMarkdown;

  const normalizedCurrent = currentMarkdown.replace(/\r\n/g, '\n');
  const normalizedNext = nextMarkdown.replace(/\r\n/g, '\n');
  const currentBoundaries = getHeadingParagraphBoundaries(normalizedCurrent);

  if (currentBoundaries.length === 0) {
    return nextMarkdown;
  }

  const nextLineEnding = nextMarkdown.includes('\r\n') ? '\r\n' : '\n';
  const nextLines = normalizedNext.split('\n');
  const reconciledLines: string[] = [];
  let boundaryIndex = 0;
  let didChange = false;

  for (let index = 0; index < nextLines.length; index += 1) {
    const line = nextLines[index];
    reconciledLines.push(line);

    if (!isMarkdownHeadingLine(line)) {
      continue;
    }

    let cursor = index + 1;
    let blankLineCount = 0;

    while (cursor < nextLines.length && nextLines[cursor].trim() === '') {
      blankLineCount += 1;
      cursor += 1;
    }

    if (cursor >= nextLines.length || !isMarkdownParagraphBoundaryLine(nextLines[cursor])) {
      continue;
    }

    const currentBoundary = currentBoundaries[boundaryIndex];
    boundaryIndex += 1;

    if (blankLineCount === 0 || currentBoundary?.blankLineCount !== 0) {
      continue;
    }

    didChange = true;
    index = cursor - 1;
  }

  if (!didChange) {
    return nextMarkdown;
  }

  return reconciledLines.join(nextLineEnding);
}

function parseMarkdownBlocks(source: string) {
  const blocks: MarkdownBlock[] = [];
  const listStack: MarkdownList[] = [];
  const listOwnerStack: MarkdownListItem[] = [];

  function resetListState() {
    listStack.length = 0;
    listOwnerStack.length = 0;
  }

  function addListItem(level: number, listType: MarkdownList['listType'], item: MarkdownListItem) {
    while (listStack.length > level + 1) {
      listStack.pop();
      listOwnerStack.pop();
    }

    if (level > listStack.length) return false;

    let container = listStack[level];

    if (!container || container.listType !== listType) {
      container = { type: 'list', listType, items: [] };

      if (level === 0) {
        blocks.push(container);
      } else {
        const owner = listOwnerStack[level - 1];
        if (!owner) return false;
        owner.children.push(container);
      }

      listStack[level] = container;
    }

    listStack.length = level + 1;
    listOwnerStack.length = level;

    container.items.push(item);
    listOwnerStack[level] = item;

    return true;
  }

  for (const rawLine of source.split('\n')) {
    if (!rawLine.trim()) {
      resetListState();
      continue;
    }

    const leadingWhitespace = rawLine.match(/^\s*/)?.[0] ?? '';
    const indentWidth = countLeadingIndent(leadingWhitespace);
    const content = rawLine.slice(leadingWhitespace.length);
    const listLevel = indentWidth / 4;

    if (indentWidth % 4 === 0) {
      const checklistItem = content.match(checklistItemRegex);
      if (checklistItem) {
        const [, checkedMark, itemContent] = checklistItem;
        if (
          addListItem(listLevel, 'check', {
            checked: checkedMark.toLowerCase() === 'x',
            children: [],
            content: itemContent,
          })
        ) {
          continue;
        }
      }

      const bulletItem = content.match(bulletListItemRegex);
      if (bulletItem) {
        if (
          addListItem(listLevel, 'bullet', {
            checked: false,
            children: [],
            content: bulletItem[1],
          })
        ) {
          continue;
        }
      }
    }

    resetListState();

    if (indentWidth === 0) {
      const heading = content.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        blocks.push({ type: 'heading', level: heading[1].length, content: heading[2] });
        continue;
      }
    }

    blocks.push({ type: 'paragraph', content: rawLine });
  }

  return blocks;
}

function formatInline(input: string) {
  const escaped = escapeHtml(input);

  const withCode = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  const withBold = withCode.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const withItalic = withBold.replace(/(^|\s)\*([^*]+)\*(?=\s|$)/g, '$1<em>$2</em>');

  return withItalic.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, url: string) => {
    const safe = sanitizeLink(url.trim());
    if (!safe) return label;
    return `<a href="${escapeHtml(safe)}" target="_blank" rel="noreferrer">${label}</a>`;
  });
}

function parseArtifactMetadata(raw: string | undefined) {
  const fields = new Map<string, string>();

  for (const segment of (raw ?? '').split('|')) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim().toLowerCase();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || !value) continue;
    fields.set(key, value);
  }

  return fields;
}

function parseArtifactLine(line: string): MarkdownArtifact | null {
  const match = line.match(artifactLineRegex);
  if (!match) return null;

  const [, type, rawTitle, rawMetadata] = match;
  const metadata = parseArtifactMetadata(rawMetadata);
  const url = metadata.get('url');
  const safeUrl = url ? sanitizeLink(url) : null;
  if (!safeUrl) return null;

  return {
    access: metadata.get('access') ?? null,
    expires: metadata.get('expires') ?? metadata.get('expiration') ?? null,
    provider: metadata.get('provider') ?? null,
    title: rawTitle.trim(),
    type: type.toLowerCase() as MarkdownArtifact['type'],
    url: safeUrl,
  };
}

function splitMarkdownArtifacts(markdown?: string | null) {
  const source = markdown ?? '';
  if (!source) {
    return { artifacts: [] as MarkdownArtifact[], markdown: '' };
  }

  const lineEnding = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const keptLines: string[] = [];
  const artifacts: MarkdownArtifact[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.trim() !== artifactSectionLabel) {
      keptLines.push(line);
      continue;
    }

    const blockLines: string[] = [line];
    const blockArtifacts: MarkdownArtifact[] = [];
    let cursor = index + 1;

    while (cursor < lines.length) {
      const candidate = lines[cursor];
      const trimmed = candidate.trim();
      if (!trimmed) {
        blockLines.push(candidate);
        cursor += 1;
        continue;
      }
      if (!trimmed.startsWith('- ')) {
        break;
      }
      blockLines.push(candidate);
      const artifact = parseArtifactLine(trimmed);
      if (artifact) {
        blockArtifacts.push(artifact);
      }
      cursor += 1;
    }

    if (blockArtifacts.length === 0) {
      keptLines.push(...blockLines);
    } else {
      artifacts.push(...blockArtifacts);
      while (keptLines.at(-1)?.trim() === '') {
        keptLines.pop();
      }
    }

    index = cursor - 1;
  }

  const compactedLines: string[] = [];
  for (const line of keptLines) {
    const isBlank = line.trim() === '';
    const previousIsBlank = compactedLines.at(-1)?.trim() === '';
    if (isBlank && previousIsBlank) continue;
    compactedLines.push(line);
  }

  return {
    artifacts,
    markdown: compactedLines.join(lineEnding).trim(),
  };
}

export function extractMarkdownArtifacts(markdown?: string | null) {
  return splitMarkdownArtifacts(markdown).artifacts;
}

export function stripPreqChoiceBlocks(markdown?: string | null) {
  const source = markdown ?? '';
  if (!source) return '';

  const lineEnding = source.includes('\r\n') ? '\r\n' : '\n';
  const normalized = source.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const keptLines: string[] = [];
  let removedBlock = false;
  let insideBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!insideBlock && trimmed === preqChoiceBlockOpen) {
      insideBlock = true;
      removedBlock = true;
      continue;
    }

    if (insideBlock) {
      if (trimmed === preqChoiceBlockClose) {
        insideBlock = false;
      }
      continue;
    }

    keptLines.push(line);
  }

  if (!removedBlock) {
    return source;
  }

  const compactedLines: string[] = [];

  for (const line of keptLines) {
    const isBlank = line.trim() === '';
    const previousIsBlank = compactedLines.at(-1)?.trim() === '';
    if (isBlank && previousIsBlank) continue;
    compactedLines.push(line);
  }

  while (compactedLines[0]?.trim() === '') {
    compactedLines.shift();
  }

  while (compactedLines.at(-1)?.trim() === '') {
    compactedLines.pop();
  }

  return compactedLines.join(lineEnding);
}

export function getOrderedListBlocksForImport(markdown?: string | null) {
  const source = stripPreqChoiceBlocks(markdown).replace(/\r\n/g, '\n');
  const blocks: Array<{ indent: number; itemCount: number; start: number }> = [];
  let currentBlock: (typeof blocks)[number] | null = null;

  for (const line of source.split('\n')) {
    if (!line.trim()) {
      currentBlock = null;
      continue;
    }

    const orderedListItem = line.match(orderedListItemRegex);
    if (orderedListItem) {
      if (!currentBlock) {
        currentBlock = { indent: 0, itemCount: 0, start: Number(orderedListItem[1]) };
        blocks.push(currentBlock);
      }

      currentBlock.itemCount += 1;
      continue;
    }

    if (currentBlock && /^\s+/.test(line)) {
      continue;
    }

    currentBlock = null;
  }

  return blocks;
}

export function toggleChecklistItem(markdown: string, taskIndex: number, checked: boolean) {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let currentIndex = 0;

  const nextLines = lines.map((line) => {
    const match = line.match(checklistLineRegex);
    if (!match) return line;

    if (currentIndex !== taskIndex) {
      currentIndex += 1;
      return line;
    }

    currentIndex += 1;
    return `${match[1]}${checked ? 'x' : ' '}${match[3]}`;
  });

  return nextLines.join('\n');
}

export function renderMarkdownToHtml(markdown?: string | null) {
  const source = splitMarkdownArtifacts(stripPreqChoiceBlocks(markdown)).markdown.replace(
    /\r\n/g,
    '\n',
  );
  if (!source.trim()) return '<p class="muted">No content.</p>';

  let checklistIndex = 0;

  function renderList(list: MarkdownList): string {
    const className = list.listType === 'check' ? ' class="task-list"' : '';

    return `<ul${className}>${list.items
      .map((item) => {
        if (list.listType === 'check') {
          const taskIndex = checklistIndex;
          checklistIndex += 1;
          const childrenHtml = item.children.map(renderList).join('');
          const itemHtml = `<li class="task-list-item"><label><input class="task-list-checkbox" type="checkbox" data-task-index="${taskIndex}"${
            item.checked ? ' checked' : ''
          }><span class="task-list-text">${formatInline(item.content)}</span></label>${childrenHtml}</li>`;
          return itemHtml;
        }

        const childrenHtml = item.children.map(renderList).join('');
        return `<li>${formatInline(item.content)}${childrenHtml}</li>`;
      })
      .join('')}</ul>`;
  }

  return parseMarkdownBlocks(source)
    .map((block) => {
      if (block.type === 'heading') {
        return `<h${block.level}>${formatInline(block.content)}</h${block.level}>`;
      }

      if (block.type === 'list') {
        return renderList(block);
      }

      return `<p>${formatInline(block.content)}</p>`;
    })
    .join('\n');
}
