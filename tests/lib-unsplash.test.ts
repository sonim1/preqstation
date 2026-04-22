import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { searchUnsplashPhotos, triggerUnsplashDownload, UnsplashError } from '@/lib/unsplash';

const mocked = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

describe('lib/unsplash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocked.fetch);
    mocked.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              id: 'photo-1',
              alt_description: 'Forest road',
              urls: {
                small: 'https://images.unsplash.com/photo-1?w=400&q=80',
                regular: 'https://images.unsplash.com/photo-1?w=1080&q=80',
              },
              user: {
                name: 'Jane Doe',
                links: {
                  html: 'https://unsplash.com/@janedoe',
                },
              },
              links: {
                html: 'https://unsplash.com/photos/photo-1',
                download_location: 'https://api.unsplash.com/photos/photo-1/download?ixid=abc',
              },
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
    await expect(searchUnsplashPhotos('forest road', 'test-unsplash-key')).resolves.toEqual([
      {
        id: 'photo-1',
        alt: 'Forest road',
        thumbUrl: 'https://images.unsplash.com/photo-1?w=400&q=80',
        regularUrl: 'https://images.unsplash.com/photo-1?w=1080&q=80',
        downloadLocation: 'https://api.unsplash.com/photos/photo-1/download?ixid=abc',
        credit: {
          provider: 'unsplash',
          creatorName: 'Jane Doe',
          creatorUrl: 'https://unsplash.com/@janedoe?utm_source=PREQSTATION&utm_medium=referral',
          sourceName: 'Unsplash',
          sourceUrl:
            'https://unsplash.com/photos/photo-1?utm_source=PREQSTATION&utm_medium=referral',
          license: 'Unsplash License',
          licenseUrl: 'https://unsplash.com/license',
        },
      },
    ]);

    expect(mocked.fetch).toHaveBeenCalledTimes(1);

    const [url, options] = mocked.fetch.mock.calls[0] as [string, RequestInit];
    const requestUrl = new URL(url);

    expect(requestUrl.origin + requestUrl.pathname).toBe('https://api.unsplash.com/search/photos');
    expect(requestUrl.searchParams.get('query')).toBe('forest road');
    expect(requestUrl.searchParams.get('orientation')).toBe('landscape');
    expect(requestUrl.searchParams.get('per_page')).toBe('20');
    expect(options.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Client-ID test-unsplash-key',
        'Accept-Version': 'v1',
      }),
    );
    expect(options.cache).toBe('no-store');
  });

  it('fails cleanly when an access key is not provided', async () => {
    await expect(searchUnsplashPhotos('forest', '  ')).rejects.toEqual(
      expect.objectContaining<Partial<UnsplashError>>({
        message: 'Unsplash access key is required.',
        status: 400,
      }),
    );

    expect(mocked.fetch).not.toHaveBeenCalled();
  });

  it('rejects download URLs that are not on the Unsplash API host', async () => {
    await expect(
      triggerUnsplashDownload('https://example.com/download', 'test-unsplash-key'),
    ).rejects.toEqual(
      expect.objectContaining<Partial<UnsplashError>>({
        message: 'Invalid Unsplash download URL.',
        status: 400,
      }),
    );

    expect(mocked.fetch).not.toHaveBeenCalled();
  });

  it('appends the access key when triggering the download endpoint', async () => {
    mocked.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await triggerUnsplashDownload(
      'https://api.unsplash.com/photos/photo-1/download?ixid=abc',
      'test-unsplash-key',
    );

    expect(mocked.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = mocked.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.unsplash.com/photos/photo-1/download?ixid=abc&client_id=test-unsplash-key',
    );
    expect(options).toEqual(
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
      }),
    );
  });
});
