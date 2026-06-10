import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function listFiles(rootDir: string, predicate: (filePath: string) => boolean): string[] {
  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(rootDir, entry.name);

      if (entry.isDirectory()) {
        return listFiles(entryPath, predicate);
      }

      return predicate(entryPath) ? [entryPath] : [];
    })
    .sort();
}

function usesProductTypeToken(value: string) {
  return (
    value.includes('var(--ui-font-size-') ||
    value.includes('var(--mantine-font-size-') ||
    value === 'inherit'
  );
}

describe('Linear-inspired type scale token contract', () => {
  it('defines shared type tokens, Mantine sizes, and documentation', () => {
    const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
    const providersSource = fs.readFileSync(path.join(process.cwd(), 'app/providers.tsx'), 'utf8');
    const designSystem = fs.readFileSync(path.join(process.cwd(), 'DESIGN.md'), 'utf8');
    const designSystemDocs = fs.readFileSync(
      path.join(process.cwd(), 'docs/design-system.md'),
      'utf8',
    );

    for (const [token, value] of [
      ['--ui-font-size-tiny', '0.625rem'],
      ['--ui-font-size-micro', '0.75rem'],
      ['--ui-font-size-mini', '0.8125rem'],
      ['--ui-font-size-small', '0.875rem'],
      ['--ui-font-size-regular', '0.9375rem'],
      ['--ui-font-size-large', '1.0625rem'],
      ['--ui-font-size-title-3', '1.25rem'],
      ['--ui-font-size-title-2', '1.5rem'],
      ['--ui-font-size-title-1', '2.25rem'],
    ]) {
      expect(globalsCss).toContain(`${token}: ${value};`);
    }

    expect(providersSource).toContain('fontSizes: {');
    expect(providersSource).toMatch(/xs:\s*['"]0\.75rem['"]/);
    expect(providersSource).toMatch(/sm:\s*['"]0\.8125rem['"]/);
    expect(providersSource).toMatch(/md:\s*['"]0\.9375rem['"]/);
    expect(providersSource).toMatch(/lg:\s*['"]1\.0625rem['"]/);
    expect(providersSource).toMatch(/xl:\s*['"]1\.25rem['"]/);
    expect(designSystem).toContain('Linear-inspired product type scale');
    expect(designSystemDocs).toContain('Linear-inspired type scale');
  });

  it('keeps app font-size declarations on the shared product type scale', () => {
    const appDir = path.join(process.cwd(), 'app');
    const cssFiles = listFiles(appDir, (filePath) => filePath.endsWith('.css'));
    const tsxFiles = listFiles(
      appDir,
      (filePath) => filePath.endsWith('.tsx') && !filePath.endsWith('providers.tsx'),
    );
    const cssViolations = cssFiles.flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');

      return Array.from(source.matchAll(/font-size:\s*([^;]+);/g))
        .filter(([, value]) => !usesProductTypeToken(value.trim()))
        .map(
          ([, value]) => `${path.relative(process.cwd(), filePath)} -> font-size: ${value.trim()};`,
        );
    });
    const tsxViolations = tsxFiles.flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');

      return Array.from(source.matchAll(/fontSize:\s*([^,\n}]+)/g))
        .filter(([, value]) => !usesProductTypeToken(value.trim().replace(/^['"]|['"]$/g, '')))
        .map(
          ([, value]) => `${path.relative(process.cwd(), filePath)} -> fontSize: ${value.trim()}`,
        );
    });

    expect([...cssViolations, ...tsxViolations]).toEqual([]);
  });
});
