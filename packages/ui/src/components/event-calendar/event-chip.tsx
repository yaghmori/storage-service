"use client";

import type { ReactNode } from "react";
import type { CalendarEvent } from "./types";
import {
  CalendarEventCard,
  type CalendarEventCardVariant,
} from "./calendar-event-card";

type Props<T> = {
  event: CalendarEvent<T>;
  variant?: CalendarEventCardVariant;
  onClick?: (event: CalendarEvent<T>) => void;
  renderHoverContent?: (event: CalendarEvent<T>) => ReactNode;
  className?: string;
};

export function EventChip<T>({
  event,
  variant = "month",
  onClick,
  renderHoverContent,
  className,
}: Props<T>) {
  return (
    <CalendarEventCard
      event={event}
      onClick={onClick}
      variant={variant}
      renderHoverContent={renderHoverContent}
      className={className}
    />
  );
}
