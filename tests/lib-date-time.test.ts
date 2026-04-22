import { describe, expect, it } from 'vitest';

import { SETTING_DEFAULTS, SETTING_KEYS } from '@/lib/user-settings';

type DateTimeModule = {
  getDayRangeForTimeZone?: (timeZone: string, now: Date | string) => { start: Date; end: Date };
  formatDateForDisplay?: (value: Date | string, timeZone: string) => string;
  formatDateTimeForDisplay?: (value: Date | string, timeZone: string) => string;
  formatTimeForDisplay?: (value: Date | string, timeZone: string) => string;
  isSupportedTimeZone?: (value: string) => boolean;
  resolveDisplayTimeZone?: (savedValue: string | null | undefined) => string;
};

async function loadDateTimeModule(): Promise<DateTimeModule> {
  try {
    return await import('@/lib/date-time');
  } catch {
    return {};
  }
}

describe('lib/date-time', () => {
  it('registers timezone as a supported user setting', () => {
    expect(SETTING_KEYS).toHaveProperty('TIMEZONE', 'timezone');
    expect(SETTING_DEFAULTS.timezone).toBe('');
  });

  it('validates supported IANA time zones and falls back for invalid saved values', async () => {
    const { isSupportedTimeZone, resolveDisplayTimeZone } = await loadDateTimeModule();

    expect(typeof isSupportedTimeZone).toBe('function');
    expect(typeof resolveDisplayTimeZone).toBe('function');
    expect(isSupportedTimeZone?.('America/Toronto')).toBe(true);
    expect(isSupportedTimeZone?.('Mars/Olympus')).toBe(false);
    expect(resolveDisplayTimeZone?.('America/Toronto')).toBe('America/Toronto');
    expect(resolveDisplayTimeZone?.('Mars/Olympus')).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    );
  });

  it('formats date-only, time-only, and date-time strings with zero padding', async () => {
    const {
      formatDateForDisplay,
      formatDateTimeForDisplay,
      formatTimeForDisplay,
      resolveDisplayTimeZone,
    } = await loadDateTimeModule();

    expect(typeof formatDateForDisplay).toBe('function');
    expect(typeof formatDateTimeForDisplay).toBe('function');
    expect(typeof formatTimeForDisplay).toBe('function');

    const timeZone = resolveDisplayTimeZone?.('UTC') ?? 'UTC';
    const value = '2026-03-25T13:05:00.000Z';

    expect(formatDateForDisplay?.(value, timeZone)).toBe('2026-03-25');
    expect(formatTimeForDisplay?.(value, timeZone)).toBe('13:05');
    expect(formatDateTimeForDisplay?.(value, timeZone)).toBe('2026-03-25 13:05');
  });

  it('builds day ranges from the saved timezone instead of raw UTC midnight', async () => {
    const { formatDateForDisplay, getDayRangeForTimeZone } = await loadDateTimeModule();

    expect(typeof formatDateForDisplay).toBe('function');
    expect(typeof getDayRangeForTimeZone).toBe('function');

    const sameInstant = '2026-03-25T02:30:00.000Z';
    const utcRange = getDayRangeForTimeZone?.('UTC', sameInstant);
    const torontoRange = getDayRangeForTimeZone?.('America/Toronto', sameInstant);

    expect(formatDateForDisplay?.(sameInstant, 'UTC')).toBe('2026-03-25');
    expect(formatDateForDisplay?.(sameInstant, 'America/Toronto')).toBe('2026-03-24');
    expect(utcRange?.start.toISOString()).toBe('2026-03-25T00:00:00.000Z');
    expect(utcRange?.end.toISOString()).toBe('2026-03-26T00:00:00.000Z');
    expect(torontoRange?.start.toISOString()).toBe('2026-03-24T04:00:00.000Z');
    expect(torontoRange?.end.toISOString()).toBe('2026-03-25T04:00:00.000Z');
  });
});
