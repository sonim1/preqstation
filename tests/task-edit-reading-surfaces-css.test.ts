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
  for (let searchStart = 0; searchStart < source.length; ) {
    const selectorIndex = source.indexOf(selector, searchStart);
    if (selectorIndex < 0) {
      break;
    }

    const openingBraceIndex = source.indexOf('{', selectorIndex + selector.length);
    if (openingBraceIndex < 0) {
      break;
    }

    const selectorStart =
      Math.max(source.lastIndexOf('}', selectorIndex), source.lastIndexOf('{', selectorIndex)) + 1;
    const selectorList = source.slice(selectorStart, openingBraceIndex);
    const selectorMatches = selectorList
      .split(',')
      .map((candidate) => candidate.trim())
      .includes(selector);

    if (selectorMatches) {
      return source.slice(openingBraceIndex + 1, findClosingBrace(source, openingBraceIndex));
    }

    searchStart = selectorIndex + selector.length;
  }

  throw new Error(`Missing CSS selector: ${selector}`);
}

function expectTokenBackground(ruleBody: string, tokenName: string) {
  expect(ruleBody).toContain(`background: var(${tokenName});`);
  expect(ruleBody).not.toMatch(/background:\s*(?:rgba|linear-gradient|color-mix)\(/);
}

describe('task edit reading surface CSS', () => {
  it('matches exact selector names when reading rule bodies', () => {
    const ruleBody = getRuleBody(
      '.live-editor-link-button { color: red; } .live-editor-link { color: blue; }',
      '.live-editor-link',
    );

    expect(ruleBody).toContain('color: blue;');
    expect(ruleBody).not.toContain('color: red;');
  });

  it('defines shared reading surface tokens in light and dark scopes', () => {
    const lightTokens = getRuleBody(globalsCss, ':root');
    const darkTokens = getRuleBody(globalsCss, "html[data-mantine-color-scheme='dark']");

    for (const tokenScope of [lightTokens, darkTokens]) {
      expect(tokenScope).toContain('--ui-reading-surface:');
      expect(tokenScope).toContain('--ui-reading-surface-soft:');
      expect(tokenScope).toContain('--ui-reading-border:');
    }
  });

  it('maps inline code borders through a shared semantic token', () => {
    const rootTokens = getRuleBody(globalsCss, ':root');
    const markdownCodeRule = getRuleBody(globalsCss, '.markdown-output code');
    const liveEditorCodeRule = getRuleBody(globalsCss, '.live-editor-code');

    expect(rootTokens).toContain('--ui-reading-code-border: var(--ui-reading-border);');

    for (const ruleBody of [markdownCodeRule, liveEditorCodeRule]) {
      expect(ruleBody).toContain('border: 1px solid var(--ui-reading-code-border);');
      expect(ruleBody).not.toContain('color-mix(in srgb, var(--ui-border), transparent 24%)');
    }

    expect(globalsCss).not.toContain('color-mix(in srgb, var(--ui-border), transparent 24%)');
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

  it('keeps task edit scoped styles on defined ui tokens', () => {
    const definedTokens = new Set(
      Array.from(getRuleBody(globalsCss, ':root').matchAll(/(--ui-[\w-]+)\s*:/g)).map(
        ([, token]) => token,
      ),
    );
    const referencedTokens = Array.from(
      `${globalsCss}\n${taskEditFormCss}`.matchAll(/var\((--ui-[\w-]+)/g),
    ).map(([, token]) => token);

    expect([...new Set(referencedTokens)].filter((token) => !definedTokens.has(token))).toEqual([]);
  });

  it('keeps framed metadata and dispatch sections on the shared tokenized surface', () => {
    const sectionSurfaceRule = getRuleBody(taskEditFormCss, '.sectionSurface');

    expect(sectionSurfaceRule).toContain('padding: clamp(0.875rem, 1.4vw, 1rem);');
    expect(sectionSurfaceRule).toContain('border: 1px solid var(--ui-border);');
    expect(sectionSurfaceRule).toContain('border-radius: 8px;');
    expectTokenBackground(sectionSurfaceRule, '--ui-surface');
    expect(sectionSurfaceRule).toContain('box-shadow: var(--ui-elevation-1);');
  });

  it('keeps main task edit sections unframed around their inner reading surfaces', () => {
    const mainSectionSurfaceRule = getRuleBody(taskEditFormCss, '.mainSectionSurface');

    expect(mainSectionSurfaceRule).toContain('min-width: 0;');
    expect(mainSectionSurfaceRule).toContain('padding: 0;');
    expect(mainSectionSurfaceRule).toContain('border: 0;');
    expect(mainSectionSurfaceRule).toContain('border-radius: 0;');
    expect(mainSectionSurfaceRule).toContain('background: transparent;');
    expect(mainSectionSurfaceRule).toContain('box-shadow: none;');
  });

  it('uses semantic tokens for editor and markdown text accents', () => {
    const rootTokens = getRuleBody(globalsCss, ':root');
    const markdownCodeRule = getRuleBody(globalsCss, '.markdown-output code');
    const liveEditorCodeRule = getRuleBody(globalsCss, '.live-editor-code');
    const liveEditorCodeBlockRule = getRuleBody(globalsCss, '.live-editor-code-block');
    const liveEditorQuoteRule = getRuleBody(globalsCss, '.live-editor-quote');
    const liveEditorLinkRule = getRuleBody(globalsCss, '.live-editor-link');
    const tokenSelectorRule = getRuleBody(globalsCss, '.live-editor-tokenSelector');
    const tokenFunctionRule = getRuleBody(globalsCss, '.live-editor-tokenFunction');
    const selectorTokenValue = rootTokens.match(/--ui-syntax-selector:\s*([^;]+);/)?.[1];
    const functionTokenValue = rootTokens.match(/--ui-syntax-function:\s*([^;]+);/)?.[1];

    for (const ruleBody of [
      markdownCodeRule,
      liveEditorCodeRule,
      liveEditorCodeBlockRule,
      liveEditorQuoteRule,
      liveEditorLinkRule,
    ]) {
      expect(ruleBody).toContain('var(--ui-');
      expect(ruleBody).not.toContain('var(--mantine-color-');
      expect(ruleBody).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
    }

    expect(tokenSelectorRule).toContain('color: var(--ui-syntax-selector);');
    expect(tokenFunctionRule).toContain('color: var(--ui-syntax-function);');
    expect(selectorTokenValue).toBeTruthy();
    expect(functionTokenValue).toBeTruthy();
    expect(selectorTokenValue).not.toBe(functionTokenValue);
  });

  it('keeps mermaid fallback source readable on the tokenized canvas in dark mode', () => {
    const dom = new JSDOM(`
      <html data-mantine-color-scheme="dark">
        <head><style>${globalsCss}</style></head>
        <body>
          <article class="markdown-output">
            <pre class="mermaid">graph TD; A-->B;</pre>
          </article>
          <section class="live-editor-mermaid-block">
            <pre class="mermaid">sequenceDiagram; Alice->>Bob: Hi;</pre>
          </section>
        </body>
      </html>
    `);

    const mermaidNodes = dom.window.document.querySelectorAll<HTMLElement>('.mermaid');

    expect(mermaidNodes).toHaveLength(2);

    for (const node of mermaidNodes) {
      const style = dom.window.getComputedStyle(node);

      expect(style.background).toBe('var(--ui-surface-strong)');
      expect(style.color).toBe('var(--ui-text)');
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
    expect(dom.window.getComputedStyle(defaultTextarea!).background).toBe('var(--ui-surface-soft)');
    expect(dom.window.getComputedStyle(commentsTextarea!).background).toBe(
      'var(--ui-reading-surface-soft)',
    );
  });
});
