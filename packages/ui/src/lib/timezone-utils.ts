const FALLBACK_TIMEZONE = "UTC";

/** Returns the browser's IANA timezone, or UTC on the server / when unavailable. */
export function getBrowserTimezone(): string {
  if (typeof Intl === "undefined") return FALLBACK_TIMEZONE;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

/** Validates an IANA timezone identifier via Intl. */
export function isValidIanaTimezone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timeZone.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the effective timezone: saved user preference first, then browser.
 */
export function resolveTimezone(preferredTimeZone?: string | null): string {
  if (preferredTimeZone && isValidIanaTimezone(preferredTimeZone)) {
    return preferredTimeZone.trim();
  }
  return getBrowserTimezone();
}

let activePreferredTimeZone: string | null = null;

/** Updated by TimezoneProvider so non-React code (e.g. axios interceptors) can read the preference. */
export function setActivePreferredTimeZone(timeZone: string | null | undefined): void {
  activePreferredTimeZone =
    timeZone && isValidIanaTimezone(timeZone) ? timeZone.trim() : null;
}

export function getActivePreferredTimeZone(): string | null {
  return activePreferredTimeZone;
}

/** Effective timezone for API headers and formatting outside React context. */
export function getResolvedTimezone(): string {
  return resolveTimezone(activePreferredTimeZone);
}

export type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Civil date/time parts of an instant in the given IANA timezone. */
export function getZonedParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimezone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** YYYY-MM-DD for an instant in the given timezone. */
export function formatYmdInTimeZone(date: Date, timeZone: string): string {
  const { year, month, day } = getZonedParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Local Date whose wall-clock fields match `date` in `timeZone`.
 * Useful for calendar grids that compare days with date-fns in local time.
 */
export function toZonedWallClockDate(date: Date, timeZone: string): Date {
  const parts = getZonedParts(date, timeZone);
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

/** Start of "today" as a local civil date in the given timezone. */
export function getZonedToday(timeZone: string): Date {
  const parts = getZonedParts(new Date(), timeZone);
  return new Date(parts.year, parts.month - 1, parts.day);
}

/** Whether `date`'s local Y/M/D matches today in `timeZone`. */
export function isTodayInTimeZone(date: Date, timeZone: string): boolean {
  const today = getZonedParts(new Date(), timeZone);
  return (
    date.getFullYear() === today.year &&
    date.getMonth() + 1 === today.month &&
    date.getDate() === today.day
  );
}
