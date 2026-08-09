import type { ColumnFiltersState } from "@tanstack/react-table";

/** Slice a full client-side list for useDataTable (manualPagination). */
export function paginateClientRows<T>(
  items: T[],
  pageIndex: number,
  pageSize: number,
): { rows: T[]; pageCount: number; total: number } {
  const total = items.length;
  const size = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const safeIndex = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const start = safeIndex * size;
  return {
    rows: items.slice(start, start + size),
    pageCount,
    total,
  };
}

type AccessorMap<T> = Record<string, (row: T) => unknown>;

/**
 * Client-side column filters for DataTableToolbar when useDataTable
 * runs with manualFiltering: true.
 */
export function filterClientRows<T>(
  items: T[],
  filters: ColumnFiltersState,
  accessors?: AccessorMap<T>,
): T[] {
  if (!filters.length) return items;

  return items.filter((row) =>
    filters.every((filter) => {
      const raw =
        accessors?.[filter.id]?.(row) ??
        (row as Record<string, unknown>)[filter.id];
      const haystack = String(raw ?? "").toLowerCase();
      const value = filter.value;

      if (value == null || value === "") return true;

      if (Array.isArray(value)) {
        if (!value.length) return true;
        return value.some((v) => {
          const needle = String(v).toLowerCase();
          return haystack === needle || haystack.includes(needle);
        });
      }

      if (typeof value === "boolean") {
        return Boolean(raw) === value;
      }

      return haystack.includes(String(value).toLowerCase());
    }),
  );
}

/** Filter then paginate — standard list-view pipeline. */
export function filterAndPaginateClientRows<T>(
  items: T[],
  filters: ColumnFiltersState,
  pageIndex: number,
  pageSize: number,
  accessors?: AccessorMap<T>,
) {
  return paginateClientRows(
    filterClientRows(items, filters, accessors),
    pageIndex,
    pageSize,
  );
}
