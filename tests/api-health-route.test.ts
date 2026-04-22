import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/health/route';

describe('app/api/health/route', () => {
  it('GET returns service health payload', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: 'preqstation' });
  });
});
