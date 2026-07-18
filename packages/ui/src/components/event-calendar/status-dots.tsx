"use client";

import { cn } from "@workspace/ui/lib/utils";
import { normalizeServiceColor } from "./service-color";
import { APPOINTMENT_STATUS_DOT_CLASS } from "./types";

type StatusEntry = { status: number; count?: number };
type ColorEntry = { color: string; count?: number };

type Props = {
  /** Prefer service colors when provided. */
  colors?: ColorEntry[];
  /** Fallback: status-colored dots (legacy / year heatmap without colors). */
  statuses?: StatusEntry[];
  className?: string;
  /** Dot size classes (default size-1). */
  dotClassName?: string;
};

/** Colored dots for day cells (year / month) — service colors preferred. */
export function StatusDots({
  colors,
  statuses,
  className,
  dotClassName,
}: Props) {
  if (colors && colors.length > 0) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center gap-px",
          className,
        )}
        aria-hidden
      >
        {colors.map(({ color }) => (
          <span
            key={color}
            className={cn("size-1 shrink-0 rounded-full", dotClassName)}
            style={{ backgroundColor: color }}
          />
        ))}
      </span>
    );
  }

  if (!statuses || statuses.length === 0) return null;

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center gap-px",
        className,
      )}
      aria-hidden
    >
      {statuses.map(({ status }) => (
        <span
          key={status}
          className={cn(
            "size-1 shrink-0 rounded-full",
            APPOINTMENT_STATUS_DOT_CLASS[status] ?? "bg-foreground/50",
            dotClassName,
          )}
        />
      ))}
    </span>
  );
}

/** Build distinct status entries from calendar events (stable status order). */
export function statusesFromEvents<T>(
  events: Array<{ status?: number }>,
): StatusEntry[] {
  const counts = new Map<number, number>();
  for (const event of events) {
    if (event.status == null) continue;
    counts.set(event.status, (counts.get(event.status) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a - b)
    .map(([status, count]) => ({ status, count }));
}

/** Distinct service colors from events (stable first-seen order). */
export function serviceColorsFromEvents(
  events: Array<{ serviceColor?: string | null }>,
): ColorEntry[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const color = normalizeServiceColor(event.serviceColor);
    if (!color) continue;
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([color, count]) => ({
    color,
    count,
  }));
}
