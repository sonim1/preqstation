import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const operatorDeskCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/dashboard-operator-desk.module.css'),
  'utf8',
);

function getRuleBody(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = operatorDeskCss.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));

  expect(match).toBeTruthy();
  return match?.[1] ?? '';
}

function getMediaBlockBody(query: string) {
  const afterMedia = operatorDeskCss.split(`@media ${query} {`)[1];

  expect(afterMedia).toBeTruthy();

  if (query === '(max-width: 74rem)') {
    return afterMedia?.split('@media (max-width: 48rem) {')[0] ?? '';
  }

  return afterMedia ?? '';
}

describe('dashboard operator desk tonal seams', () => {
  it('replaces portfolio split hard borders with seam hooks', () => {
    const columnsRule = getRuleBody('.portfolioColumns');
    const activityColumnRule = getRuleBody('.portfolioActivityColumn');
    const stackedMobileCss = getMediaBlockBody('(max-width: 74rem)');

    expect(columnsRule).not.toContain('border-top:');
    expect(columnsRule).not.toContain('border-bottom:');
    expect(activityColumnRule).not.toContain('border-left:');
    expect(operatorDeskCss).toContain('.portfolioColumns::before');
    expect(operatorDeskCss).toContain('.portfolioColumns::after');
    expect(operatorDeskCss).toContain('.portfolioActivityColumn::before');
    expect(stackedMobileCss).not.toMatch(/\.portfolioActivityColumn\s*\{[\s\S]*?border-top:/);
  });

  it('limits right-rail seam changes to module boundaries', () => {
    const railModuleRule = getRuleBody('.railModule + .railModule');
    const railHeaderRule = getRuleBody('.railHeader');
    const passRowRule = getRuleBody('.passRow + .passRow');

    expect(railModuleRule).not.toContain('border-top:');
    expect(railHeaderRule).not.toContain('border-bottom:');
    expect(operatorDeskCss).toContain('.railModule + .railModule::before');
    expect(operatorDeskCss).toContain('.railHeader::after');
    expect(passRowRule).toContain('border-top: 1px solid color-mix');
  });
});
