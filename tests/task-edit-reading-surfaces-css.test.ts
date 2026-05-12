import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const taskEditFormCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/task-edit-form.module.css'),
  'utf8',
);

function findClosingBrace(source: string, openingBraceIndex: number) {
  let depth = 0;
  let inComment = false;
  let quote: '"' | "'" | null = null;

  for (let index = openingBraceIndex; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (inComment) {
      if (char === '*' && nextChar === '/') {
        inComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (char === '\\') {
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  throw new Error(`Missing closing brace after index ${openingBraceIndex}`);
}

function getRuleBody(source: string, selector: string) {
  const selectorIndex = source.indexOf(selector);
  if (selectorIndex < 0) {
    throw new Error(`Missing CSS selector: ${selector}`);
  }

  const openingBraceIndex = source.indexOf('{', selectorIndex + selector.length);
  if (openingBraceIndex < 0) {
    throw new Error(`Missing rule body for CSS selector: ${selector}`);
  }

  return source.slice(openingBraceIndex + 1, findClosingBrace(source, openingBraceIndex));
}

function expectTokenBackground(ruleBody: string, tokenName: string) {
  expect(ruleBody).toContain(`background: var(${tokenName});`);
  expect(ruleBody).not.toMatch(/background:\s*(?:rgba|linear-gradient|color-mix)\(/);
}

describe('task edit reading surface CSS', () => {
  it('defines shared reading surface tokens in light and dark scopes', () => {
    const lightTokens = getRuleBody(globalsCss, ':root');
    const darkTokens = getRuleBody(globalsCss, "html[data-mantine-color-scheme='dark']");

    for (const tokenScope of [lightTokens, darkTokens]) {
      expect(tokenScope).toContain('--ui-reading-surface:');
      expect(tokenScope).toContain('--ui-reading-surface-soft:');
      expect(tokenScope).toContain('--ui-reading-border:');
    }
  });

  it('uses reading surface tokens for markdown and live editor surfaces', () => {
    const markdownOutputRule = getRuleBody(globalsCss, '.markdown-output');
    const liveEditorShellRule = getRuleBody(globalsCss, '.live-editor-shell');
    const rawInputRule = getRuleBody(globalsCss, '.live-editor-raw-input');

    expect(markdownOutputRule).toContain('border: 1px solid var(--ui-reading-border);');
    expectTokenBackground(markdownOutputRule, '--ui-reading-surface');

    expect(liveEditorShellRule).toContain('border: 1px solid var(--ui-reading-border);');
    expectTokenBackground(liveEditorShellRule, '--ui-reading-surface-soft');
    expect(liveEditorShellRule).not.toMatch(/\bcolor\s*:/);

    expect(rawInputRule).toContain('border: 1px solid var(--ui-reading-border);');
    expectTokenBackground(rawInputRule, '--ui-reading-surface-soft');
    expect(rawInputRule).toContain('color: var(--ui-text);');
    expect(globalsCss).not.toMatch(
      /html\[data-mantine-color-scheme='dark'\]\s+\.live-editor-raw-input\s*\{/,
    );
  });

  it('uses reading surface tokens for task comments without overriding the focus border', () => {
    const textareaRule = getRuleBody(
      globalsCss,
      "[data-panel='task-edit-comments'] .mantine-Textarea-input",
    );
    const textareaIdleRule = getRuleBody(
      globalsCss,
      "[data-panel='task-edit-comments'] .mantine-Textarea-input:not(:focus)",
    );
    const commentCardRule = getRuleBody(taskEditFormCss, '.commentCard');

    expectTokenBackground(textareaRule, '--ui-reading-surface-soft');
    expect(textareaRule).toContain('color: var(--ui-text);');
    expect(textareaRule).not.toContain('border-color:');
    expect(textareaIdleRule).toContain('border-color: var(--ui-reading-border);');

    expect(commentCardRule).toContain('border: 1px solid var(--ui-reading-border);');
    expectTokenBackground(commentCardRule, '--ui-reading-surface');
  });
});
