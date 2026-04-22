import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/ping/route';

describe('app/api/ping/route', () => {
  it('returns heartbeat payload', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: 'preqstation',
      online: true,
    });
  });
});
