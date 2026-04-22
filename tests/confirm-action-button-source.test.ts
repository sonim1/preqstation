import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const sourcePath = path.join(process.cwd(), 'app', 'components', 'confirm-action-button.tsx');
const source = readFileSync(sourcePath, 'utf8');

describe('confirm-action-button source', () => {
  it('uses house danger tokens for destructive confirmation styling', () => {
    expect(source).toContain("'--button-bg': 'var(--ui-danger)'");
    expect(source).toContain(
      "'--button-hover': 'color-mix(in srgb, var(--ui-danger), var(--ui-surface-strong) 18%)'",
    );
    expect(source).toContain("'--button-color': 'var(--ui-surface-strong)'");
    expect(source).not.toContain('color="red"');
    expect(source).not.toContain('black 12%');
  });
});
