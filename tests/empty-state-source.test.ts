import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const sourcePath = path.join(process.cwd(), 'app', 'components', 'empty-state.tsx');
const source = readFileSync(sourcePath, 'utf8');

describe('empty-state source', () => {
  it('uses house tokens instead of Mantine light gray defaults for the icon chrome', () => {
    expect(source).toContain('EMPTY_STATE_ICON_STYLE');
    expect(source).toContain('var(--ui-border)');
    expect(source).toContain('var(--ui-neutral-soft)');
    expect(source).toContain('var(--ui-muted-text)');
    expect(source).not.toContain('variant="light"');
    expect(source).not.toContain('color="gray"');
  });
});
