import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const cssPath = path.join(
  process.cwd(),
  'app',
  '(workspace)',
  '(main)',
  'connections',
  'connections-page.module.css',
);
const css = readFileSync(cssPath, 'utf8');

describe('connections-page responsive CSS', () => {
  it('keeps the table-shell layout on mobile instead of falling back to pseudo-card rows', () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*56rem\)/);
    expect(css).toMatch(/\.tableScroller\s*\{/);
    expect(css).not.toMatch(/content:\s*attr\(data-label\)/);
  });

  it('keeps action buttons at the shared touch target minimum', () => {
    expect(css).toMatch(
      /\.actionButton\s*\{[\s\S]*--button-height:\s*var\(--ui-hit-touch-min\);[\s\S]*min-height:\s*var\(--ui-hit-touch-min\);/,
    );
  });

  it('allows long connection metadata to wrap without blowing out table cells', () => {
    expect(css).toMatch(
      /\.dataCellMeta\s*\{[\s\S]*word-break:\s*break-word;[\s\S]*overflow-wrap:\s*anywhere;/,
    );
    expect(css).toMatch(/\.dataCellStack\s*\{[\s\S]*min-width:\s*0;/);
  });

  it('keeps the desktop table shell scroll affordance before the mobile reflow breakpoint', () => {
    expect(css).toMatch(/\.tableScroller\s*\{[\s\S]*overflow-x:\s*auto;/);
    expect(css).toMatch(/\.dataTable\s*\{[\s\S]*min-width:\s*38rem;/);
  });

  it('gives the scroll wrapper a visible keyboard focus treatment', () => {
    expect(css).toMatch(/\.tableScroller:focus-visible\s*\{/);
  });

  it('fits tables to the viewport on mobile instead of keeping a wide minimum width', () => {
    expect(css).toMatch(
      /@media\s*\(max-width:\s*56rem\)\s*\{[\s\S]*\.dataTable\s*\{[\s\S]*min-width:\s*0;[\s\S]*table-layout:\s*fixed;/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*56rem\)\s*\{[\s\S]*\.statusCell\s*\{[\s\S]*min-width:\s*0;/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*56rem\)\s*\{[\s\S]*\.dataRow\s*\{[\s\S]*display:\s*grid;/,
    );
    expect(css).toMatch(/\.dataCellLabel\s*\{[\s\S]*display:\s*none;/);
    expect(css).toMatch(
      /@media\s*\(max-width:\s*56rem\)\s*\{[\s\S]*\.dataCellLabel\s*\{[\s\S]*display:\s*inline-flex;/,
    );
  });

  it('keeps table shells flat instead of using floating card shadows', () => {
    expect(css).toMatch(/\.tableShell\s*\{[\s\S]*box-shadow:\s*none;/);
  });

  it('left-aligns section empty states so they read like inline guidance instead of centered placeholders', () => {
    expect(css).toMatch(
      /\.sectionEmptyState\s*\{[\s\S]*align-items:\s*flex-start;[\s\S]*text-align:\s*left;/,
    );
  });

  it('avoids hard-coded black in table shell shadows so the page stays token-driven', () => {
    expect(css).not.toMatch(/\bblack\b/);
  });
});
