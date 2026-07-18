"use client";

import type { Column, Table } from "@tanstack/react-table";
import { X } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { useDebouncedCallback } from "@workspace/ui/hooks/use-debounced-callback";
import { cn } from "@workspace/ui/lib/utils";
import { DataTableDateFilter } from "./data-table-date-filter";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";
import { DataTableSliderFilter } from "./data-table-slider-filter";
import { DataTableSortList } from "./data-table-sort-list";
import { DataTableViewOptions } from "./data-table-view-options";

const TEXT_FILTER_DEBOUNCE_MS = 300;

interface DataTableToolbarProps<TData> extends React.ComponentProps<"div"> {
  table: Table<TData>;
  /** Rendered immediately before the column visibility control. */
  beforeViewOptions?: React.ReactNode;
}

export function DataTableToolbar<TData>({
  table,
  children,
  beforeViewOptions,
  className,
  ...props
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const columns = React.useMemo(
    () => table.getAllColumns().filter((column) => column.getCanFilter()),
    [table],
  );

  const onReset = React.useCallback(() => {
    table.resetColumnFilters();
  }, [table]);

  return (
    <div
      role="toolbar"
      aria-orientation="horizontal"
      className={cn(
        "flex gap-2 justify-between p-1 items-start w-full",
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap flex-1 gap-2 items-center">
        {columns.map((column) => (
          <DataTableToolbarFilter key={column.id} column={column} />
        ))}
        {isFiltered && (
          <Button
            aria-label="Reset filters"
            variant="outline"
            size="sm"
            className="border-dashed"
            onClick={onReset}
          >
            <X />
            Reset
          </Button>
        )}
      </div>

      <div className="flex gap-2 items-center">
        {children}
        <DataTableSortList table={table} />
        <DataTableViewOptions table={table} />
        {beforeViewOptions}
      </div>
    </div>
  );
}
interface DebouncedTextFilterInputProps<TData> {
  column: Column<TData>;
  placeholder?: string;
}

function DebouncedTextFilterInput<TData>({
  column,
  placeholder,
}: DebouncedTextFilterInputProps<TData>) {
  const filterValue = (column.getFilterValue() as string) ?? "";
  const [localValue, setLocalValue] = React.useState(filterValue);
  React.useEffect(() => {
    setLocalValue(filterValue);
  }, [filterValue]);
  const debouncedSetFilter = useDebouncedCallback(
    (value: string) => column.setFilterValue(value),
    TEXT_FILTER_DEBOUNCE_MS,
  );
  return (
    <Input
      placeholder={placeholder}
      value={localValue}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        const v = event.target.value;
        setLocalValue(v);
        debouncedSetFilter(v);
      }}
      className="w-40 h-9 lg:w-56 bg-background"
    />
  );
}

interface DataTableToolbarFilterProps<TData> {
  column: Column<TData>;
}

function DataTableToolbarFilter<TData>({
  column,
}: DataTableToolbarFilterProps<TData>) {
  {
    const columnMeta = column.columnDef.meta;

    const onFilterRender = React.useCallback(() => {
      if (!columnMeta?.variant) return null;

      switch (columnMeta.variant) {
        case "text":
          return (
            <DebouncedTextFilterInput
              column={column}
              placeholder={columnMeta.placeholder ?? columnMeta.label}
            />
          );

        case "number":
          return (
            <div className="relative">
              <Input
                type="number"
                inputMode="numeric"
                placeholder={columnMeta.placeholder ?? columnMeta.label}
                value={(column.getFilterValue() as string) ?? ""}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  column.setFilterValue(event.target.value)
                }
                className={cn("h-8 w-[120px]", columnMeta.unit && "pr-8")}
              />
              {columnMeta.unit && (
                <span className="flex absolute top-0 right-0 bottom-0 items-center px-2 text-sm rounded-r-md bg-accent text-muted-foreground">
                  {columnMeta.unit}
                </span>
              )}
            </div>
          );

        case "range":
          return (
            <DataTableSliderFilter
              column={column}
              title={columnMeta.label ?? column.id}
            />
          );

        case "date":
        case "dateRange":
          return (
            <DataTableDateFilter
              column={column}
              title={columnMeta.label ?? column.id}
              multiple={columnMeta.variant === "dateRange"}
            />
          );

        case "select":
        case "multiSelect":
          return (
            <DataTableFacetedFilter
              column={column}
              title={columnMeta.label ?? column.id}
              options={columnMeta.options ?? []}
              loadOptions={columnMeta.asyncOptions}
              renderOption={columnMeta.renderOption}
              multiple={columnMeta.variant === "multiSelect"}
            />
          );

        default:
          return null;
      }
    }, [column, columnMeta]);

    return onFilterRender();
  }
}
