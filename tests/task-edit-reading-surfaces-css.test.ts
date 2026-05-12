import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const globalCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const taskEditCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/task-edit-form.module.css'),
  'utf8',
);

function getRuleBody(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));

  expect(match).toBeTruthy();
  return match?.[1] ?? '';
}

describe('task edit reading surfaces', () => {
  it('defines light and dark tokens for long-form reading surfaces', () => {
    const rootRule = getRuleBody(globalCss, ':root');
    const darkRule = getRuleBody(globalCss, "html[data-mantine-color-scheme='dark']");

    for (const token of [
      '--ui-reading-surface:',
      '--ui-reading-surface-soft:',
      '--ui-reading-border:',
    ]) {
      expect(rootRule).toContain(token);
      expect(darkRule).toContain(token);
    }
  });

  it('uses reading tokens for notes, markdown output, comments, and comment input', () => {
    const markdownRule = getRuleBody(globalCss, '.markdown-output');
    const editorShellRule = getRuleBody(globalCss, '.live-editor-shell');
    const rawInputRule = getRuleBody(globalCss, '.live-editor-raw-input');
    const commentInputRule = getRuleBody(
      globalCss,
      "[data-panel='task-edit-comments'] .mantine-Textarea-input",
    );
    const commentCardRule = getRuleBody(taskEditCss, '.commentCard');

    expect(markdownRule).toContain('var(--ui-reading-surface)');
    expect(editorShellRule).toContain('var(--ui-reading-surface-soft)');
    expect(rawInputRule).toContain('var(--ui-reading-surface-soft)');
    expect(commentInputRule).toContain('var(--ui-reading-surface-soft)');
    expect(commentCardRule).toContain('var(--ui-reading-surface)');
  });

  it('does not regress long-form surfaces to white rgba gradients', () => {
    const markdownRule = getRuleBody(globalCss, '.markdown-output');
    const rawInputRule = getRuleBody(globalCss, '.live-editor-raw-input');

    expect(markdownRule).not.toContain('rgba(255, 255, 255');
    expect(rawInputRule).not.toContain('rgba(255, 255, 255');
  });
});
