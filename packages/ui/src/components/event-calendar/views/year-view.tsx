"use client";

import { cn } from "@workspace/ui/lib/utils";
import { format, isToday } from "date-fns";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { DayAppointmentsHoverCard } from "../day-appointments-hover-card";
import { toLocalDateKey } from "../heatmap-utils";
import { StatusDots } from "../status-dots";
import type { CalendarDaySummary, CalendarEvent } from "../types";
import { getYearMonths } from "../utils";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

type Props<T = unknown> = {
  date: Date;
  daySummaries?: CalendarDaySummary[];
  /** Events for the currently hovered day (lazy-loaded by parent). */
  hoverDayEvents?: CalendarEvent<T>[];
  hoverDayLoading?: boolean;
  onMonthClick?: (date: Date) => void;
  onDayClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent<T>) => void;
  /** Called when the open hover day changes (null when closed). */
  onHoverDayChange?: (day: Date | null) => void;
  renderEventHoverContent?: (event: CalendarEvent<T>) => ReactNode;
};

function buildMonthDays(monthDate: Date): Array<Date | null> {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const cells: Array<Date | null> = Array.from(
    { length: firstWeekday },
    () => null,
  );
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  return cells;
}

function YearDayCell<T>({
  day,
  summary,
  isActiveHover,
  hoverDayEvents,
  hoverDayLoading,
  onDayClick,
  onEventClick,
  onHoverOpen,
  onHoverClose,
  renderEventHoverContent,
}: {
  day: Date;
  summary: CalendarDaySummary;
  isActiveHover: boolean;
  hoverDayEvents: CalendarEvent<T>[];
  hoverDayLoading: boolean;
  onDayClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent<T>) => void;
  onHoverOpen: (day: Date) => void;
  onHoverClose: (day: Date) => void;
  renderEventHoverContent?: (event: CalendarEvent<T>) => ReactNode;
}) {
  const dateKey = toLocalDateKey(day);
  const colors = summary.colors ?? [];
  const statuses = summary.statuses ?? [];
  const today = isToday(day);

  const events = isActiveHover ? hoverDayEvents : [];
  const isLoading = isActiveHover ? hoverDayLoading : false;

  return (
    <DayAppointmentsHoverCard
      day={day}
      events={events}
      statuses={statuses}
      totalCount={summary.count}
      isLoading={isLoading}
      onOpenChange={(open) => {
        if (open) onHoverOpen(day);
        else onHoverClose(day);
      }}
      onEventClick={onEventClick}
      renderEventHoverContent={renderEventHoverContent}
    >
      <button
        type="button"
        data-year-day={dateKey}
        onClick={() => onDayClick?.(day)}
        className={cn(
          "flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-lg text-sm font-medium transition-colors duration-150",
          "hover:bg-primary/10",
          "bg-muted text-foreground",
        )}
      >
        <span
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-full",
            today && "bg-background ring-primary/30 font-semibold ring-1",
          )}
        >
          {day.getDate()}
        </span>
        <StatusDots colors={colors} statuses={statuses} className="min-h-1" />
      </button>
    </DayAppointmentsHoverCard>
  );
}

