"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@workspace/ui/components/hover-card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/utils";
import { format } from "date-fns";
import type { ReactNode } from "react";
import { CALENDAR_STATUS_LEGEND } from "./calendar-status-bar";
import { normalizeServiceColor } from "./service-color";
import { statusesFromEvents } from "./status-dots";
import { APPOINTMENT_STATUS_DOT_CLASS, type CalendarEvent } from "./types";

type StatusEntry = { status: number; count: number };

type Props<T> = {
  day: Date;
  events: CalendarEvent<T>[];
  /** Prefer summary counts when provided (e.g. year heatmap). */
  statuses?: StatusEntry[];
  totalCount?: number;
  isLoading?: boolean;
  onEventClick?: (event: CalendarEvent<T>) => void;
  renderEventHoverContent?: (event: CalendarEvent<T>) => ReactNode;
  className?: string;
};

function statusLabel(status: number): string {
  return (
    CALENDAR_STATUS_LEGEND.find((entry) => entry.status === status)?.label ??
    `Status ${status}`
  );
}

function AppointmentListRow<T>({
  event,
  onEventClick,
  renderEventHoverContent,
}: {
  event: CalendarEvent<T>;
  onEventClick?: (event: CalendarEvent<T>) => void;
  renderEventHoverContent?: (event: CalendarEvent<T>) => ReactNode;
}) {
  const when = format(event.start, "HH:mm");
  const serviceHex = normalizeServiceColor(event.serviceColor);
  const statusDotClass =
    event.status != null
      ? (APPOINTMENT_STATUS_DOT_CLASS[event.status] ?? "bg-foreground/50")
      : "bg-foreground/50";

  const row = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onEventClick?.(event);
      }}
      className="hover:bg-accent/40 flex h-5 w-full min-w-0 shrink-0 items-center gap-1.5 rounded px-0.5 text-left text-[11px] leading-tight transition-colors"
      aria-label={`${when} ${event.title}`}
    >
      <span className=" shrink-0 text-muted-foreground font-medium  tabular-nums">
        {when}
      </span>
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          !serviceHex && statusDotClass,
        )}
        style={serviceHex ? { backgroundColor: serviceHex } : undefined}
        aria-hidden
      />
      <span className="text-foreground min-w-0 truncate font-medium">
        {event.title}
      </span>
    </button>
  );

  const detail = renderEventHoverContent?.(event);
  if (!detail) return row;

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{row}</HoverCardTrigger>
      <HoverCardContent
        className="w-72 p-3"
        side="right"
        align="start"
        sideOffset={8}
      >
        {detail}
      </HoverCardContent>
    </HoverCard>
  );
}

function AppointmentsListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex h-5 shrink-0 items-center gap-2">
          <Skeleton className="h-3 w-20 shrink-0" />
          <Skeleton className="h-3 min-w-0 flex-1" />
        </li>
      ))}
    </ul>
  );
}

/** Shared day hover: date, totals, by-status, then appointments with datetime + service. */
export function DayAppointmentsHoverPanel<T>({
  day,
  events,
  statuses: statusesProp,
  totalCount,
  isLoading = false,
  onEventClick,
  renderEventHoverContent,
  className,
}: Props<T>) {
  const fromEvents = statusesFromEvents(events).map((entry) => ({
    status: entry.status,
    count: entry.count ?? 0,
  }));
  const statuses =
    statusesProp && statusesProp.length > 0 ? statusesProp : fromEvents;
  const count =
    totalCount ??
    (events.length > 0
      ? events.length
      : statuses.reduce((sum, entry) => sum + entry.count, 0));

  const skeletonRows = Math.min(5, Math.max(2, count || 3));

  return (
    <div
      className={cn(
        "flex min-h-0 w-full max-w-[22rem] flex-col gap-3 overflow-hidden",
        className,
      )}
    >
      <div className="shrink-0">
        <p className="text-sm font-medium">
          {format(day, "EEEE, MMMM d, yyyy")}
        </p>
        <p className="text-muted-foreground text-xs">
          {count} appointment{count === 1 ? "" : "s"}
        </p>
      </div>

      {statuses.length > 0 ? (
        <div className="shrink-0 space-y-1.5">
          <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
            By status
          </p>
          <ul className="m-0 list-none space-y-1 p-0">
            {statuses.map((entry) => (
              <li
                key={entry.status}
                className="flex h-4 items-center justify-between gap-2 text-xs"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      APPOINTMENT_STATUS_DOT_CLASS[entry.status] ??
                        "bg-foreground/50",
                    )}
                  />
                  <span className="truncate">{statusLabel(entry.status)}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {entry.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : isLoading ? (
        <div className="shrink-0 space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden border-t pt-3">
        <p className="text-muted-foreground shrink-0 text-[10px] font-medium uppercase tracking-wide">
          Appointments
        </p>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          {isLoading && events.length === 0 ? (
            <AppointmentsListSkeleton rows={skeletonRows} />
          ) : events.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {events.map((event) => (
                <li key={String(event.id)} className="block min-w-0 shrink-0">
                  <AppointmentListRow
                    event={event}
                    onEventClick={onEventClick}
                    renderEventHoverContent={renderEventHoverContent}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">
              No appointment details
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
