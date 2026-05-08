import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/hello/route';

describe('app/api/hello/route', () => {
  it('returns hello world', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Hello, world!');
  });
});
