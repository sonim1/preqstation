import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('task edit keyboard source coverage', () => {
  it('registers a scoped Mod+Enter dispatch shortcut', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/components/task-copy-actions.tsx'),
      'utf8',
    );

    expect(source).toContain("window.addEventListener('keydown'");
    expect(source).toContain("event.key === 'Enter'");
    expect(source).toContain('event.metaKey || event.ctrlKey');
    expect(source).toContain('sendDispatch()');
  });

  it('keeps Escape inside the active task edit inputs', () => {
    const titleSource = readFileSync(
      join(process.cwd(), 'app/components/task-edit-header-title.tsx'),
      'utf8',
    );
    const editorSource = readFileSync(
      join(process.cwd(), 'app/components/live-markdown-editor.tsx'),
      'utf8',
    );

    expect(titleSource).toContain("event.key === 'Escape'");
    expect(titleSource).toContain('event.currentTarget.blur()');
    expect(editorSource).toContain("event.key === 'Escape'");
    expect(editorSource).toContain('event.stopPropagation()');
  });
});
