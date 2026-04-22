import type { ProjectBackgroundCredit } from '@/lib/project-backgrounds';

const OPENVERSE_SEARCH_ENDPOINT = 'https://api.openverse.org/v1/images/';
const OPENVERSE_RESULTS_PER_PAGE = 20;

type OpenverseImageResult = {
  id?: string;
  title?: string | null;
  thumbnail?: string | null;
  url?: string | null;
  creator?: string | null;
  creator_url?: string | null;
  foreign_landing_url?: string | null;
  license?: string | null;
  license_version?: string | null;
  license_url?: string | null;
  source?: string | null;
};

type OpenverseSearchResponse = {
  results?: OpenverseImageResult[];
};

export type OpenversePickerPhoto = {
  id: string;
  alt: string;
  thumbUrl: string;
  regularUrl: string;
  credit: ProjectBackgroundCredit;
};

export class OpenverseError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'OpenverseError';
    this.status = status;
  }
}

function toHttpsUrl(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return null;

  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatLicense(license: string | null | undefined, version: string | null | undefined) {
  const normalized = (license || '').trim().toLowerCase();
  const normalizedVersion = (version || '').trim();

  if (normalized === 'cc0') return 'CC0';
  if (normalized === 'by') {
    return normalizedVersion ? `CC BY ${normalizedVersion}` : 'CC BY';
  }

  const base = normalized ? normalized.toUpperCase() : 'Open license';
  return normalizedVersion ? `${base} ${normalizedVersion}` : base;
}

function formatSourceName(source: string | null | undefined) {
  const normalized = (source || '').trim();
  if (!normalized) return 'Openverse';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function mapOpenversePhoto(photo: OpenverseImageResult): OpenversePickerPhoto | null {
  const id = photo.id?.trim();
  const thumbUrl = toHttpsUrl(photo.thumbnail);
  const regularUrl = toHttpsUrl(photo.url);
  const sourceUrl = toHttpsUrl(photo.foreign_landing_url);
  const creatorUrl = toHttpsUrl(photo.creator_url);
  const licenseUrl = toHttpsUrl(photo.license_url);

  if (!id || !thumbUrl || !regularUrl || !sourceUrl) {
    return null;
  }

  return {
    id,
    alt: photo.title?.trim() || 'Openverse photo',
    thumbUrl,
    regularUrl,
    credit: {
      provider: 'openverse',
      creatorName: photo.creator?.trim() || 'Unknown creator',
      creatorUrl,
      sourceName: formatSourceName(photo.source),
      sourceUrl,
      license: formatLicense(photo.license, photo.license_version),
      licenseUrl,
    },
  };
}

export async function searchOpenversePhotos(query: string): Promise<OpenversePickerPhoto[]> {
  const url = new URL(OPENVERSE_SEARCH_ENDPOINT);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('category', 'photograph');
  url.searchParams.set('license', 'cc0,by');
  url.searchParams.set('page_size', String(OPENVERSE_RESULTS_PER_PAGE));

  const response = await fetch(url.toString(), { cache: 'no-store' });

  if (!response.ok) {
    throw new OpenverseError('Failed to search Openverse.', 502);
  }

  const payload = (await response.json()) as OpenverseSearchResponse;
  return Array.isArray(payload.results)
    ? payload.results
        .map(mapOpenversePhoto)
        .filter((photo): photo is OpenversePickerPhoto => !!photo)
    : [];
}