function YearMonthCalendar<T>({
  monthDate,
  summaryByDate,
  monthTotal,
  activeHoverKey,
  hoverDayEvents,
  hoverDayLoading,
  onMonthClick,
  onDayClick,
  onEventClick,
  onHoverOpen,
  onHoverClose,
  renderEventHoverContent,
}: {
  monthDate: Date;
  summaryByDate: Map<string, CalendarDaySummary>;
  monthTotal: number;
  activeHoverKey: string | null;
  hoverDayEvents: CalendarEvent<T>[];
  hoverDayLoading: boolean;
  onMonthClick?: (date: Date) => void;
  onDayClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent<T>) => void;
  onHoverOpen: (day: Date) => void;
  onHoverClose: (day: Date) => void;
  renderEventHoverContent?: (event: CalendarEvent<T>) => ReactNode;
}) {
  const cells = useMemo(() => buildMonthDays(monthDate), [monthDate]);

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
      <button
        type="button"
        onClick={() => onMonthClick?.(monthDate)}
        className="bg-muted/40 border-border hover:bg-accent/30 flex w-full items-center justify-between border-b px-4 py-3 text-left transition-colors"
      >
        <span className="text-sm uppercase font-medium">
          {format(monthDate, "MMMM")}
        </span>
        {monthTotal > 0 ? (
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            {monthTotal}
          </span>
        ) : null}
      </button>

      <div className="grid grid-cols-7 gap-1.5 p-3 sm:gap-2 sm:p-4">
        {DAY_NAMES.map((day) => (
          <div
            key={day}
            className="text-muted-foreground py-0.5 text-center text-[10px] font-medium tracking-wide sm:text-xs"
          >
            {day}
          </div>
        ))}

        {cells.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} />;
          }

          const dateKey = toLocalDateKey(day);
          const summary = summaryByDate.get(dateKey);
          const today = isToday(day);

          if (!summary || summary.count <= 0) {
            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => onDayClick?.(day)}
                className={cn(
                  "flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-lg text-sm font-medium transition-all duration-150",
                  "text-muted-foreground/70 hover:bg-muted/60 hover:text-foreground",
                  today && "bg-background ring-primary/30 font-semibold ring-1",
                )}
              >
                <span className="inline-flex size-7 items-center justify-center rounded-full">
                  {day.getDate()}
                </span>
                <span className="min-h-1" />
              </button>
            );
          }

          return (
            <YearDayCell
              key={dateKey}
              day={day}
              summary={summary}
              isActiveHover={activeHoverKey === dateKey}
              hoverDayEvents={hoverDayEvents}
              hoverDayLoading={hoverDayLoading}
              onDayClick={onDayClick}
              onEventClick={onEventClick}
              onHoverOpen={onHoverOpen}
              onHoverClose={onHoverClose}
              renderEventHoverContent={renderEventHoverContent}
            />
          );
        })}
      </div>
    </div>
  );
}

export function YearView<T = unknown>({
  date,
  daySummaries = [],
  hoverDayEvents = [],
  hoverDayLoading = false,
  onMonthClick,
  onDayClick,
  onEventClick,
  onHoverDayChange,
  renderEventHoverContent,
}: Props<T>) {
  const months = getYearMonths(date);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const activeKeyRef = useRef<string | null>(null);

  const summaryByDate = useMemo(() => {
    const map = new Map<string, CalendarDaySummary>();
    for (const day of daySummaries) {
      if (day.count > 0) map.set(day.date, day);
    }
    return map;
  }, [daySummaries]);

  const handleHoverOpen = useCallback(
    (day: Date) => {
      const key = toLocalDateKey(day);
      activeKeyRef.current = key;
      setActiveKey(key);
      onHoverDayChange?.(day);
    },
    [onHoverDayChange],
  );

  const handleHoverClose = useCallback(
    (day: Date) => {
      const key = toLocalDateKey(day);
      // Defer so a newly opened day can claim activeKey first.
      queueMicrotask(() => {
        if (activeKeyRef.current !== key) return;
        activeKeyRef.current = null;
        setActiveKey(null);
        onHoverDayChange?.(null);
      });
    },
    [onHoverDayChange],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {months.map((monthDate) => {
          const monthKey = format(monthDate, "yyyy-MM");
          const monthTotal = daySummaries
            .filter((d) => d.date.startsWith(monthKey))
            .reduce((sum, d) => sum + d.count, 0);

          return (
            <YearMonthCalendar
              key={monthKey}
              monthDate={monthDate}
              summaryByDate={summaryByDate}
              monthTotal={monthTotal}
              activeHoverKey={activeKey}
              hoverDayEvents={hoverDayEvents}
              hoverDayLoading={hoverDayLoading}
              onMonthClick={onMonthClick}
              onDayClick={onDayClick}
              onEventClick={onEventClick}
              onHoverOpen={handleHoverOpen}
              onHoverClose={handleHoverClose}
              renderEventHoverContent={renderEventHoverContent}
            />
          );
        })}
      </div>
    </div>
  );
}
