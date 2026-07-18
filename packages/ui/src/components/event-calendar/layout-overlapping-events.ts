import type { TimeGridLayout } from "./hour-layout";
import {
  getEventHeightPx,
  getEventTopPx as getTopFromLayout,
} from "./hour-layout";
import type { CalendarEvent } from "./types";

export type PositionedCalendarEvent<T = unknown> = {
  event: CalendarEvent<T>;
  top: number;
  height: number;
  column: number;
  columnCount: number;
};

function eventsOverlapByPosition(
  topA: number,
  heightA: number,
  topB: number,
  heightB: number,
  gapPx = EVENT_COLUMN_GAP_PX,
): boolean {
  return topA < topB + heightB && topB < topA + heightA;
}

export function layoutOverlappingEvents<T>(
  events: CalendarEvent<T>[],
  layout: TimeGridLayout,
  fallbackCardHeight: number,
): PositionedCalendarEvent<T>[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );


  const columnBottoms: number[] = [];
  const positioned: PositionedCalendarEvent<T>[] = [];

  for (const event of sorted) {
    const height = getEventHeightPx(event, layout, fallbackCardHeight);
    const top = getTopFromLayout(event, layout, height);

    let column = columnBottoms.findIndex((bottom) => bottom <= top);
    if (column === -1) {
      column = columnBottoms.length;
      columnBottoms.push(top + height);
    } else {
      columnBottoms[column] = top + height;
    }

    positioned.push({
      event,
      top,
      height,
      column,
      columnCount: 1,
    });
  }

  for (let i = 0; i < positioned.length; i++) {
    const clusterIndices = positioned
      .map((_, j) => j)
      .filter((j) =>
        eventsOverlapByPosition(
          positioned[i].top,
          positioned[i].height,
          positioned[j].top,
          positioned[j].height,
        ),
      );

    const maxColumn = Math.max(
      ...clusterIndices.map((j) => positioned[j].column),
    );
    const columnCount = maxColumn + 1;

    for (const j of clusterIndices) {
      positioned[j].columnCount = Math.max(
        positioned[j].columnCount,
        columnCount,
      );
    }
  }

  return positioned;
}

/** Horizontal gap between side-by-side (overlapping) cards. */
export const EVENT_COLUMN_GAP_PX = 8;
/** Vertical gap between stacked cards. */
export const EVENT_ROW_GAP_PX = 3;

export function getPositionedEventStyle(
  positioned: PositionedCalendarEvent,
  gapPx = EVENT_COLUMN_GAP_PX,
): { left: string; width: string } {
  const { column, columnCount } = positioned;
  const widthPct = 100 / columnCount;
  const leftPct = column * widthPct;
  return {
    left: `calc(${leftPct}% + ${gapPx / 2}px)`,
    width: `calc(${widthPct}% - ${gapPx}px)`,
  };
}
