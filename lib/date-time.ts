import { Temporal } from '@js-temporal/polyfill';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toInstant(value: Date | string) {
  if (value instanceof Date) {
    return Temporal.Instant.fromEpochMilliseconds(value.getTime());
  }

  return Temporal.Instant.from(value);
}

function toZonedDateTime(value: Date | string, timeZone: string) {
  return toInstant(value).toZonedDateTimeISO(resolveDisplayTimeZone(timeZone));
}

function formatDateParts(value: Temporal.ZonedDateTime) {
  return `${value.year}-${pad(value.month)}-${pad(value.day)}`;
}

export function isSupportedTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveDisplayTimeZone(savedValue?: string | null) {
  const candidate = savedValue?.trim();
  if (candidate && isSupportedTimeZone(candidate)) {
    return candidate;
  }

  const runtimeTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (runtimeTimeZone && isSupportedTimeZone(runtimeTimeZone)) {
    return runtimeTimeZone;
  }

  return 'UTC';
}

export function formatDateForDisplay(value: Date | string, timeZone: string) {
  return formatDateParts(toZonedDateTime(value, timeZone));
}

export function formatTimeForDisplay(value: Date | string, timeZone: string) {
  const zonedDateTime = toZonedDateTime(value, timeZone);
  return `${pad(zonedDateTime.hour)}:${pad(zonedDateTime.minute)}`;
}

export function formatDateTimeForDisplay(value: Date | string, timeZone: string) {
  return `${formatDateForDisplay(value, timeZone)} ${formatTimeForDisplay(value, timeZone)}`;
}

export function getDayRangeForTimeZone(timeZone: string, now: Date | string = new Date()) {
  const resolvedTimeZone = resolveDisplayTimeZone(timeZone);
  const zonedNow = toZonedDateTime(now, resolvedTimeZone);
  const start = Temporal.ZonedDateTime.from({
    timeZone: resolvedTimeZone,
    year: zonedNow.year,
    month: zonedNow.month,
    day: zonedNow.day,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
    microsecond: 0,
    nanosecond: 0,
  });
  const end = start.add({ days: 1 });

  return {
    start: new Date(start.epochMilliseconds),
    end: new Date(end.epochMilliseconds),
  };
}
