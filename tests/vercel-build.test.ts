import { describe, expect, it } from 'vitest';

// @ts-expect-error -- The build helper is authored as .mjs and is intentionally exercised directly.
import { shouldRunDbMigrate } from '../scripts/vercel-build.mjs';

describe('scripts/vercel-build', () => {
  it('runs db:migrate for production deployments', () => {
    expect(shouldRunDbMigrate({ VERCEL_ENV: 'production' })).toBe(true);
  });

  it('skips db:migrate for preview deployments by default', () => {
    expect(shouldRunDbMigrate({ VERCEL_ENV: 'preview' })).toBe(false);
  });

  it('allows preview deployments to opt into db:migrate', () => {
    expect(
      shouldRunDbMigrate({
        VERCEL_ENV: 'preview',
        MIGRATE_ON_PREVIEW: 'true',
      }),
    ).toBe(true);
  });
});
