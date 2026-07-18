"use client";

import { cn } from "@workspace/ui/lib/utils";
import { format, isToday } from "date-fns";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { CalendarEventCardVariant } from "./calendar-event-card";
import {
  buildTimeGridLayout,
  getHourLineHeight,
  getHourLineTop,
  getTimeTopPx,
  type TimeGridLayout,
} from "./hour-layout";
import {
  getPositionedEventStyle,
  layoutOverlappingEvents,
} from "./layout-overlapping-events";
import { PositionedEventBlock } from "./positioned-event-block";
import type { BusinessHours, CalendarEvent } from "./types";
import {
  FIXED_EVENT_HEIGHT_DAY_PX,
  FIXED_EVENT_HEIGHT_DENSE_PX,
  FIXED_EVENT_HEIGHT_PX,
  MAX_DETAILED_COLUMNS,
  TIME_GRID_ZOOM_TRANSITION_CLASS,
  WEEK_DENSE_DAY_THRESHOLD,
} from "./types";
import { getDayHours, parseTimeOnDate } from "./utils";

type Props<T> = {
  day: Date;
  events: CalendarEvent<T>[];
  gridLayout: TimeGridLayout;
  businessHours?: BusinessHours;
  timeZone?: string;
  variant?: CalendarEventCardVariant;
  onEventClick?: (event: CalendarEvent<T>) => void;
  onTimeSlotClick?: (date: Date) => void;
  renderEventHoverContent?: (event: CalendarEvent<T>) => ReactNode;
  className?: string;
};

function cardHeightForVariant(
  variant: CalendarEventCardVariant,
  dense: boolean,
): number {
  if (dense && variant === "week") return FIXED_EVENT_HEIGHT_DENSE_PX;
  if (variant === "day") return FIXED_EVENT_HEIGHT_DAY_PX;
  return FIXED_EVENT_HEIGHT_PX;
}

