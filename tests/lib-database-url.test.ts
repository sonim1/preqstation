import { describe, expect, it } from 'vitest';

import { requireDatabaseUrl } from '@/lib/database-url';

describe('requireDatabaseUrl', () => {
  it('uses DATABASE_URL directly', () => {
    expect(
      requireDatabaseUrl({
        DATABASE_URL: 'https://prod.example.com/db',
      }),
    ).toBe('https://prod.example.com/db');
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => requireDatabaseUrl({})).toThrow('DATABASE_URL is required');
  });
});
