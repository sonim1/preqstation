import { describe, expect, it } from 'vitest';

import {
  getBgUrlFromValue,
  getProjectBackgroundCredit,
  getProjectBoardBgUrl,
  getProjectCardBgUrl,
  getProjectPortfolioBgUrl,
  isValidBgValue,
  PROJECT_BG_PRESETS,
} from '@/lib/project-backgrounds';

describe('lib/project-backgrounds', () => {
  it('still resolves preset ids for card views', () => {
    const url = getProjectCardBgUrl('mountains');

    expect(url).not.toBeNull();
    expect(new URL(String(url)).hostname).toBe('images.unsplash.com');
    expect(new URL(String(url)).searchParams.get('w')).toBe('640');
  });

  it('keeps non-Unsplash https URLs unchanged', () => {
    const value = 'https://example.com/background.jpg?fit=crop';

    expect(getProjectCardBgUrl(value)).toBe(value);
    expect(getProjectBoardBgUrl(value)).toBe(value);
  });

  it('rewrites Unsplash URLs for smaller project card variants', () => {
    const url = getProjectCardBgUrl('https://images.unsplash.com/photo-123?w=1200&q=70&ixid=abc');

    expect(url).not.toBeNull();

    const parsed = new URL(String(url));
    expect(parsed.searchParams.get('w')).toBe('640');
    expect(parsed.searchParams.get('q')).toBe('80');
    expect(parsed.searchParams.get('auto')).toBe('format');
    expect(parsed.searchParams.get('fit')).toBe('max');
    expect(parsed.searchParams.get('ixid')).toBe('abc');
  });

  it('rewrites Unsplash URLs for larger board variants', () => {
    const url = getProjectBoardBgUrl('https://images.unsplash.com/photo-123?w=1200&q=70&ixid=abc');

    expect(url).not.toBeNull();

    const parsed = new URL(String(url));
    expect(parsed.searchParams.get('w')).toBe('1600');
    expect(parsed.searchParams.get('q')).toBe('80');
    expect(parsed.searchParams.get('auto')).toBe('format');
    expect(parsed.searchParams.get('fit')).toBe('max');
    expect(parsed.searchParams.get('ixid')).toBe('abc');
  });

  it('rewrites preset ids for portfolio cards without changing other helpers', () => {
    const url = getProjectPortfolioBgUrl('mountains');

    expect(url).not.toBeNull();
    expect(new URL(String(url)).hostname).toBe('images.unsplash.com');
    expect(new URL(String(url)).searchParams.get('w')).toBe('1600');
    expect(new URL(String(url)).searchParams.get('q')).toBe('80');
  });

  it('rewrites Unsplash URLs for the portfolio card variant', () => {
    const url = getProjectPortfolioBgUrl(
      'https://images.unsplash.com/photo-123?w=1200&q=70&ixid=abc',
    );

    expect(url).not.toBeNull();

    const parsed = new URL(String(url));
    expect(parsed.searchParams.get('w')).toBe('1600');
    expect(parsed.searchParams.get('q')).toBe('80');
    expect(parsed.searchParams.get('auto')).toBe('format');
    expect(parsed.searchParams.get('fit')).toBe('max');
    expect(parsed.searchParams.get('ixid')).toBe('abc');
  });

  it('stores named Unsplash creators for every preset credit', () => {
    expect(PROJECT_BG_PRESETS.every((preset) => preset.credit.provider === 'unsplash')).toBe(true);
    expect(
      PROJECT_BG_PRESETS.every(
        (preset) =>
          preset.credit.creatorName.trim().length > 0 && preset.credit.creatorName !== 'Unsplash',
      ),
    ).toBe(true);
    expect(PROJECT_BG_PRESETS.every((preset) => preset.credit.sourceName === 'Unsplash')).toBe(
      true,
    );
    expect(getProjectBackgroundCredit('mountains', null)).toEqual(
      expect.objectContaining({
        provider: 'unsplash',
        sourceName: 'Unsplash',
      }),
    );
  });

  it('resolves stored credits for custom backgrounds', () => {
    expect(
      getProjectBackgroundCredit('https://cdn.openverse.org/photo-1.jpg', {
        provider: 'openverse',
        creatorName: 'Jane Doe',
        creatorUrl: 'https://example.com/jane',
        sourceName: 'Flickr',
        sourceUrl: 'https://example.com/photo-1',
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      }),
    ).toEqual(
      expect.objectContaining({
        provider: 'openverse',
        creatorName: 'Jane Doe',
        license: 'CC BY 4.0',
      }),
    );
  });

  it('rejects invalid background values the same way as before', () => {
    expect(getBgUrlFromValue('javascript:alert(1)')).toBeNull();
    expect(getProjectCardBgUrl('not-a-url')).toBeNull();
    expect(getProjectBoardBgUrl('not-a-url')).toBeNull();
    expect(getProjectPortfolioBgUrl('not-a-url')).toBeNull();
    expect(isValidBgValue('not-a-url')).toBe(false);
  });

  it('keeps non-Unsplash https URLs unchanged for portfolio cards', () => {
    const value = 'https://example.com/background.jpg?fit=crop';

    expect(getProjectPortfolioBgUrl(value)).toBe(value);
  });
});
