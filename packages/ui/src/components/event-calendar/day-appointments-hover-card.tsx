"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@workspace/ui/components/hover-card";
import type { ReactNode } from "react";
import { DayAppointmentsHoverPanel } from "./day-appointments-hover";
import type { CalendarEvent } from "./types";

type StatusEntry = { status: number; count: number };

type Props<T> = {
  day: Date;
  events: CalendarEvent<T>[];
  statuses?: StatusEntry[];
  totalCount?: number;
  isLoading?: boolean;
  /** When the card opens/closes (for lazy-loading day details). */
  onOpenChange?: (open: boolean) => void;
  onEventClick?: (event: CalendarEvent<T>) => void;
  renderEventHoverContent?: (event: CalendarEvent<T>) => ReactNode;
  children: ReactNode;
};

/**
 * Standard HoverCard wrapper for day appointment summaries (month / year).
 * Positioning, collision, and open/close animation come from the shared HoverCard.
 */
export function DayAppointmentsHoverCard<T>({
  day,
  events,
  statuses,
  totalCount,
  isLoading,
  onOpenChange,
  onEventClick,
  renderEventHoverContent,
  children,
}: Props<T>) {
  return (
    <HoverCard openDelay={200} closeDelay={280} onOpenChange={onOpenChange}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="flex w-[min(100vw-1.5rem,22rem)] max-h-[min(22.5rem,70vh)] flex-col overflow-hidden p-0"
      >
        <DayAppointmentsHoverPanel
          day={day}
          events={events}
          statuses={statuses}
          totalCount={totalCount}
          isLoading={isLoading}
          onEventClick={onEventClick}
          renderEventHoverContent={renderEventHoverContent}
          className="min-h-0 flex-1 overflow-hidden p-3"
        />
      </HoverCardContent>
    </HoverCard>
  );
}
