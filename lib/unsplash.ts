import type { ProjectBackgroundCredit } from '@/lib/project-backgrounds';

const UNSPLASH_SEARCH_ENDPOINT = 'https://api.unsplash.com/search/photos';
const UNSPLASH_API_HOST = 'api.unsplash.com';
const UNSPLASH_RESULTS_PER_PAGE = 20;
const UNSPLASH_REFERRAL_SOURCE = 'PREQSTATION';
const UNSPLASH_REFERRAL_MEDIUM = 'referral';
const UNSPLASH_SOURCE_NAME = 'Unsplash';
const UNSPLASH_LICENSE_NAME = 'Unsplash License';
const UNSPLASH_LICENSE_URL = 'https://unsplash.com/license';

type UnsplashPhotoResult = {
  id?: string;
  alt_description?: string | null;
  description?: string | null;
  urls?: {
    small?: string | null;
    regular?: string | null;
  };
  user?: {
    name?: string | null;
    links?: {
      html?: string | null;
    };
  };
  links?: {
    html?: string | null;
    download_location?: string | null;
  };
};

type UnsplashSearchResponse = {
  results?: UnsplashPhotoResult[];
};

export type UnsplashPickerPhoto = {
  id: string;
  alt: string;
  thumbUrl: string;
  regularUrl: string;
  downloadLocation: string;
  credit: ProjectBackgroundCredit;
};

export class UnsplashError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'UnsplashError';
    this.status = status;
  }
}

function requireUnsplashAccessKey(accessKey: string) {
  const normalized = accessKey.trim();
  if (!normalized) {
    throw new UnsplashError('Unsplash access key is required.', 400);
  }
  return normalized;
}

function toHttpsUrl(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return null;

  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function withUnsplashReferral(urlValue: string | null | undefined) {
  const url = toHttpsUrl(urlValue);
  if (!url) return null;

  if (url.hostname !== 'unsplash.com' && !url.hostname.endsWith('.unsplash.com')) {
    return url.toString();
  }

  url.searchParams.set('utm_source', UNSPLASH_REFERRAL_SOURCE);
  url.searchParams.set('utm_medium', UNSPLASH_REFERRAL_MEDIUM);
  return url.toString();
}

function mapUnsplashPhoto(photo: UnsplashPhotoResult): UnsplashPickerPhoto | null {
  const id = photo.id?.trim();
  const thumbUrl = toHttpsUrl(photo.urls?.small)?.toString() ?? null;
  const regularUrl = toHttpsUrl(photo.urls?.regular)?.toString() ?? null;
  const sourceUrl = withUnsplashReferral(photo.links?.html);
  const creatorUrl = withUnsplashReferral(photo.user?.links?.html);
  const downloadLocation = toHttpsUrl(photo.links?.download_location)?.toString() ?? null;

  if (!id || !thumbUrl || !regularUrl || !sourceUrl || !downloadLocation) {
    return null;
  }

  return {
    id,
    alt: photo.alt_description?.trim() || photo.description?.trim() || 'Unsplash photo',
    thumbUrl,
    regularUrl,
    downloadLocation,
    credit: {
      provider: 'unsplash',
      creatorName: photo.user?.name?.trim() || 'Unsplash contributor',
      creatorUrl,
      sourceName: UNSPLASH_SOURCE_NAME,
      sourceUrl,
      license: UNSPLASH_LICENSE_NAME,
      licenseUrl: UNSPLASH_LICENSE_URL,
    },
  };
}

function assertUnsplashDownloadUrl(downloadLocation: string) {
  const url = toHttpsUrl(downloadLocation);

  if (!url || url.hostname !== UNSPLASH_API_HOST) {
    throw new UnsplashError('Invalid Unsplash download URL.', 400);
  }

  return url;
}

export async function searchUnsplashPhotos(
  query: string,
  accessKey: string,
): Promise<UnsplashPickerPhoto[]> {
  const normalizedAccessKey = requireUnsplashAccessKey(accessKey);
  const url = new URL(UNSPLASH_SEARCH_ENDPOINT);
  url.searchParams.set('query', query.trim());
  url.searchParams.set('orientation', 'landscape');
  url.searchParams.set('per_page', String(UNSPLASH_RESULTS_PER_PAGE));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Client-ID ${normalizedAccessKey}`,
      'Accept-Version': 'v1',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new UnsplashError('Failed to search Unsplash.', 502);
  }

  const payload = (await response.json()) as UnsplashSearchResponse;
  return Array.isArray(payload.results)
    ? payload.results.map(mapUnsplashPhoto).filter((photo): photo is UnsplashPickerPhoto => !!photo)
    : [];
}

export async function triggerUnsplashDownload(downloadLocation: string, accessKey: string) {
  const normalizedAccessKey = requireUnsplashAccessKey(accessKey);
  const url = assertUnsplashDownloadUrl(downloadLocation);
  url.searchParams.set('client_id', normalizedAccessKey);

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new UnsplashError('Failed to trigger Unsplash download.', 502);
  }
}
