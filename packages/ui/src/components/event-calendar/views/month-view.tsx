"use client";

import { cn } from "@workspace/ui/lib/utils";
import { format } from "date-fns";
import type { ReactNode } from "react";
import {
  CalendarHeaderCell,
  CalendarViewHeader,
} from "../calendar-view-header";
import { DayAppointmentsHoverCard } from "../day-appointments-hover-card";
import { EventChip } from "../event-chip";
import { StatusDots, serviceColorsFromEvents, statusesFromEvents } from "../status-dots";
import type { BusinessHours, CalendarEvent } from "../types";
import {
  getDayHours,
  getEventsForDay,
  getMonthWeeks,
  isSameMonth,
  isToday,
} from "../utils";

const MAX_VISIBLE_EVENTS = 3;

type Props<T> = {
  date: Date;
  events: CalendarEvent<T>[];
  businessHours?: BusinessHours;
  timeZone?: string;
  onEventClick?: (event: CalendarEvent<T>) => void;
  onDayClick?: (date: Date) => void;
  renderEventHoverContent?: (event: CalendarEvent<T>) => ReactNode;
};

function MonthDayCell<T>({
  day,
  monthDate,
  dayEvents,
  hours,
  onEventClick,
  onDayClick,
  renderEventHoverContent,
}: {
  day: Date;
  monthDate: Date;
  dayEvents: CalendarEvent<T>[];
  hours: ReturnType<typeof getDayHours>;
  onEventClick?: (event: CalendarEvent<T>) => void;
  onDayClick?: (date: Date) => void;
  renderEventHoverContent?: (event: CalendarEvent<T>) => ReactNode;
}) {
  const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
  const hiddenCount = Math.max(0, dayEvents.length - MAX_VISIBLE_EVENTS);
  const colors = serviceColorsFromEvents(dayEvents);
  const statuses = statusesFromEvents(dayEvents).map((entry) => ({
    status: entry.status,
    count: entry.count ?? 0,
  }));

  const moreLabel = (
    <button
      type="button"
      className="text-primary hover:text-primary/80 cursor-pointer shrink-0 truncate px-0.5 py-0.5 text-left text-xs font-semibold "
    >
      +{hiddenCount} more
    </button>
  );

  return (
    <div
      className={cn(
        "group/day flex min-h-[120px] flex-col gap-1 p-2 text-left",
        !isSameMonth(day, monthDate) && "bg-muted/20 text-muted-foreground",
        hours.dayOff &&
          "bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,rgba(0,0,0,0.05)_6px,rgba(0,0,0,0.05)_12px)] dark:bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,rgba(255,255,255,0.05)_6px,rgba(255,255,255,0.05)_12px)]",
        isToday(day) && "bg-accent/30",
      )}
    >
      <button
        type="button"
        onClick={() => onDayClick?.(day)}
        className="hover:bg-accent/40 w-full -mx-1 sm:flex-row flex-col flex w-[calc(100%+0.5rem)] cursor-pointer items-center justify-between gap-1 rounded px-1 py-0.5 transition-colors"
      >
        <span
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-lg font-semibold",
            isToday(day) &&
              "bg-muted-foreground/50 text-primary-foreground ring-1",
          )}
        >
          {format(day, "d")}
        </span>
        <span className="flex  min-w-0 flex-col items-center justify-end gap-1">
          {hours.dayOff ? (
            <span className="text-muted-foreground bg-muted rounded px-1 text-[11px] font-medium">
              Off
            </span>
          ) : (
            <StatusDots colors={colors} />
          )}
        </span>
      </button>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
        {visibleEvents.map((event) => (
          <EventChip
            key={event.id}
            event={event}
            variant="month"
            onClick={onEventClick}
            renderHoverContent={renderEventHoverContent}
          />
        ))}
        {hiddenCount > 0 ? (
          <DayAppointmentsHoverCard
            day={day}
            events={dayEvents}
            statuses={statuses}
            totalCount={dayEvents.length}
            onEventClick={onEventClick}
            renderEventHoverContent={renderEventHoverContent}
          >
            {moreLabel}
          </DayAppointmentsHoverCard>
        ) : null}
      </div>
    </div>
  );
}

export function MonthView<T>({
  date,
  events,
  businessHours,
  timeZone,
  onEventClick,
  onDayClick,
  renderEventHoverContent,
}: Props<T>) {
  const weeks = getMonthWeeks(date);
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border shadow-sm">
      <CalendarViewHeader gridClassName="grid-cols-7 bg-muted">
        {weekdayLabels.map((label) => (
          <CalendarHeaderCell
            key={label}
            className=" border-r bg-muted py-3 text-center text-md font-semibold uppercase tracking-wide last:border-r-0"
          >
            {label}
          </CalendarHeaderCell>
        ))}
      </CalendarViewHeader>

      <div className="divide-border divide-y">
        {weeks.map((week, weekIdx) => (
          <div
            key={weekIdx}
            className="divide-border grid min-h-[150px] grid-cols-7 divide-x"
          >
            {week.map((day) => {
              const dayEvents = getEventsForDay(events, day);
              const hours = getDayHours(day, businessHours, timeZone);

              return (
                <MonthDayCell
                  key={day.toISOString()}
                  day={day}
                  monthDate={date}
                  dayEvents={dayEvents}
                  hours={hours}
                  onEventClick={onEventClick}
                  onDayClick={onDayClick}
                  renderEventHoverContent={renderEventHoverContent}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
