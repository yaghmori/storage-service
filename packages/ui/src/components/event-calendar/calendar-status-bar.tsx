"use client";

import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

/** Kept for day-hover status labels (not shown in the calendar top bar). */
export const CALENDAR_STATUS_LEGEND: Array<{ status: number; label: string }> = [
  { status: 1, label: "In progress" },
  { status: 2, label: "Completed" },
  { status: 3, label: "Canceled" },
  { status: 4, label: "Abandoned" },
  { status: 5, label: "No show" },
];

type Props = {
  total: number;
  /** e.g. "in March 2026", "on Mon, Mar 3, 2026" */
  periodLabel: string;
  /** Right-side controls (full-width toggle, zoom, etc.). */
  end?: ReactNode;
  className?: string;
};

export function CalendarStatusBar({
  total,
  periodLabel,
  end,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-1",
        className,
      )}
    >
      <p className="text-muted-foreground min-w-0 flex-1 text-xs tabular-nums">
        {total > 0
          ? `${total} appointment${total === 1 ? "" : "s"} ${periodLabel}`
          : `No appointments ${periodLabel}`}
      </p>

      {end ? (
        <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
          {end}
        </div>
      ) : null}
    </div>
  );
}
