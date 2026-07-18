import type { CalendarDaySummary } from "./types";

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export const HEAT_LEVEL_CLASSES: Record<HeatmapLevel, string> = {
  0: "",
  1: "bg-emerald-100/80 hover:bg-emerald-100 dark:bg-emerald-950/40",
  2: "bg-emerald-200/80 hover:bg-emerald-200 dark:bg-emerald-900/50",
  3: "bg-emerald-300/90 hover:bg-emerald-300 dark:bg-emerald-800/60",
  4: "bg-emerald-500/90 text-emerald-950 hover:bg-emerald-500 dark:bg-emerald-700 dark:text-emerald-50",
};

export const HEAT_LEVEL_LABELS: Record<HeatmapLevel, string> = {
  0: "No activity",
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Very high",
};

export function computeHeatLevel(
  count: number,
  maxCount: number,
): HeatmapLevel {
  if (count <= 0 || maxCount <= 0) return 0;
  const ratio = count / maxCount;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

export function buildDaySummaryMap(
  summaries: CalendarDaySummary[],
): Map<string, CalendarDaySummary & { level: HeatmapLevel }> {
  const maxCount = summaries.reduce(
    (max, day) => (day.count > max ? day.count : max),
    0,
  );

  const map = new Map<string, CalendarDaySummary & { level: HeatmapLevel }>();
  for (const day of summaries) {
    map.set(day.date, {
      ...day,
      level: computeHeatLevel(day.count, maxCount),
    });
  }
  return map;
}

export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatSummaryDate(dateKey: string): string {
  try {
    const d = new Date(`${dateKey}T12:00:00`);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateKey;
  }
}
