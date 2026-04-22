import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const settingsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/settings/settings-page.module.css'),
  'utf8',
);

function getRuleBody(selector: string) {
  const escapedSelector = selector.replace('.', '\\.');
  const match = settingsCss.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));

  expect(match?.[1]).toBeTruthy();
  return match?.[1] ?? '';
}

describe('settings page desk styling', () => {
  it('defines divider-led section headers on the shared settings surface', () => {
    expect(settingsCss).toContain('.section');
    expect(settingsCss).toContain('.sectionHeader');
    const sectionRule = getRuleBody('.section');

    expect(sectionRule).toContain('box-shadow: none;');
  });

  it('keeps workspace preference groups on the shared settings surface', () => {
    expect(settingsCss).toContain('.preferenceList');
    expect(settingsCss).toContain('.preferenceItem');
    expect(settingsCss).toContain('.preferenceItem + .preferenceItem');
    expect(settingsCss).toMatch(
      /\.preferenceItem \+ \.preferenceItem\s*\{[\s\S]*border-top:\s*1px solid/,
    );
    expect(settingsCss).not.toMatch(/\.preferenceItem \+ \.preferenceItem\s*\{[\s\S]*box-shadow:/);
  });
});
