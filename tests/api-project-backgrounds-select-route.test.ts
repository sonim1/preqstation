import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => ({
  requireOwnerUser: vi.fn(),
  assertSameOrigin: vi.fn(),
}));

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/request-security', () => ({
  assertSameOrigin: mocked.assertSameOrigin,
}));

import { POST } from '@/app/api/project-backgrounds/select/route';

function postRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/project-backgrounds/select`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

describe('app/api/project-backgrounds/select/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
  });

  it('respects the same-origin guard before auth or selection', async () => {
    mocked.assertSameOrigin.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid origin' }), { status: 403 }),
    );

    const response = await POST(
      postRequest({
        regularUrl: 'https://cdn.openverse.org/photo-1.jpg',
        credit: {
          provider: 'openverse',
          creatorName: 'Jane Doe',
          creatorUrl: 'https://example.com/jane',
          sourceName: 'Flickr',
          sourceUrl: 'https://example.com/photo-1',
          license: 'CC BY 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(mocked.requireOwnerUser).not.toHaveBeenCalled();
  });

  it('returns the auth response when owner auth fails', async () => {
    mocked.requireOwnerUser.mockRejectedValueOnce(new Response('Unauthorized', { status: 401 }));

    const response = await POST(
      postRequest({
        regularUrl: 'https://cdn.openverse.org/photo-1.jpg',
        credit: {
          provider: 'openverse',
          creatorName: 'Jane Doe',
          creatorUrl: 'https://example.com/jane',
          sourceName: 'Flickr',
          sourceUrl: 'https://example.com/photo-1',
          license: 'CC BY 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        },
      }),
    );

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid payloads', async () => {
    const response = await POST(postRequest({ regularUrl: '', credit: null }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: 'Invalid payload',
        issues: expect.any(Array),
      }),
    );
  });

  it('returns normalized background values for valid Openverse selections', async () => {
    const response = await POST(
      postRequest({
        regularUrl: 'https://cdn.openverse.org/photo-1.jpg',
        credit: {
          provider: 'openverse',
          creatorName: 'Jane Doe',
          creatorUrl: 'https://example.com/jane',
          sourceName: 'Flickr',
          sourceUrl: 'https://example.com/photo-1',
          license: 'CC BY 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      bgImage: 'https://cdn.openverse.org/photo-1.jpg',
      bgImageCredit: {
        provider: 'openverse',
        creatorName: 'Jane Doe',
        creatorUrl: 'https://example.com/jane',
        sourceName: 'Flickr',
        sourceUrl: 'https://example.com/photo-1',
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      },
    });
  });

  it('rejects selections with invalid credit links', async () => {
    const response = await POST(
      postRequest({
        regularUrl: 'https://cdn.openverse.org/photo-1.jpg',
        credit: {
          provider: 'openverse',
          creatorName: 'Jane Doe',
          creatorUrl: 'javascript:alert(1)',
          sourceName: 'Flickr',
          sourceUrl: 'https://example.com/photo-1',
          license: 'CC BY 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: 'Invalid payload',
        issues: expect.any(Array),
      }),
    );
  });
});
