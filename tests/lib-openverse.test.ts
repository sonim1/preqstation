import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenverseError, searchOpenversePhotos } from '@/lib/openverse';

const mocked = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

describe('lib/openverse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocked.fetch);
    mocked.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              id: 'photo-1',
              title: 'Forest road',
              thumbnail: 'https://api.openverse.org/v1/images/photo-1/thumb/',
              url: 'https://cdn.openverse.org/photo-1.jpg',
              creator: 'Jane Doe',
              creator_url: 'https://example.com/jane',
              foreign_landing_url: 'https://example.com/photo-1',
              license: 'by',
              license_version: '4.0',
              license_url: 'https://creativecommons.org/licenses/by/4.0/',
              source: 'flickr',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the search request and maps the response for the picker', async () => {
    await expect(searchOpenversePhotos('forest road')).resolves.toEqual([
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

    expect(mocked.fetch).toHaveBeenCalledTimes(1);

    const [url, options] = mocked.fetch.mock.calls[0] as [string, RequestInit];
    const requestUrl = new URL(url);

    expect(requestUrl.origin + requestUrl.pathname).toBe('https://api.openverse.org/v1/images/');
    expect(requestUrl.searchParams.get('q')).toBe('forest road');
    expect(requestUrl.searchParams.get('category')).toBe('photograph');
    expect(requestUrl.searchParams.get('license')).toBe('cc0,by');
    expect(requestUrl.searchParams.get('page_size')).toBe('20');
    expect(options.cache).toBe('no-store');
  });

  it('maps upstream failures to a controlled error', async () => {
    mocked.fetch.mockResolvedValueOnce(new Response('upstream failed', { status: 500 }));

    await expect(searchOpenversePhotos('forest')).rejects.toEqual(
      expect.objectContaining<Partial<OpenverseError>>({
        message: 'Failed to search Openverse.',
        status: 502,
      }),
    );
  });
});
