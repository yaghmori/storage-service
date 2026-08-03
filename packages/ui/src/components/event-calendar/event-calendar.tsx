"use client";

import { ElasticSlider, Skeleton } from "@workspace/ui/components";
import { getZonedToday } from "@workspace/ui/lib/timezone-utils";
import { cn } from "@workspace/ui/lib/utils";
import { format } from "date-fns";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarStatusBar } from "./calendar-status-bar";
import { EventCalendarToolbar } from "./event-calendar-toolbar";
import type {
  BusinessHours,
  CalendarDaySummary,
  CalendarEvent,
  CalendarView,
} from "./types";
import {
  DEFAULT_TIME_GRID_HOUR_HEIGHT,
  TIME_GRID_HOUR_HEIGHT_MAX,
  TIME_GRID_HOUR_HEIGHT_MIN,
  TIME_GRID_ZOOM_LAYOUT_DELAY_MS,
} from "./types";
import { getAvailableDaysInWeek, navigateDate } from "./utils";
import { DayView } from "./views/day-view";
import { MonthView } from "./views/month-view";
import { WeekView } from "./views/week-view";
import { YearView } from "./views/year-view";

const HOUR_HEIGHT_STORAGE_KEY = "event-calendar.hourHeightPx";

function clampHourHeight(px: number): number {
  return Math.min(
    TIME_GRID_HOUR_HEIGHT_MAX,
    Math.max(TIME_GRID_HOUR_HEIGHT_MIN, Math.round(px)),
  );
}

function readStoredHourHeight(): number {
  if (typeof window === "undefined") return DEFAULT_TIME_GRID_HOUR_HEIGHT;
  try {
    const raw = window.localStorage.getItem(HOUR_HEIGHT_STORAGE_KEY);
    if (raw == null || raw === "") return DEFAULT_TIME_GRID_HOUR_HEIGHT;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_TIME_GRID_HOUR_HEIGHT;
    return clampHourHeight(parsed);
  } catch {
    return DEFAULT_TIME_GRID_HOUR_HEIGHT;
  }
}

function writeStoredHourHeight(px: number) {
  try {
    window.localStorage.setItem(HOUR_HEIGHT_STORAGE_KEY, String(px));
  } catch {
    // ignore quota / private mode
  }
}

export type EventCalendarProps<TMeta = unknown> = {
  events?: CalendarEvent<TMeta>[];
  view?: CalendarView;
  defaultView?: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  date?: Date;
  defaultDate?: Date;
  onDateChange?: (date: Date) => void;
  businessHours?: BusinessHours;
  /** Clinic timezone for day-of-week / open-hours resolution. */
  timeZone?: string;
  onEventClick?: (event: CalendarEvent<TMeta>) => void;
  onDayClick?: (date: Date) => void;
  onTimeSlotClick?: (date: Date) => void;
  renderEventHoverContent?: (event: CalendarEvent<TMeta>) => ReactNode;
  /** Aggregated per-day counts for year view (avoids loading full event lists). */
  daySummaries?: CalendarDaySummary[];
  /** Events for the hovered year-view day (lazy-loaded by parent). */
  yearHoverDayEvents?: CalendarEvent<TMeta>[];
  yearHoverDayLoading?: boolean;
  onYearHoverDayChange?: (day: Date | null) => void;
  isLoading?: boolean;
  /** True while refetching with existing data still shown. */
  isFetching?: boolean;
  /** Rendered next to the Day/Week/Month/Year tabs. */
  toolbarEnd?: ReactNode;
  /**
   * Extra controls in the status bar (right side).
   * On day/week these sit next to the zoom slider; on month/year they stand alone.
   */
  statusBarEnd?: ReactNode;
  /** When false, period/filter toolbar is owned by the parent. */
  showToolbar?: boolean;
  className?: string;
};

