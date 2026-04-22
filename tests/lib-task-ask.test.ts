import { describe, expect, it } from 'vitest';

import { ensureTaskAskPrompt, extractTaskAskPrompt } from '@/lib/task-ask';

describe('lib/task-ask', () => {
  it('appends a trailing Ask block when one is missing', () => {
    const result = ensureTaskAskPrompt('## Context\n\nCurrent note');

    expect(result.markdown).toBe('## Context\n\nCurrent note\n\n---\n\nAsk:\n');
    expect(result.cursorIndex).toBe(result.markdown.length);
  });

  it('reuses an existing trailing Ask block and extracts its hint', () => {
    const markdown =
      '## Context\n\nCurrent note\n\n---\n\nAsk:\nAcceptance criteria 중심으로 정리해줘';

    expect(ensureTaskAskPrompt(markdown)).toEqual({
      markdown,
      cursorIndex: markdown.length,
    });
    expect(extractTaskAskPrompt(markdown)).toEqual({
      baseMarkdown: '## Context\n\nCurrent note',
      askHint: 'Acceptance criteria 중심으로 정리해줘',
      hasAskBlock: true,
    });
  });
});
