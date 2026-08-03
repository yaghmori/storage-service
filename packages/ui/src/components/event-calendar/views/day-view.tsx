"use client";

import { cn } from "@workspace/ui/lib/utils";
import { format } from "date-fns";
import type { ReactNode } from "react";
import {
  CalendarHeaderCell,
  CalendarViewHeader,
} from "../calendar-view-header";
import { DayTimeColumn, buildTimeGridLayout } from "../day-time-column";
import { getHourLineTop } from "../hour-layout";
import type { BusinessHours, CalendarEvent } from "../types";
import { DAY_HOUR_HEIGHT_PX, FIXED_EVENT_HEIGHT_DAY_PX, TIME_GRID_ZOOM_TRANSITION_CLASS } from "../types";
import { getEventsForDay, getTimeGridBounds, isToday } from "../utils";

type Props<T> = {
  date: Date;
  events: CalendarEvent<T>[];
  businessHours?: BusinessHours;
  timeZone?: string;
  /** Pixels per hour (zoom). */
  hourHeightPx?: number;
  onEventClick?: (event: CalendarEvent<T>) => void;
  onTimeSlotClick?: (date: Date) => void;
  renderEventHoverContent?: (event: CalendarEvent<T>) => ReactNode;
};

export function DayView<T>({
  date,
  events,
  businessHours,
  timeZone,
  hourHeightPx = DAY_HOUR_HEIGHT_PX,
  onEventClick,
  onTimeSlotClick,
  renderEventHoverContent,
}: Props<T>) {
  const bounds = getTimeGridBounds([date], businessHours, timeZone);
  const dayEvents = getEventsForDay(events, date);
  const gridLayout = buildTimeGridLayout(
    bounds.startHour,
    bounds.endHour,
    dayEvents,
    FIXED_EVENT_HEIGHT_DAY_PX,
    { positioning: "minute", hourHeight: hourHeightPx },
  );

  const hourLines = Array.from(
    { length: gridLayout.endHour - gridLayout.startHour },
    (_, i) => gridLayout.startHour + i,
  );

  return (
    <div className="border-border  bg-card overflow-hidden rounded-lg border shadow-sm">
      <CalendarViewHeader sticky gridClassName="grid-cols-[56px_1fr]">
        <CalendarHeaderCell className="border-r bg-muted" />
        <CalendarHeaderCell
          className={cn(
            "flex flex-col bg-muted items-start justify-center px-3  text-left",
            isToday(date) && "bg-muted",
          )}
        >
          <div className=" text-sm font-semibold uppercase tracking-wide">
            {format(date, "EEEE")}
          </div>
          <div className="flex items-center justify-center p-1">
            <div
              className={cn(
                "flex size-8  items-center  justify-center rounded-full text-2xl ",
                isToday(date) &&
                  "bg-muted-foreground/50 text-xl text-primary-foreground ",
              )}
            >
              {format(date, "d")}
            </div>
          </div>
        </CalendarHeaderCell>
      </CalendarViewHeader>

      <div className="grid  grid-cols-[56px_1fr]">
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
        <DayTimeColumn
          day={date}
          events={dayEvents}
          gridLayout={gridLayout}
          businessHours={businessHours}
          timeZone={timeZone}
          variant="day"
          onEventClick={onEventClick}
          onTimeSlotClick={onTimeSlotClick}
          renderEventHoverContent={renderEventHoverContent}
        />
      </div>
    </div>
  );
}
