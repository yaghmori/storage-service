/**
 * Pure selection math for filtered cross-page selection.
 * Kept free of React so it can be unit-tested with node:test.
 */

export function computeSelectedCount(input: {
  allMatching: boolean;
  total: number;
  excludedCount: number;
  includedCount: number;
}): number {
  if (input.allMatching) {
    return Math.max(0, input.total - input.excludedCount);
  }
  return input.includedCount;
}

export function isFilteredRowSelected(input: {
  allMatching: boolean;
  id: string;
  excludedIds: ReadonlySet<string> | Iterable<string>;
  includedIds: ReadonlySet<string> | Iterable<string>;
}): boolean {
  const excluded =
    input.excludedIds instanceof Set
      ? input.excludedIds
      : new Set(input.excludedIds);
  const included =
    input.includedIds instanceof Set
      ? input.includedIds
      : new Set(input.includedIds);
  return input.allMatching ? !excluded.has(input.id) : included.has(input.id);
}

export function buildBulkSelectionPayload(input: {
  allMatching: boolean;
  includedIds: string[];
  excludedIds: string[];
}): {
  ids?: string[];
  allMatchingFilters?: boolean;
  excludeIds?: string[];
} {
  if (input.allMatching) {
    return {
      allMatchingFilters: true,
      excludeIds: input.excludedIds.length > 0 ? input.excludedIds : undefined,
    };
  }
  return { ids: input.includedIds };
}
