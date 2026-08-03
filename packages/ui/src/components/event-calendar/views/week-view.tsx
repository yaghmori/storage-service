"use client";

import { cn } from "@workspace/ui/lib/utils";
import { format } from "date-fns";
import type { CSSProperties, ReactNode } from "react";
import {
  CalendarHeaderCell,
  CalendarViewHeader,
} from "../calendar-view-header";
import { DayTimeColumn, buildTimeGridLayout } from "../day-time-column";
import { getHourLineTop } from "../hour-layout";
import type { BusinessHours, CalendarEvent } from "../types";
import { DAY_HOUR_HEIGHT_PX, FIXED_EVENT_HEIGHT_PX, TIME_GRID_ZOOM_TRANSITION_CLASS } from "../types";
import {
  getAvailableDaysInWeek,
  getEventsForDay,
  getTimeGridBounds,
  isToday,
} from "../utils";

type Props<T> = {
  date: Date;
  events: CalendarEvent<T>[];
  businessHours?: BusinessHours;
  timeZone?: string;
  /** Pixels per hour (zoom). */
  hourHeightPx?: number;
  onEventClick?: (event: CalendarEvent<T>) => void;
  onDayClick?: (date: Date) => void;
  onTimeSlotClick?: (date: Date) => void;
  renderEventHoverContent?: (event: CalendarEvent<T>) => ReactNode;
};

export function WeekView<T>({
  date,
  events,
  businessHours,
  timeZone,
  hourHeightPx = DAY_HOUR_HEIGHT_PX,
  onEventClick,
  onDayClick,
  onTimeSlotClick,
  renderEventHoverContent,
}: Props<T>) {
  // Only days with dayOff === false from App Settings business hours.
  const days = getAvailableDaysInWeek(date, businessHours, timeZone);
  const dayCount = Math.max(1, days.length);
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `56px repeat(${dayCount}, minmax(0, 1fr))`,
  };

  const bounds = getTimeGridBounds(days, businessHours, timeZone);
  const allWeekEvents = days.flatMap((day) => getEventsForDay(events, day));
  const gridLayout = buildTimeGridLayout(
    bounds.startHour,
    bounds.endHour,
    allWeekEvents,
    FIXED_EVENT_HEIGHT_PX,
    { positioning: "minute", hourHeight: hourHeightPx },
  );

  const hourLines = Array.from(
    { length: gridLayout.endHour - gridLayout.startHour },
    (_, i) => gridLayout.startHour + i,
  );

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border shadow-sm">
      <CalendarViewHeader style={gridStyle}>
        <CalendarHeaderCell className="border-r bg-muted" />
        {days.map((day) => (
          <CalendarHeaderCell
            key={day.toISOString()}
            as="button"
            onClick={() => onDayClick?.(day)}
            className={cn(
              "flex flex-col items-center bg-muted justify-center border-l  text-center",
              isToday(day) && "bg-muted-foreground/20",
            )}
          >
            <div className=" text-md font-semibold uppercase tracking-wide">
              {format(day, "EEE")}
            </div>
            <div
              className={cn(
                " flex size-7 items-center  justify-center rounded-full text-lg ",
                isToday(day) &&
                  "bg-muted-foreground/50 text-lg text-primary-foreground ",
              )}
            >
              {format(day, "d")}
            </div>
          </CalendarHeaderCell>
        ))}
      </CalendarViewHeader>

      <div className="grid" style={gridStyle}>
        <div
          className={cn("bg-muted/20 relative", TIME_GRID_ZOOM_TRANSITION_CLASS)}
          style={{ height: gridLayout.totalHeight }}
        >
          {hourLines.map((hour) => {
            const top = getHourLineTop(gridLayout, hour);
            const isFirstHour = hour === gridLayout.startHour;
            return (
              <div
                key={hour}
                className={cn(
                  "text-muted-foreground absolute right-3 text-[10px] leading-none font-medium tabular-nums",
                  TIME_GRID_ZOOM_TRANSITION_CLASS,
                  isFirstHour ? "pt-0.5" : "-translate-y-1/2",
                )}
                style={{ top }}
              >
                {format(new Date(2000, 0, 1, hour), "HH:mm")}
              </div>
            );
          })}
        </div>
        {days.map((day) => (
          <DayTimeColumn
            key={day.toISOString()}
            day={day}
            events={getEventsForDay(events, day)}
            gridLayout={gridLayout}
            businessHours={businessHours}
            timeZone={timeZone}
            variant="week"
            onEventClick={onEventClick}
            onTimeSlotClick={onTimeSlotClick}
            renderEventHoverContent={renderEventHoverContent}
          />
        ))}
      </div>
    </div>
  );
}
