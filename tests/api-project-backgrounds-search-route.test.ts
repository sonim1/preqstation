import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => ({
  requireOwnerUser: vi.fn(),
  assertSameOrigin: vi.fn(),
  searchOpenversePhotos: vi.fn(),
}));

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/request-security', () => ({
  assertSameOrigin: mocked.assertSameOrigin,
}));

vi.mock('@/lib/openverse', async () => {
  const actual = await vi.importActual<typeof import('@/lib/openverse')>('@/lib/openverse');
  return {
    ...actual,
    searchOpenversePhotos: mocked.searchOpenversePhotos,
  };
});

import { GET } from '@/app/api/project-backgrounds/search/route';
import { OpenverseError } from '@/lib/openverse';

function getRequest(query: string) {
  return new Request(
    `${TEST_BASE_URL}/api/project-backgrounds/search?q=${encodeURIComponent(query)}`,
    {
      method: 'GET',
      headers: {
        origin: TEST_BASE_URL,
      },
    },
  );
}

describe('app/api/project-backgrounds/search/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.searchOpenversePhotos.mockResolvedValue([
      {
        id: 'photo-1',
        alt: 'Forest road',
        thumbUrl: 'https://api.openverse.org/v1/images/photo-1/thumb/',
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
      },
    ]);
  });

  it('respects the same-origin guard before auth or search', async () => {
    mocked.assertSameOrigin.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid origin' }), { status: 403 }),
    );

    const response = await GET(getRequest('forest'));

    expect(response.status).toBe(403);
    expect(mocked.requireOwnerUser).not.toHaveBeenCalled();
    expect(mocked.searchOpenversePhotos).not.toHaveBeenCalled();
  });

  it('returns the auth response when owner auth fails', async () => {
    mocked.requireOwnerUser.mockRejectedValueOnce(new Response('Unauthorized', { status: 401 }));

    const response = await GET(getRequest('forest'));

    expect(response.status).toBe(401);
    expect(mocked.searchOpenversePhotos).not.toHaveBeenCalled();
  });

  it('returns 400 for too-short queries', async () => {
    const response = await GET(getRequest('a'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: 'Invalid query',
        issues: expect.any(Array),
      }),
    );
    expect(mocked.searchOpenversePhotos).not.toHaveBeenCalled();
  });

  it('returns normalized search results', async () => {
    const response = await GET(getRequest('forest road'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      photos: [
        {
          id: 'photo-1',
          alt: 'Forest road',
          thumbUrl: 'https://api.openverse.org/v1/images/photo-1/thumb/',
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
        },
      ],
    });
    expect(mocked.searchOpenversePhotos).toHaveBeenCalledWith('forest road');
  });

  it('maps Openverse helper failures to controlled errors', async () => {
    mocked.searchOpenversePhotos.mockRejectedValueOnce(
      new OpenverseError('Failed to search Openverse.', 502),
    );

    const response = await GET(getRequest('forest'));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Failed to search Openverse.' });
  });
});
