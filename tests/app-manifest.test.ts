import { describe, expect, it } from 'vitest';

import manifest from '@/app/manifest';

describe('app/manifest', () => {
  it('returns standalone install metadata and icons', () => {
    expect(manifest()).toMatchObject({
      display: 'standalone',
      start_url: '/dashboard',
      icons: expect.arrayContaining([
        expect.objectContaining({ src: '/brand/preqstation-app-icon.svg' }),
      ]),
    });
  });
});
