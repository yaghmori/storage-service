"use client";

import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";
import {
  CalendarEventCard,
  type CalendarEventCardVariant,
} from "./calendar-event-card";
import { EVENT_ROW_GAP_PX } from "./layout-overlapping-events";
import type { CalendarEvent } from "./types";
import { MIN_EVENT_HEIGHT_PX, TIME_GRID_ZOOM_TRANSITION_CLASS } from "./types";

type Props<T> = {
  event: CalendarEvent<T>;
  top: number;
  left: string;
  width: string;
  height: number;
  variant?: CalendarEventCardVariant;
  dense?: boolean;
  onClick?: (event: CalendarEvent<T>) => void;
  renderHoverContent?: (event: CalendarEvent<T>) => ReactNode;
  className?: string;
};

export function PositionedEventBlock<T>({
  event,
  top,
  left,
  width,
  height,
  variant = "week",
  dense = false,
  onClick,
  renderHoverContent,
  className,
}: Props<T>) {
  const gap = EVENT_ROW_GAP_PX;
  const blockHeight = Math.max(MIN_EVENT_HEIGHT_PX, height - gap);

  return (
    <div
      className={cn("absolute z-10 hover:z-30", TIME_GRID_ZOOM_TRANSITION_CLASS, className)}
      style={{
        top: top + gap / 2,
        left,
        width,
        height: blockHeight,
      }}
    >
      <CalendarEventCard
        event={event}
        onClick={onClick}
        variant={variant}
        dense={dense}
        height={blockHeight}
        renderHoverContent={renderHoverContent}
        className="h-full w-full"
      />
    </div>
  );
}

export {
  FIXED_EVENT_HEIGHT_DAY_PX,
  FIXED_EVENT_HEIGHT_DENSE_PX,
  FIXED_EVENT_HEIGHT_PX,
} from "./types";