export function DayTimeColumn<T>({
  day,
  events,
  gridLayout,
  businessHours,
  timeZone,
  variant = "week",
  onEventClick,
  onTimeSlotClick,
  renderEventHoverContent,
  className,
}: Props<T>) {
  const hours = getDayHours(day, businessHours, timeZone);
  const hourLines = Array.from(
    { length: gridLayout.endHour - gridLayout.startHour },
    (_, i) => gridLayout.startHour + i,
  );

  const closed = hours.dayOff;
  const weekCrowded =
    variant === "week" && events.length >= WEEK_DENSE_DAY_THRESHOLD;

  const positionedEvents = layoutOverlappingEvents(
    events,
    gridLayout,
    cardHeightForVariant(variant, false),
  );

  const showNowLine = isToday(day);
  const now = new Date();
  const nowTop = getTimeTopPx(now, gridLayout);
  const nowInRange =
    showNowLine && nowTop >= 0 && nowTop <= gridLayout.totalHeight;

  return (
    <div
      className={cn(
        "group/column relative min-w-0 flex-1   border-l border-border/60",
        "transition-colors duration-300 hover:bg-accent/5",
        TIME_GRID_ZOOM_TRANSITION_CLASS,
        className,
      )}
      style={{ height: gridLayout.totalHeight }}
    >
      {hourLines.map((hour) => {
        const top = getHourLineTop(gridLayout, hour);
        const height = getHourLineHeight(gridLayout, hour);
        const isFirstHour = hour === gridLayout.startHour;
        const minuteMode = gridLayout.positioning === "minute";
        return (
          <div
            key={hour}
            className={cn("absolute right-0 left-0", TIME_GRID_ZOOM_TRANSITION_CLASS)}
            style={{ top, height }}
          >
            {/* Hour boundary — thick + dark */}
            {!isFirstHour ? (
              <div
                aria-hidden
                className="pointer-events-none absolute right-0 -left-2 z-[1] bg-neutral-300 dark:bg-neutral-400"
                style={{ top: 0, height: 1 }}
              />
            ) : null}
            {/* In-hour marks — dashed quarter-hour lines */}
            {minuteMode
              ? [15, 30, 45].map((minute) => (
                  <div
                    key={minute}
                    aria-hidden
                    className={cn(
                      "border-border/50 pointer-events-none absolute right-0 left-0 z-[1] border-t border-dashed",
                      TIME_GRID_ZOOM_TRANSITION_CLASS,
                    )}
                    style={{
                      top: (minute / 60) * height,
                    }}
                  />
                ))
              : null}
            {onTimeSlotClick && !closed && (
              <button
                type="button"
                className={cn(
                  "absolute inset-0 w-full opacity-0 transition-colors duration-200",
                  "hover:bg-accent/50 hover:opacity-100",
                  "focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
                )}
                onClick={(event) => {
                  const slot = new Date(day);
                  if (minuteMode && height > 0) {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const y = event.clientY - rect.top;
                    const minute = Math.min(
                      59,
                      Math.max(0, Math.floor((y / height) * 60)),
                    );
                    slot.setHours(hour, minute, 0, 0);
                  } else {
                    slot.setHours(hour, 0, 0, 0);
                  }
                  onTimeSlotClick(slot);
                }}
                aria-label={`${format(day, "MMM d")} ${format(new Date(2000, 0, 1, hour), "HH:mm")}`}
              />
            )}
          </div>
        );
      })}

      {!closed && (
        <>
          <div
            className={cn(
              "bg-muted/60 pointer-events-none absolute right-0 left-0",
              TIME_GRID_ZOOM_TRANSITION_CLASS,
            )}
            style={{
              top: 0,
              height: Math.max(
                0,
                getTimeTopPx(parseTimeOnDate(day, hours.start), gridLayout),
              ),
            }}
          />
          <div
            className={cn(
              "bg-muted/60 pointer-events-none absolute right-0 left-0",
              TIME_GRID_ZOOM_TRANSITION_CLASS,
            )}
            style={{
              top: getTimeTopPx(parseTimeOnDate(day, hours.end), gridLayout),
              bottom: 0,
            }}
          />
          {(hours.breaks ?? []).map((brk, idx) => (
            <div
              key={`${brk.start}-${brk.end}-${idx}`}
              className={cn(
                "pointer-events-none absolute right-0 left-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_4px,rgba(0,0,0,0.04)_4px,rgba(0,0,0,0.04)_8px)] dark:bg-[repeating-linear-gradient(-45deg,transparent,transparent_4px,rgba(255,255,255,0.04)_4px,rgba(255,255,255,0.04)_8px)]",
                TIME_GRID_ZOOM_TRANSITION_CLASS,
              )}
              style={{
                top: getTimeTopPx(parseTimeOnDate(day, brk.start), gridLayout),
                height:
                  getTimeTopPx(parseTimeOnDate(day, brk.end), gridLayout) -
                  getTimeTopPx(parseTimeOnDate(day, brk.start), gridLayout),
              }}
            />
          ))}
        </>
      )}

      {closed && (
        <div className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-medium bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,rgba(0,0,0,0.06)_6px,rgba(0,0,0,0.06)_12px)] dark:bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,rgba(255,255,255,0.06)_6px,rgba(255,255,255,0.06)_12px)]">
          <span className="bg-background/80 rounded px-2 py-0.5">Closed</span>
        </div>
      )}

      {nowInRange && (
        <motion.div
          className={cn(
            "pointer-events-none absolute right-0 left-0 z-20 flex items-center",
            TIME_GRID_ZOOM_TRANSITION_CLASS,
          )}
          style={{ top: nowTop }}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.4 }}
        >
          <span className="bg-destructive size-2 shrink-0 rounded-full" />
          <span className="bg-destructive h-0.5 flex-1" />
        </motion.div>
      )}

      {positionedEvents.map((positioned) => {
        const { left, width } = getPositionedEventStyle(positioned);
        const dense =
          variant === "week" &&
          (weekCrowded || positioned.columnCount > MAX_DETAILED_COLUMNS);
        const blockHeight = positioned.height;
        const minuteMode = gridLayout.positioning === "minute";

        let top = positioned.top;
        if (minuteMode) {
          // Keep the card's start time exact; allow overflow into the next hour.
          top = Math.max(
            0,
            Math.min(positioned.top, gridLayout.totalHeight - blockHeight),
          );
        } else {
          const hourIdx =
            positioned.event.start.getHours() - gridLayout.startHour;
          const hourBottom =
            hourIdx >= 0 && hourIdx < gridLayout.hourHeights.length
              ? (gridLayout.hourTops[hourIdx] ?? 0) +
                (gridLayout.hourHeights[hourIdx] ?? 0)
              : gridLayout.totalHeight;
          const hourTop =
            hourIdx >= 0 ? (gridLayout.hourTops[hourIdx] ?? 0) : 0;
          top = Math.min(
            Math.max(positioned.top, hourTop + 3),
            Math.max(hourTop + 3, hourBottom - blockHeight - 2),
          );
        }

        return (
          <PositionedEventBlock
            key={positioned.event.id}
            event={positioned.event}
            top={top}
            left={left}
            width={width}
            height={blockHeight}
            variant={variant}
            dense={dense}
            onClick={onEventClick}
            renderHoverContent={renderEventHoverContent}
          />
        );
      })}
    </div>
  );
}

export { buildTimeGridLayout, type TimeGridLayout };
