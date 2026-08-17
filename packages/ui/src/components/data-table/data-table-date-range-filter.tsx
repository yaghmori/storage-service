"use client";

import type { Column } from "@tanstack/react-table";
import * as React from "react";

import {
  DateRangePicker,
  type DateRangePreset,
  type DateRangeValue,
} from "@workspace/ui/components/custom/date-range-picker";

function parseAsDate(value: unknown): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

interface DataTableDateRangeFilterProps<TData> {
  column: Column<TData, unknown>;
  title?: string;
  presets?: DateRangePreset[];
  showTime?: boolean;
}

/**
 * Column filter value is `[fromISO, toISO]` so consumers can forward it to an
 * API without re-encoding timestamps.
 */
export function DataTableDateRangeFilter<TData>({
  column,
  title,
  presets,
  showTime,
}: DataTableDateRangeFilterProps<TData>) {
  const columnFilterValue = column.getFilterValue();
  const [presetKey, setPresetKey] = React.useState<string | undefined>();

  const value = React.useMemo<DateRangeValue | undefined>(() => {
    if (!Array.isArray(columnFilterValue)) return undefined;
    const from = parseAsDate(columnFilterValue[0]);
    const to = parseAsDate(columnFilterValue[1]);
    if (!from || !to) return undefined;
    return { from, to, preset: presetKey };
  }, [columnFilterValue, presetKey]);

  const onChange = React.useCallback(
    (next: DateRangeValue | undefined) => {
      setPresetKey(next?.preset);
      column.setFilterValue(
        next ? [next.from.toISOString(), next.to.toISOString()] : undefined,
      );
    },
    [column],
  );

  return (
    <DateRangePicker
      value={value}
      onChange={onChange}
      title={title}
      presets={presets}
      showTime={showTime}
    />
  );
}
