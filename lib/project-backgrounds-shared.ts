export type ProjectBackgroundCredit = {
  provider: 'unsplash' | 'openverse';
  creatorName: string;
  creatorUrl: string | null;
  sourceName: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string | null;
};

const UNSPLASH_REFERRAL_URL = 'https://unsplash.com/?utm_source=PREQSTATION&utm_medium=referral';
const UNSPLASH_LICENSE_URL = 'https://unsplash.com/license';
const UNSPLASH_IMAGE_HOST = 'images.unsplash.com';

type BgVariant = 'card' | 'board' | 'portfolio';

const UNSPLASH_VARIANTS: Record<BgVariant, { width: string }> = {
  card: { width: '640' },
  board: { width: '1600' },
  portfolio: { width: '1600' },
};

function createUnsplashPresetCredit(creatorName: string): ProjectBackgroundCredit {
  return {
    provider: 'unsplash',
    creatorName,
    creatorUrl: null,
    sourceName: 'Unsplash',
    sourceUrl: UNSPLASH_REFERRAL_URL,
    license: 'Unsplash License',
    licenseUrl: UNSPLASH_LICENSE_URL,
  };
}

export const PROJECT_BG_PRESETS = [
  {
    id: 'mountains',
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80',
    label: 'Mountains',
    credit: createUnsplashPresetCredit('David Marcu'),
  },
  {
    id: 'ocean',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
    label: 'Ocean',
    credit: createUnsplashPresetCredit('Jeremy Bishop'),
  },
  {
    id: 'forest',
    url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80',
    label: 'Forest',
    credit: createUnsplashPresetCredit('Lukasz Szmigiel'),
  },
  {
    id: 'city',
    url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1200&q=80',
    label: 'City',
    credit: createUnsplashPresetCredit('Anders Jilden'),
  },
  {
    id: 'sunset',
    url: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1200&q=80',
    label: 'Sunset',
    credit: createUnsplashPresetCredit('Jakob Owens'),
  },
  {
    id: 'space',
    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1200&q=80',
    label: 'Space',
    credit: createUnsplashPresetCredit('NASA'),
  },
  {
    id: 'desert',
    url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=1200&q=80',
    label: 'Desert',
    credit: createUnsplashPresetCredit('Christian Joudrey'),
  },
  {
    id: 'snow',
    url: 'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1200&q=80',
    label: 'Snow',
    credit: createUnsplashPresetCredit('Eberhard Grossgasteiger'),
  },
  {
    id: 'aurora',
    url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1200&q=80',
    label: 'Aurora',
    credit: createUnsplashPresetCredit('Vincent Guth'),
  },
  {
    id: 'abstract',
    url: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1200&q=80',
    label: 'Abstract',
    credit: createUnsplashPresetCredit('Pawel Czerwinski'),
  },
] as const;

const PRESET_IDS: Set<string> = new Set(PROJECT_BG_PRESETS.map((p) => p.id));

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

function isOptionalHttpsUrl(value: unknown): value is string | null {
  return value === null || isHttpsUrl(value);
}

function isCreditString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isProjectBackgroundCredit(value: unknown): value is ProjectBackgroundCredit {
  if (!value || typeof value !== 'object') return false;
  const credit = value as Record<string, unknown>;

  return (
    (credit.provider === 'unsplash' || credit.provider === 'openverse') &&
    isCreditString(credit.creatorName, 200) &&
    isOptionalHttpsUrl(credit.creatorUrl) &&
    isCreditString(credit.sourceName, 120) &&
    isHttpsUrl(credit.sourceUrl) &&
    isCreditString(credit.license, 120) &&
    isOptionalHttpsUrl(credit.licenseUrl)
  );
}

function normalizeCredit(value: ProjectBackgroundCredit): ProjectBackgroundCredit {
  return {
    provider: value.provider,
    creatorName: value.creatorName.trim(),
    creatorUrl: value.creatorUrl ? new URL(value.creatorUrl.trim()).toString() : null,
    sourceName: value.sourceName.trim(),
    sourceUrl: new URL(value.sourceUrl.trim()).toString(),
    license: value.license.trim(),
    licenseUrl: value.licenseUrl ? new URL(value.licenseUrl.trim()).toString() : null,
  };
}

function resolveBgUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const preset = PROJECT_BG_PRESETS.find((p) => p.id === value);
  if (preset) return preset.url;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return value;
  } catch {
    // invalid URL
  }
  return null;
}

export function parseProjectBackgroundCredit(input: unknown) {
  if (input == null) {
    return { ok: true as const, value: null };
  }

  if (typeof input === 'string') {
    const text = input.trim();
    if (!text) {
      return { ok: true as const, value: null };
    }

    try {
      const parsed = JSON.parse(text);
      return isProjectBackgroundCredit(parsed)
        ? { ok: true as const, value: normalizeCredit(parsed) }
        : { ok: false as const, value: null };
    } catch {
      return { ok: false as const, value: null };
    }
  }

  return isProjectBackgroundCredit(input)
    ? { ok: true as const, value: normalizeCredit(input) }
    : { ok: false as const, value: null };
}

function applyUnsplashVariant(urlValue: string, variant: BgVariant) {
  const url = new URL(urlValue);

  if (url.hostname !== UNSPLASH_IMAGE_HOST) {
    return urlValue;
  }

  url.searchParams.set('w', UNSPLASH_VARIANTS[variant].width);
  url.searchParams.set('q', '80');
  url.searchParams.set('auto', 'format');
  url.searchParams.set('fit', 'max');

  return url.toString();
}

export function getBgUrlFromValue(value: string | null | undefined): string | null {
  return resolveBgUrl(value);
}

export function getProjectCardBgUrl(value: string | null | undefined): string | null {
  const url = resolveBgUrl(value);
  if (!url) return null;
  return applyUnsplashVariant(url, 'card');
}

export function getProjectBoardBgUrl(value: string | null | undefined): string | null {
  const url = resolveBgUrl(value);
  if (!url) return null;
  return applyUnsplashVariant(url, 'board');
}

export function getProjectPortfolioBgUrl(value: string | null | undefined): string | null {
  const url = resolveBgUrl(value);
  if (!url) return null;
  return applyUnsplashVariant(url, 'portfolio');
}

export function isValidBgValue(value: string | null | undefined): boolean {
  if (!value) return true;
  if (PRESET_IDS.has(value)) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
