import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const globalsCss = readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const connectionsCss = readFileSync(
  path.join(
    process.cwd(),
    'app',
    '(workspace)',
    '(main)',
    'connections',
    'connections-page.module.css',
  ),
  'utf8',
);
const connectionsPageSource = readFileSync(
  path.join(process.cwd(), 'app', '(workspace)', '(main)', 'connections', 'page.tsx'),
  'utf8',
);
const connectionsConfirmSource = readFileSync(
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
const apiKeyFormSource = readFileSync(
  path.join(process.cwd(), 'app', '(workspace)', '(main)', 'api-keys', 'api-key-create-form.tsx'),
  'utf8',
);
const apiKeyFormCssPath = path.join(
  process.cwd(),
  'app',
  '(workspace)',
  '(main)',
  'api-keys',
  'api-key-create-form.module.css',
);
const apiKeyFormCss = existsSync(apiKeyFormCssPath) ? readFileSync(apiKeyFormCssPath, 'utf8') : '';

describe('connections and security control token contract', () => {
  it('defines shared table and security control tokens in the global contract', () => {
    expect(globalsCss).toContain('--ui-table-surface: var(--ui-surface);');
    expect(globalsCss).toContain('--ui-table-header-surface:');
    expect(globalsCss).toContain('--ui-table-row-hover:');
    expect(globalsCss).toContain('--ui-table-row-selected:');
    expect(globalsCss).toContain('--ui-table-card-surface:');
    expect(globalsCss).toContain('--ui-security-control-surface:');
    expect(globalsCss).toContain('--ui-security-success-surface: var(--ui-success-soft);');
    expect(globalsCss).toContain('--ui-security-warning-surface: var(--ui-warning-soft);');
    expect(globalsCss).toContain('--ui-security-danger-surface: var(--ui-danger-soft);');
    expect(globalsCss).toContain('--ui-security-neutral-surface: var(--ui-neutral-soft);');
  });

  it('renders connections tables and mobile cards through the shared table layer', () => {
    expect(connectionsCss).toMatch(
      /\.tableShell\s*\{[\s\S]*border:\s*1px solid var\(--ui-table-border\);[\s\S]*background:\s*var\(--ui-table-surface\);/,
    );
    expect(connectionsCss).toMatch(
      /\.dataTable thead th\s*\{[\s\S]*background:\s*var\(--ui-table-header-surface\);/,
    );
    expect(connectionsCss).toMatch(
      /\.dataRow:hover\s*\{[\s\S]*background:\s*var\(--ui-table-row-hover\);/,
    );
    expect(connectionsCss).toMatch(
      /\.dataRow:focus-within\s*\{[\s\S]*background:\s*var\(--ui-table-row-selected\);/,
    );
    expect(connectionsCss).toMatch(
      /@media\s*\(max-width:\s*56rem\)\s*\{[\s\S]*\.dataRow\s*\{[\s\S]*background:\s*var\(--ui-table-card-surface\);/,
    );
  });

  it('maps connection status and revoke controls to security semantics', () => {
    expect(connectionsPageSource).toContain("'--badge-bg': 'var(--ui-security-success-surface)'");
    expect(connectionsPageSource).toContain("'--badge-bg': 'var(--ui-security-warning-surface)'");
    expect(connectionsPageSource).toContain("'--badge-bg': 'var(--ui-security-danger-surface)'");
    expect(connectionsPageSource).toContain("'--badge-bg': 'var(--ui-security-neutral-surface)'");
    expect(connectionsPageSource).toContain("'--button-bg': 'var(--ui-security-danger-surface)'");
    expect(connectionsPageSource).toContain(
      "'--button-bd': '1px solid var(--ui-security-danger-border)'",
    );
  });

  it('uses security danger tokens for the destructive confirmation modal', () => {
    expect(connectionsConfirmSource).toContain("'--button-bg': 'var(--ui-danger)'");
    expect(connectionsConfirmSource).toContain("'--button-color': 'var(--ui-on-danger)'");
    expect(connectionsConfirmSource).toContain(
      "'--button-bd': '1px solid var(--ui-security-danger-border)'",
    );
  });

  it('keeps the legacy API key form on the security control hierarchy', () => {
    expect(apiKeyFormSource).toContain("from './api-key-create-form.module.css'");
    expect(apiKeyFormSource).not.toContain('color="red"');
    expect(apiKeyFormSource).not.toContain('color="green"');
    expect(apiKeyFormSource).not.toContain('color="blue"');
    expect(apiKeyFormCss).toContain('var(--ui-security-control-surface)');
    expect(apiKeyFormCss).toContain('var(--ui-security-danger-surface)');
    expect(apiKeyFormCss).toContain('var(--ui-security-success-surface)');
    expect(apiKeyFormCss).toContain('var(--ui-security-neutral-surface)');
    expect(apiKeyFormCss).toContain('overflow-wrap: anywhere;');
  });
});
