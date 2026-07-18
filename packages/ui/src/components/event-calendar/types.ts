/** Compact card height for week / time-grid views. */
export const FIXED_EVENT_HEIGHT_PX = 22;
/** Roomier cards for day view. */
export const FIXED_EVENT_HEIGHT_DAY_PX = 46;
/** Day-view hour slot height (60 minutes → 1px per minute). */
export const DAY_HOUR_HEIGHT_PX = 60;
/** Continuous zoom range for day/week time grids (px per hour). */
export const TIME_GRID_HOUR_HEIGHT_MIN = 32;
export const TIME_GRID_HOUR_HEIGHT_MAX = 120;
export const DEFAULT_TIME_GRID_HOUR_HEIGHT = DAY_HOUR_HEIGHT_PX;
/** Debounce before applying zoom to the time grid (slider stays instant). */
export const TIME_GRID_ZOOM_LAYOUT_DELAY_MS = 90;
/**
 * Animate top/height when zoom changes.
 * Prefer explicit properties over `transition-all` for smoother zoom.
 */
export const TIME_GRID_ZOOM_TRANSITION_CLASS =
  "transition-[top,height,min-height] duration-300 ease-out  motion-reduce:transition-none";
/** Fallback duration when service duration is missing. */
export const DEFAULT_EVENT_DURATION_MINUTES = 30;
/** Minimum rendered event block height. */
export const MIN_EVENT_HEIGHT_PX = 18;
/** Below this height, day/week cards show only the service name (patient subtitle hidden). */
export const APPOINTMENT_CARD_SUBTITLE_MIN_HEIGHT_PX = 38;
/** Compact labeled cards when week view is crowded. */
export const FIXED_EVENT_HEIGHT_DENSE_PX = 36;
/** @deprecated Use FIXED_EVENT_HEIGHT_DENSE_PX */
export const FIXED_EVENT_DENSE_PX = FIXED_EVENT_HEIGHT_DENSE_PX;
/** Max overlapping cards with full detail in week view before compact mode. */
export const MAX_DETAILED_COLUMNS = 4;
/** Day event count in week view above which compact labeled cards are used. */
export const WEEK_DENSE_DAY_THRESHOLD = 10;
/** Default height for hours without appointments. */
export const SMALL_HOUR_HEIGHT = 32;
/** Minimum height for hours that contain appointments. */
export const EXPANDED_HOUR_MIN_HEIGHT = 56;

export type CalendarDaySummary = {
  /** Local date key `YYYY-MM-DD`. */
  date: string;
  count: number;
  /** Heat intensity 0–4 when precomputed for year view. */
  level?: 0 | 1 | 2 | 3 | 4;
  /** Optional per-service breakdown for hover cards. */
  services?: Array<{ name: string; count: number }>;
  /**
   * Distinct statuses present on this day (at least one appointment each).
   * Used as fallback when service colors are unavailable.
   */
  statuses?: Array<{ status: number; count: number }>;
  /** Distinct service colors present on this day (preferred for day dots). */
  colors?: Array<{ color: string; count: number }>;
};

/** Dot colors for appointment statuses in year/month day cells. */
export const APPOINTMENT_STATUS_DOT_CLASS: Record<number, string> = {
  1: "bg-orange-500",
  2: "bg-emerald-500",
  3: "bg-red-500",
  4: "bg-red-600",
  5: "bg-rose-500",
};

/** Text colors for compact month appointment labels. */
export const APPOINTMENT_STATUS_TEXT_CLASS: Record<number, string> = {
  1: "text-orange-600 dark:text-orange-400",
  2: "text-emerald-600 dark:text-emerald-400",
  3: "text-red-600 dark:text-red-400",
  4: "text-red-700 dark:text-red-500",
  5: "text-rose-600 dark:text-rose-400",
};

export type CalendarView = "year" | "month" | "week" | "day";

export type CalendarEvent<TMeta = unknown> = {
  id: string | number;
  title: string;
  /** Secondary line shown under title (e.g. patient name). Prefer hover content. */
  subtitle?: string;
  /** Bold prefix on the subtitle line (e.g. patient public id `#12345`). */
  subtitleLead?: string;
  start: Date;
  end?: Date;
  /** Duration in minutes (typically from the service). Drives card height. */
  durationMinutes?: number;
  allDay?: boolean;
  /** Appointment status code for status-colored day dots. */
  status?: number;
  /**
   * Service calendar color as `#RRGGBB`.
   * When set, day/week cards use this instead of `colorClass`.
   */
  serviceColor?: string;
  /** Tailwind classes for card surface (background, text, border, hover). */
  colorClass?: string;
  /** Extra lines shown in the hover card when no custom renderer is provided. */
  hoverLines?: string[];
  meta?: TMeta;
};

export type BusinessBreak = {
  start: string;
  end: string;
};

export type BusinessDayHours = {
  start: string;
  end: string;
  dayOff?: boolean;
  breaks?: BusinessBreak[];
};

export type BusinessDayKey =
  | "Mon"
  | "Tue"
  | "Wed"
  | "Thu"
  | "Fri"
  | "Sat"
  | "Sun";

export type BusinessHours = Record<BusinessDayKey, BusinessDayHours>;

export type VisibleRange = {
  start: Date;
  end: Date;
};

export type TimeGridBounds = {
  startHour: number;
  endHour: number;
  /** @deprecated Use TimeGridLayout from hour-layout.ts */
  hourHeight: number;
};

export type DayBreak = BusinessBreak;

export const BUSINESS_DAY_KEYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

const defaultWeekday: BusinessDayHours = {
  start: "09:00",
  end: "17:00",
  dayOff: false,
  breaks: [],
};

const defaultWeekend: BusinessDayHours = {
  start: "09:00",
  end: "17:00",
  dayOff: true,
  breaks: [],
};

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  Mon: defaultWeekday,
  Tue: defaultWeekday,
  Wed: defaultWeekday,
  Thu: defaultWeekday,
  Fri: defaultWeekday,
  Sat: defaultWeekend,
  Sun: defaultWeekend,
};
