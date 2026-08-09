"use client";

import type { ColumnDef } from "@tanstack/react-table";

/** Eallyfe-style global search column — hidden; drives one toolbar text input. */
export function createSearchColumn<TData>(
  placeholder = "Search…",
): ColumnDef<TData> {
  return {
    id: "search",
    accessorKey: "search",
    header: "Search",
    cell: () => null,
    enableColumnFilter: true,
    enableSorting: false,
    enableHiding: false,
    meta: {
      variant: "text",
      label: "Search",
      placeholder,
    },
  };
}

/** Join row fields into one haystack for the global search filter. */
export function joinSearchText(...parts: unknown[]): string {
  return parts
    .flatMap((part) => {
      if (part == null || part === "") return [];
      if (Array.isArray(part)) return part.map(String);
      if (typeof part === "object") return [JSON.stringify(part)];
      return [String(part)];
    })
    .join(" ")
    .toLowerCase();
}

export const SEARCH_COLUMN_HIDDEN = { search: false } as const;
