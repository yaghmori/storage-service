import type { CalendarEvent } from "./types";
import {
  DAY_HOUR_HEIGHT_PX,
  DEFAULT_EVENT_DURATION_MINUTES,
  EXPANDED_HOUR_MIN_HEIGHT,
  MIN_EVENT_HEIGHT_PX,
  SMALL_HOUR_HEIGHT,
} from "./types";

/** `minute` = equal 60ths of the hour (day view). `fit` = compact week layout. */
export type TimeGridPositioning = "fit" | "minute";

export type TimeGridLayout = {
  startHour: number;
  endHour: number;
  hourHeights: number[];
  hourTops: number[];
  totalHeight: number;
  positioning: TimeGridPositioning;
};

export type BuildTimeGridLayoutOptions = {
  positioning?: TimeGridPositioning;
  /** Fixed hour height when `positioning` is `"minute"`. */
  hourHeight?: number;
};

const HOUR_PADDING_PX = 6;
/** Keep event cards below the hour rule in fit mode. */
const HOUR_LINE_GAP_PX = 3;

function maxBottomInHour(
  hourEvents: CalendarEvent[],
  hourHeight: number,
  cardHeight: number,
): number {
  let maxBottom = 0;
  for (const event of hourEvents) {
    const minute = event.start.getMinutes();
    const usable = Math.max(
      0,
      hourHeight - cardHeight - HOUR_LINE_GAP_PX - HOUR_PADDING_PX,
    );
    const topInHour = HOUR_LINE_GAP_PX + (minute / 60) * usable;
    maxBottom = Math.max(maxBottom, topInHour + cardHeight);
  }
  return maxBottom;
}

function computeHourHeight(
  hourEvents: CalendarEvent[],
  cardHeight: number,
): number {
  if (hourEvents.length === 0) return SMALL_HOUR_HEIGHT;

  let height = Math.max(
    EXPANDED_HOUR_MIN_HEIGHT,
    cardHeight + HOUR_LINE_GAP_PX + HOUR_PADDING_PX,
  );

  for (let i = 0; i < 8; i++) {
    const bottom = maxBottomInHour(hourEvents, height, cardHeight);
    const needed = bottom + HOUR_PADDING_PX;
    if (needed <= height) break;
    height = needed;
  }

  return height;
}

function buildHourTops(hourHeights: number[]): {
  hourTops: number[];
  totalHeight: number;
} {
  const hourTops: number[] = [];
  let y = 0;
  for (const h of hourHeights) {
    hourTops.push(y);
    y += h;
  }
  return { hourTops, totalHeight: y };
}

export function buildTimeGridLayout(
  startHour: number,
  endHour: number,
  events: CalendarEvent[],
  cardHeight: number,
  options?: BuildTimeGridLayoutOptions,
): TimeGridLayout {
  const positioning = options?.positioning ?? "fit";
  const hourCount = Math.max(0, endHour - startHour);

  if (positioning === "minute") {
    const hourHeight = options?.hourHeight ?? DAY_HOUR_HEIGHT_PX;
    const hourHeights = Array.from({ length: hourCount }, () => hourHeight);
    const { hourTops, totalHeight } = buildHourTops(hourHeights);
    return {
      startHour,
      endHour,
      hourHeights,
      hourTops,
      totalHeight,
      positioning,
    };
  }

  const hourHeights = Array.from({ length: hourCount }, (_, i) => {
    const hour = startHour + i;
    const hourEvents = events.filter((e) => e.start.getHours() === hour);
    return computeHourHeight(hourEvents, cardHeight);
  });

  const { hourTops, totalHeight } = buildHourTops(hourHeights);

  return {
    startHour,
    endHour,
    hourHeights,
    hourTops,
    totalHeight,
    positioning,
  };
}

/** Fraction of an hour from minutes + seconds (0–1). */
function minuteFraction(date: Date): number {
  return (date.getMinutes() + date.getSeconds() / 60) / 60;
}

export function getEventTopPx(
  event: CalendarEvent,
  layout: TimeGridLayout,
  cardHeight: number,
): number {
  const hour = event.start.getHours();
  const idx = hour - layout.startHour;
  if (idx < 0 || idx >= layout.hourHeights.length) return 0;

  const hourTop = layout.hourTops[idx] ?? 0;
  const hourHeight = layout.hourHeights[idx] ?? SMALL_HOUR_HEIGHT;
  const fraction = minuteFraction(event.start);

  if (layout.positioning === "minute") {
    // Equal 60ths of the hour slot — :00 at top, :30 halfway, :59 near bottom.
    return hourTop + fraction * hourHeight;
  }

  const usable = Math.max(
    0,
    hourHeight - cardHeight - HOUR_LINE_GAP_PX - HOUR_PADDING_PX,
  );
  const topInHour = HOUR_LINE_GAP_PX + fraction * usable;

  const maxTopInHour = Math.max(
    HOUR_LINE_GAP_PX,
    hourHeight - cardHeight - HOUR_PADDING_PX,
  );
  return hourTop + Math.min(topInHour, maxTopInHour);
}

export function getHourLineTop(layout: TimeGridLayout, hour: number): number {
  const idx = hour - layout.startHour;
  return layout.hourTops[idx] ?? 0;
}

export function getHourLineHeight(layout: TimeGridLayout, hour: number): number {
  const idx = hour - layout.startHour;
  return layout.hourHeights[idx] ?? SMALL_HOUR_HEIGHT;
}

export function getTimeTopPx(date: Date, layout: TimeGridLayout): number {
  return getEventTopPx({ start: date } as CalendarEvent, layout, 0);
}

export function getHourBottomPx(layout: TimeGridLayout, hour: number): number {
  const idx = hour - layout.startHour;
  if (idx < 0 || idx >= layout.hourHeights.length) return 0;
  return (layout.hourTops[idx] ?? 0) + (layout.hourHeights[idx] ?? 0);
}

export function getEventDurationMinutes(event: CalendarEvent): number {
  if (event.durationMinutes != null && event.durationMinutes > 0) {
    return event.durationMinutes;
  }
  if (event.end) {
    const mins = (event.end.getTime() - event.start.getTime()) / 60_000;
    if (mins > 0) return mins;
  }
  return DEFAULT_EVENT_DURATION_MINUTES;
}

/**
 * Card height from service duration (minutes → px using the hour slot scale).
 * 60-minute service fills one hour row; 30-minute is half, etc.
 */
export function getEventHeightPx(
  event: CalendarEvent,
  layout: TimeGridLayout,
  _fallbackHeight: number,
): number {
  const minutes = getEventDurationMinutes(event);
  const hourHeight =
    layout.positioning === "minute"
      ? (layout.hourHeights[0] ?? DAY_HOUR_HEIGHT_PX)
      : DAY_HOUR_HEIGHT_PX;
  return Math.max(MIN_EVENT_HEIGHT_PX, (minutes / 60) * hourHeight);
}
