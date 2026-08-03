import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";
import type {
  BusinessDayHours,
  BusinessDayKey,
  BusinessHours,
  CalendarEvent,
  CalendarView,
  TimeGridBounds,
  VisibleRange,
} from "./types";
import { DEFAULT_BUSINESS_HOURS } from "./types";

const JS_DAY_TO_KEY: Record<number, BusinessDayKey> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

export const DEFAULT_HOUR_HEIGHT = 32;
export const DEFAULT_GRID_START_HOUR = 6;
export const DEFAULT_GRID_END_HOUR = 20;

/**
 * Weekday key for business-hours lookup.
 *
 * Calendar dates are wall-clock civil dates in the display timezone
 * (`toZonedWallClockDate`). Use the Date's local weekday — do not re-apply
 * `timeZone` via Intl, or Mon/Sun day-off flags shift when the browser TZ
 * differs from the clinic/user timezone.
 */
export function getBusinessDayKey(
  date: Date,
  _timeZone?: string,
): BusinessDayKey {
  return JS_DAY_TO_KEY[date.getDay()] ?? "Mon";
}

export function getDayHours(
  date: Date,
  businessHours?: BusinessHours,
  timeZone?: string,
): BusinessDayHours {
  const key = getBusinessDayKey(date, timeZone);
  return businessHours?.[key] ?? DEFAULT_BUSINESS_HOURS[key];
}

export function parseTimeOnDate(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return result;
}

/**
 * Open days from App Settings business hours for the business week (Mon–Sun)
 * containing `date`. Only days with `dayOff !== true`.
 */
export function getAvailableDaysInWeek(
  date: Date,
  businessHours?: BusinessHours,
  timeZone?: string,
): Date[] {
  // Monday-start week so open days follow the business calendar, not Sun–Sat.
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const available = weekDays.filter(
    (day) => !getDayHours(day, businessHours, timeZone).dayOff,
  );
  // If every day is marked off, fall back to the full week so the grid is not empty.
  return available.length > 0 ? available : weekDays;
}

function formatDayRangeLabel(start: Date, end: Date): string {
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  }
  return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
}

export function getVisibleRange(
  date: Date,
  view: CalendarView,
  businessHours?: BusinessHours,
  timeZone?: string,
): VisibleRange {
  switch (view) {
    case "day":
      return { start: startOfDay(date), end: endOfDay(date) };
    case "week": {
      const days = getAvailableDaysInWeek(date, businessHours, timeZone);
      const first = days[0] ?? date;
      const last = days[days.length - 1] ?? date;
      return { start: startOfDay(first), end: endOfDay(last) };
    }
    case "month":
      return {
        start: startOfWeek(startOfMonth(date), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(date), { weekStartsOn: 0 }),
      };
    case "year":
      return { start: startOfYear(date), end: endOfYear(date) };
  }
}

export function navigateDate(
  date: Date,
  view: CalendarView,
  direction: "prev" | "next",
): Date {
  const delta = direction === "next" ? 1 : -1;
  switch (view) {
    case "day":
      return delta > 0 ? addDays(date, 1) : subDays(date, 1);
    case "week":
      return delta > 0 ? addWeeks(date, 1) : subWeeks(date, 1);
    case "month":
      return delta > 0 ? addMonths(date, 1) : subMonths(date, 1);
    case "year":
      return delta > 0 ? addYears(date, 1) : subYears(date, 1);
  }
}

export function getToolbarLabel(
  date: Date,
  view: CalendarView,
  businessHours?: BusinessHours,
  timeZone?: string,
): string {
  switch (view) {
    case "day":
      return format(date, "EEEE, MMMM d, yyyy");
    case "week": {
      const days = getAvailableDaysInWeek(date, businessHours, timeZone);
      const start = days[0] ?? date;
      const end = days[days.length - 1] ?? date;
      return formatDayRangeLabel(start, end);
    }
    case "month":
      return format(date, "MMMM yyyy");
    case "year":
      return format(date, "yyyy");
  }
}

export function getTimeGridBounds(
  days: Date[],
  businessHours?: BusinessHours,
  timeZone?: string,
): TimeGridBounds {
  let minMinutes: number | null = null;
  let maxMinutes: number | null = null;

  for (const day of days) {
    const hours = getDayHours(day, businessHours, timeZone);
    if (hours.dayOff) continue;
    const [startH, startM] = hours.start.split(":").map(Number);
    const [endH, endM] = hours.end.split(":").map(Number);
    const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
    const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);
    minMinutes =
      minMinutes == null ? startMinutes : Math.min(minMinutes, startMinutes);
    maxMinutes =
      maxMinutes == null ? endMinutes : Math.max(maxMinutes, endMinutes);
  }

  // Fall back only when no open business days in range.
  if (minMinutes == null || maxMinutes == null) {
    return {
      startHour: DEFAULT_GRID_START_HOUR,
      endHour: DEFAULT_GRID_END_HOUR,
      hourHeight: DEFAULT_HOUR_HEIGHT,
    };
  }

  // Exact business-hour window — no extra hours before/after.
  const startHour = Math.max(0, Math.floor(minMinutes / 60));
  const endHour = Math.min(24, Math.max(startHour + 1, Math.ceil(maxMinutes / 60)));

  return {
    startHour,
    endHour,
    hourHeight: DEFAULT_HOUR_HEIGHT,
  };
}

export function getEventsForDay<T>(
  events: CalendarEvent<T>[],
  day: Date,
): CalendarEvent<T>[] {
  return events
    .filter((event) => isSameDay(event.start, day))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function eventOverlapsDay<T>(event: CalendarEvent<T>, day: Date): boolean {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const eventStart = event.start;
  const eventEnd = event.end ?? event.start;
  return eventStart <= dayEnd && eventEnd >= dayStart;
}

export function getEventsInRange<T>(
  events: CalendarEvent<T>[],
  range: VisibleRange,
): CalendarEvent<T>[] {
  return events.filter(
    (event) => event.start <= range.end && (event.end ?? event.start) >= range.start,
  );
}

export function getMonthWeeks(date: Date): Date[][] {
  const range = getVisibleRange(date, "month");
  const days = eachDayOfInterval(range);
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function getYearMonths(date: Date): Date[] {
  const year = date.getFullYear();
  return Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
}

export function countEventsOnDay<T>(
  events: CalendarEvent<T>[],
  day: Date,
): number {
  return events.filter((event) => eventOverlapsDay(event, day)).length;
}

export { isSameDay, isSameMonth, isToday, format };
