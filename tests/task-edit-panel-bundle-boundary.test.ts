import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('app/components/task-edit-panel bundle boundary', () => {
  it('does not import the Lexical-heavy task edit form in the shell module', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/task-edit-panel.tsx'), 'utf8');

    expect(source).not.toContain("from './task-edit-form'");
    expect(source).not.toContain('from "@/app/components/task-edit-form"');
  });
});
