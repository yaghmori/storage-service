"use client";

import { Checkbox } from "@workspace/ui/components";
import { cn } from "@workspace/ui/lib/utils";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  computeSelectedCount,
  isFilteredRowSelected,
} from "./filtered-selection-math";

/**
 * Selection model for server-paginated tables where the header checkbox means
 * "every row matching the current filters", not "every row on this page".
 *
 * Two mutually exclusive modes:
 * - all-matching: `excludedIds` holds rows the user unchecked afterwards.
 * - explicit: `includedIds` holds rows checked one by one, kept across pages.
 */
export type FilteredSelection = {
  /** Rows matching the active server-side filters. */
  total: number;
  allMatching: boolean;
  excludedIds: string[];
  includedIds: string[];
  selectedCount: number;
  hasSelection: boolean;
  /** Some but not all matching rows are selected. */
  isPartial: boolean;
  isRowSelected: (id: string) => boolean;
  toggleRow: (id: string, checked: boolean) => void;
  toggleAll: (checked: boolean) => void;
  reset: () => void;
};

export function useFilteredSelection(total: number): FilteredSelection {
  const [allMatching, setAllMatching] = useState(false);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [included, setIncluded] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const reset = useCallback(() => {
    setAllMatching(false);
    setExcluded(new Set<string>());
    setIncluded(new Set<string>());
  }, []);

  const toggleAll = useCallback((checked: boolean) => {
    setExcluded(new Set<string>());
    setIncluded(new Set<string>());
    setAllMatching(checked);
  }, []);

  const toggleRow = useCallback(
    (id: string, checked: boolean) => {
      if (allMatching) {
        setExcluded((prev) => {
          const next = new Set(prev);
          if (checked) next.delete(id);
          else next.add(id);
          return next;
        });
        return;
      }
      setIncluded((prev) => {
        const next = new Set(prev);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    [allMatching],
  );

  const isRowSelected = useCallback(
    (id: string) =>
      isFilteredRowSelected({
        allMatching,
        id,
        excludedIds: excluded,
        includedIds: included,
      }),
    [allMatching, excluded, included],
  );

  return useMemo(() => {
    const selectedCount = computeSelectedCount({
      allMatching,
      total,
      excludedCount: excluded.size,
      includedCount: included.size,
    });
    return {
      total,
      allMatching,
      excludedIds: Array.from(excluded),
      includedIds: Array.from(included),
      selectedCount,
      hasSelection: selectedCount > 0,
      isPartial: selectedCount > 0 && selectedCount < total,
      isRowSelected,
      toggleRow,
      toggleAll,
      reset,
    };
  }, [
    allMatching,
    excluded,
    included,
    isRowSelected,
    reset,
    toggleAll,
    toggleRow,
    total,
  ]);
}

const FilteredSelectionContext = createContext<FilteredSelection | null>(null);

export function FilteredSelectionProvider({
  value,
  children,
}: {
  value: FilteredSelection;
  children: ReactNode;
}) {
  return (
    <FilteredSelectionContext.Provider value={value}>
      {children}
    </FilteredSelectionContext.Provider>
  );
}

function useFilteredSelectionContext(): FilteredSelection {
  const context = useContext(FilteredSelectionContext);
  if (!context) {
    throw new Error(
      "Filtered selection cells must be rendered inside <FilteredSelectionProvider>",
    );
  }
  return context;
}

/** Header checkbox: selects every row matching the current filters. */
export function FilteredSelectAllHeader() {
  const selection = useFilteredSelectionContext();
  return (
    <Checkbox
      checked={selection.total > 0 && selection.selectedCount === selection.total}
      indeterminate={selection.isPartial}
      disabled={selection.total === 0}
      onCheckedChange={(value) => selection.toggleAll(!!value)}
      aria-label="Select all rows matching the current filters"
      className="size-4!"
    />
  );
}

export function FilteredSelectRowCell({
  id,
  disabled,
}: {
  id: string;
  disabled?: boolean;
}) {
  const selection = useFilteredSelectionContext();
  const selected = selection.isRowSelected(id);
  return (
    <>
      <div
        className={cn(
          "absolute start-0 top-0 bottom-0 hidden w-0.5 bg-primary",
          selected && "block",
        )}
      />
      <Checkbox
        checked={selected}
        disabled={disabled}
        onCheckedChange={(value) => selection.toggleRow(id, !!value)}
        aria-label="Select row"
        className="size-4!"
      />
    </>
  );
}

/** Mirrors the selection onto loaded rows so DataGrid row highlighting works. */
export function buildRowSelectionState(
  ids: string[],
  isRowSelected: (id: string) => boolean,
): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const id of ids) {
    if (isRowSelected(id)) next[id] = true;
  }
  return next;
}

export function sameRowSelectionState(
  a: Record<string, boolean>,
  b: Record<string, boolean>,
): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}
