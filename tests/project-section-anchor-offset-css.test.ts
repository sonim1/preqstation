import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const panelsCss = fs.readFileSync(path.join(process.cwd(), 'app/components/panels.module.css'), 'utf8');

describe('project section anchor offset styles', () => {
  it('uses the measured sticky nav height in the anchor scroll margin', () => {
    expect(panelsCss).toMatch(
      /\.sectionAnchor\s*\{[\s\S]*scroll-margin-top:\s*calc\([\s\S]*var\(--app-shell-header-offset, 0px\)[\s\S]*var\(--mantine-spacing-sm\)[\s\S]*var\(--project-section-nav-height, calc\(5\.5rem - var\(--mantine-spacing-sm\)\)\)[\s\S]*\);/,
    );
    expect(panelsCss).not.toContain(
      'scroll-margin-top: calc(var(--app-shell-header-offset, 0px) + 5.5rem);',
    );
  });
});
