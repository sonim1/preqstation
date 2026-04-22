import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const laneCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/dashboard-focused-work-lane.module.css'),
  'utf8',
);

function getRuleBody(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = laneCss.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));

  expect(match).toBeTruthy();
  return match?.[1] ?? '';
}

describe('dashboard focused work lane styling', () => {
  it('renders task rows as a divider list instead of boxed cards', () => {
    const rowRule = getRuleBody('.row');
    const headerRule = getRuleBody('.header');
    const stackedRowRule = getRuleBody('.row + .row');

    expect(rowRule).toContain('padding: 0.95rem 0;');
    expect(rowRule).not.toContain('background:');
    expect(rowRule).not.toContain('border-color:');
    expect(headerRule).not.toContain('border-bottom:');
    expect(laneCss).toContain('.header::after');
    expect(stackedRowRule).not.toContain('border-top:');
    expect(laneCss).toContain('.row + .row::before');
  });

  it('defines low-noise summary metadata instead of badge chrome', () => {
    expect(laneCss).toContain('.summaryCluster');
    expect(laneCss).toContain('.summaryMeta');
    expect(laneCss).toContain('.summaryMetaCurrent');
  });
});
