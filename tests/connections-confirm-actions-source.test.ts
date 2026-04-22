import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(
  path.join(process.cwd(), 'app', '(workspace)', '(main)', 'connections', 'page.tsx'),
  'utf8',
);
const confirmSource = readFileSync(
  path.join(
    process.cwd(),
    'app',
    '(workspace)',
    '(main)',
    'connections',
    'connections-confirm-actions.tsx',
  ),
  'utf8',
);

describe('connections confirm actions source', () => {
  it('centralizes revoke confirmation behind a single provider modal', () => {
    expect(confirmSource.match(/<Modal\b/g)?.length ?? 0).toBe(1);
    expect(confirmSource).toContain('ConnectionsConfirmActionProvider');
    expect(confirmSource).toContain('ConnectionsConfirmActionButton');
    expect(pageSource).toContain('ConnectionsConfirmActionProvider');
    expect(pageSource).toContain('ConnectionsConfirmActionButton');
    expect(pageSource).not.toContain('@/app/components/confirm-action-button');
  });

  it('keeps the confirm dialog open and shows an explicit error when the target form cannot be found', () => {
    expect(confirmSource).toContain('Unable to find that action. Refresh and try again.');
    expect(confirmSource).toContain('role="alert"');
    expect(confirmSource).toMatch(/if\s*\(!form\)\s*\{/);
  });
});
