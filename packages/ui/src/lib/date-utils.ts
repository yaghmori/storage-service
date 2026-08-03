/**
 * Date formatting utilities for the admin panel
 */

export type DateDisplayFormat = 'relative' | 'short' | 'long' | 'datetime';

/**
 * Parses a date input into a JS Date.
 *
 * Bare ISO 8601 date-only strings (`YYYY-MM-DD`) are intentionally parsed as
 * **local-midnight** rather than UTC-midnight. This avoids the well-known
 * off-by-one display bug for browsers west of UTC where `new Date("2026-05-02")`
 * is UTC midnight and renders as "May 1" in browser local time.
 *
 * Full ISO 8601 datetimes (with `T` or `Z`) and any other input go through the
 * standard `new Date(...)` constructor.
 */
function parseDateInput(date: Date | string | number): Date {
  if (date instanceof Date) return date;
  if (typeof date === "string") {
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (ymd) {
      const y = Number(ymd[1]);
      const m = Number(ymd[2]);
      const d = Number(ymd[3]);
      return new Date(y, m - 1, d);
    }
  }
  return new Date(date);
}

/**
 * Formats a date as relative time (e.g., "2 hours ago", "3 days ago")
 */
export function formatRelativeTime(date: Date | string | number): string {
  if (!date) return "";
  
  const now = new Date();
  const targetDate = parseDateInput(date);
  const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return "just now";
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths === 1 ? '' : 's'} ago`;
  }
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears === 1 ? '' : 's'} ago`;
}

/**
 * Formats a date in short format (e.g., "Sep 8, 2024")
 */
export function formatShortDate(
  date: Date | string | number,
  timeZone?: string,
): string {
  if (!date) return "";
  
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      ...(timeZone ? { timeZone } : {}),
    }).format(parseDateInput(date));
  } catch (_err) {
    return "";
  }
}

/**
 * Formats a date in long format (e.g., "September 8, 2024")
 */
export function formatLongDate(
  date: Date | string | number,
  timeZone?: string,
): string {
  if (!date) return "";
  
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      ...(timeZone ? { timeZone } : {}),
    }).format(parseDateInput(date));
  } catch (_err) {
    return "";
  }
}

/**
 * Formats a date with time (e.g., "Sep 8, 2024 at 3:33 PM")
 */
export function formatDateTime(
  date: Date | string | number,
  timeZone?: string,
): string {
  if (!date) return "";
  
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      ...(timeZone ? { timeZone } : {}),
    }).format(parseDateInput(date));
  } catch (_err) {
    return "";
  }
}

/**
 * Formats a date in UTC timezone
 */
export function formatUTCDate(date: Date | string | number): string {
  if (!date) return "";
  
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "UTC",
      hour12: false,
    }).format(parseDateInput(date));
  } catch (_err) {
    return "";
  }
}

/**
 * Formats a date in a specific timezone
 */
export function formatDateInTimezone(
  date: Date | string | number, 
  timezone: string 
): string {
  if (!date) return "";
  
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: timezone,
      hour12: false,
    }).format(parseDateInput(date));
  } catch (_err) {
    return "";
  }
}

/**
 * Gets timezone information including offset and abbreviation
 */
export function getTimezoneInfo(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    
    const parts = formatter.formatToParts(now);
    const timeZoneName = parts.find(part => part.type === "timeZoneName")?.value || "";
    
    return `${timezone} (${timeZoneName})`;
  } catch (_err) {
    return timezone;
  }
}

/**
 * Gets the timestamp in milliseconds
 */
export function getTimestamp(date: Date | string | number): string {
  if (!date) return "";
  
  try {
    return parseDateInput(date).getTime().toString();
  } catch (_err) {
    return "";
  }
}

/**
 * Main date formatter that returns the appropriate format based on the display type
 */
export function formatDate(
  date: Date | string | number | undefined,
  format: DateDisplayFormat = 'short',
  timeZone?: string,
): string {
  if (!date) return "";

  switch (format) {
    case 'relative':
      return formatRelativeTime(date);
    case 'short':
      return formatShortDate(date, timeZone);
    case 'long':
      return formatLongDate(date, timeZone);
    case 'datetime':
      return formatDateTime(date, timeZone);
    default:
      return formatShortDate(date, timeZone);
  }
}