export function EventCalendar<TMeta = unknown>({
  events = [],
  view: controlledView,
  defaultView = "day",
  onViewChange,
  date: controlledDate,
  defaultDate,
  onDateChange,
  businessHours,
  timeZone,
  onEventClick,
  onDayClick,
  onTimeSlotClick,
  renderEventHoverContent,
  daySummaries,
  yearHoverDayEvents,
  yearHoverDayLoading,
  onYearHoverDayChange,
  isLoading = false,
  isFetching = false,
  toolbarEnd,
  statusBarEnd,
  showToolbar = true,
  className,
}: EventCalendarProps<TMeta>) {
  const [internalView, setInternalView] = useState<CalendarView>(defaultView);
  const [internalDate, setInternalDate] = useState<Date>(
    defaultDate ?? new Date(),
  );
  const [hourHeightPx, setHourHeightPxState] = useState(
    DEFAULT_TIME_GRID_HOUR_HEIGHT,
  );
  /** Layout value lags the slider slightly so CSS can ease card/grid resize. */
  const [layoutHourHeightPx, setLayoutHourHeightPx] = useState(
    DEFAULT_TIME_GRID_HOUR_HEIGHT,
  );

  useEffect(() => {
    const stored = readStoredHourHeight();
    setHourHeightPxState(stored);
    setLayoutHourHeightPx(stored);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLayoutHourHeightPx(hourHeightPx);
    }, TIME_GRID_ZOOM_LAYOUT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [hourHeightPx]);

  const setHourHeightPx = useCallback((px: number) => {
    const next = clampHourHeight(px);
    setHourHeightPxState(next);
    writeStoredHourHeight(next);
  }, []);

  const view = controlledView ?? internalView;
  const date = controlledDate ?? internalDate;
  const showTimeGridZoom = view === "day" || view === "week";

  const setView = useCallback(
    (next: CalendarView) => {
      if (controlledView === undefined) setInternalView(next);
      onViewChange?.(next);
    },
    [controlledView, onViewChange],
  );

  const setDate = useCallback(
    (next: Date) => {
      if (controlledDate === undefined) setInternalDate(next);
      onDateChange?.(next);
    },
    [controlledDate, onDateChange],
  );

  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      setDate(navigateDate(date, view, direction));
    },
    [date, setDate, view],
  );

  const handleToday = useCallback(() => {
    setDate(timeZone ? getZonedToday(timeZone) : new Date());
  }, [setDate, timeZone]);

  const handleDayClick = useCallback(
    (day: Date) => {
      setDate(day);
      setView("day");
      onDayClick?.(day);
    },
    [onDayClick, setDate, setView],
  );

  const handleMonthClick = useCallback(
    (monthDate: Date) => {
      setDate(monthDate);
      setView("month");
    },
    [setDate, setView],
  );

  const { statusTotal, statusPeriodLabel } = useMemo(() => {
    if (view === "year") {
      const total = (daySummaries ?? []).reduce((sum, d) => sum + d.count, 0);
      return {
        statusTotal: total,
        statusPeriodLabel: `in ${format(date, "yyyy")}`,
      };
    }
    if (view === "month") {
      return {
        statusTotal: events.length,
        statusPeriodLabel: `in ${format(date, "MMMM yyyy")}`,
      };
    }
    if (view === "week") {
      const days = getAvailableDaysInWeek(date, businessHours, timeZone);
      const start = days[0] ?? date;
      const end = days[days.length - 1] ?? date;
      const range =
        start.getMonth() === end.getMonth()
          ? `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`
          : `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
      return {
        statusTotal: events.length,
        statusPeriodLabel: `in ${range}`,
      };
    }
    return {
      statusTotal: events.length,
      statusPeriodLabel: `on ${format(date, "EEE, MMM d, yyyy")}`,
    };
  }, [view, date, events.length, daySummaries, businessHours, timeZone]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {showToolbar ? (
        <EventCalendarToolbar
          date={date}
          view={view}
          onDateChange={setDate}
          onViewChange={setView}
          onNavigate={handleNavigate}
          onToday={handleToday}
          businessHours={businessHours}
          timeZone={timeZone}
          toolbarEnd={toolbarEnd}
        />
      ) : null}

      {!isLoading ? (
        <CalendarStatusBar
          total={statusTotal}
          periodLabel={statusPeriodLabel}
          end={
            statusBarEnd || showTimeGridZoom ? (
              <>
                {showTimeGridZoom ? (
                  <div className="w-full  min-w-[12rem] sm:w-[14rem]">
                    <ElasticSlider
                      label="Zoom"
                      min={TIME_GRID_HOUR_HEIGHT_MIN}
                      max={TIME_GRID_HOUR_HEIGHT_MAX}
                      step={1}
                      value={hourHeightPx}
                      onValueChange={setHourHeightPx}
                      formatValue={(px) =>
                        `${Math.round((px / DEFAULT_TIME_GRID_HOUR_HEIGHT) * 100)}%`
                      }
                      aria-label="Zoom time grid"
                    />
                  </div>
                ) : null}
                {statusBarEnd}
              </>
            ) : null
          }
        />
      ) : null}

      {isLoading ? (
        <Skeleton className="h-[min(70vh,720px)] w-full rounded-lg" />
      ) : (
        <div
          className={cn(
            "relative transition-opacity duration-200",
            isFetching && "pointer-events-none opacity-60",
          )}
        >
          {view === "day" && (
            <DayView
              date={date}
              events={events}
              businessHours={businessHours}
              timeZone={timeZone}
              hourHeightPx={layoutHourHeightPx}
              onEventClick={onEventClick}
              onTimeSlotClick={onTimeSlotClick}
              renderEventHoverContent={renderEventHoverContent}
            />
          )}
          {view === "week" && (
            <WeekView
              date={date}
              events={events}
              businessHours={businessHours}
              timeZone={timeZone}
              hourHeightPx={layoutHourHeightPx}
              onEventClick={onEventClick}
              onDayClick={handleDayClick}
              onTimeSlotClick={onTimeSlotClick}
              renderEventHoverContent={renderEventHoverContent}
            />
          )}
          {view === "month" && (
            <MonthView
              date={date}
              events={events}
              businessHours={businessHours}
              timeZone={timeZone}
              onEventClick={onEventClick}
              onDayClick={handleDayClick}
              renderEventHoverContent={renderEventHoverContent}
            />
          )}
          {view === "year" && (
            <YearView
              date={date}
              daySummaries={daySummaries}
              hoverDayEvents={yearHoverDayEvents}
              hoverDayLoading={yearHoverDayLoading}
              onMonthClick={handleMonthClick}
              onDayClick={handleDayClick}
              onEventClick={onEventClick}
              onHoverDayChange={onYearHoverDayChange}
              renderEventHoverContent={renderEventHoverContent}
            />
          )}
        </div>
      )}
    </div>
  );
}
