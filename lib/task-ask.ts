const TASK_ASK_BLOCK_PATTERN = /(?:^|\n)---\n\nAsk:\n?([\s\S]*)$/;

function normalizeMarkdown(value: string | null | undefined) {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n') : '';
}

export function extractTaskAskPrompt(markdown: string | null | undefined) {
  const normalized = normalizeMarkdown(markdown);
  const match = normalized.match(TASK_ASK_BLOCK_PATTERN);

  if (!match || match.index === undefined) {
    return {
      baseMarkdown: normalized,
      askHint: null,
      hasAskBlock: false,
    };
  }

  return {
    baseMarkdown: normalized.slice(0, match.index).trimEnd(),
    askHint: match[1].trim() || null,
    hasAskBlock: true,
  };
}

export function ensureTaskAskPrompt(markdown: string | null | undefined) {
  const normalized = normalizeMarkdown(markdown);
  const extracted = extractTaskAskPrompt(normalized);

  if (extracted.hasAskBlock) {
    return {
      markdown: normalized,
      cursorIndex: normalized.length,
    };
  }

  const baseMarkdown = normalized.trimEnd();
  const nextMarkdown = baseMarkdown ? `${baseMarkdown}\n\n---\n\nAsk:\n` : '---\n\nAsk:\n';

  return {
    markdown: nextMarkdown,
    cursorIndex: nextMarkdown.length,
  };
}
