import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const taskEditFormCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/task-edit-form.module.css'),
  'utf8',
);
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom') as {
  JSDOM: new (html?: string) => {
    window: Window & typeof globalThis;
  };
};

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

  it('keeps mermaid diagrams on a light canvas in dark mode for contrast', () => {
    const markdownMermaidRule = getRuleBody(
      globalsCss,
      "html[data-mantine-color-scheme='dark'] .markdown-output .mermaid",
    );
    const liveEditorMermaidRule = getRuleBody(
      globalsCss,
      "html[data-mantine-color-scheme='dark'] .live-editor-mermaid-block .mermaid",
    );

    for (const ruleBody of [markdownMermaidRule, liveEditorMermaidRule]) {
      expect(ruleBody).toContain('background: var(--mantine-color-white);');
      expect(ruleBody).toContain('border-color: var(--mantine-color-gray-3);');
      expect(ruleBody).not.toMatch(/background:\s*color-mix\(/);
    }
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

  it('keeps the task comments textarea reading surface through the dark-mode cascade', () => {
    const dom = new JSDOM(`
      <html data-mantine-color-scheme="dark">
        <head><style>${globalsCss}</style></head>
        <body>
          <textarea class="mantine-Textarea-input" data-testid="default-textarea"></textarea>
          <section data-panel="task-edit-comments">
            <textarea class="mantine-Textarea-input" data-testid="comments-textarea"></textarea>
          </section>
        </body>
      </html>
    `);

    const defaultTextarea = dom.window.document.querySelector<HTMLTextAreaElement>(
      '[data-testid="default-textarea"]',
    );
    const commentsTextarea = dom.window.document.querySelector<HTMLTextAreaElement>(
      '[data-testid="comments-textarea"]',
    );

    expect(defaultTextarea).toBeTruthy();
    expect(commentsTextarea).toBeTruthy();
    expect(dom.window.getComputedStyle(defaultTextarea!).background).toBe('rgba(12, 22, 38, 0.92)');
    expect(dom.window.getComputedStyle(commentsTextarea!).background).toBe(
      'var(--ui-reading-surface-soft)',
    );
  });
});
