import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBulkSelectionPayload,
  computeSelectedCount,
  isFilteredRowSelected,
} from './filtered-selection-math';

describe('filtered-selection-math', () => {
  it('counts all-matching minus exclusions', () => {
    assert.equal(
      computeSelectedCount({
        allMatching: true,
        total: 100,
        excludedCount: 3,
        includedCount: 0,
      }),
      97,
    );
  });

  it('counts explicit inclusions across pages', () => {
    assert.equal(
      computeSelectedCount({
        allMatching: false,
        total: 100,
        excludedCount: 0,
        includedCount: 5,
      }),
      5,
    );
  });

  it('selects every matching row until unchecked', () => {
    assert.equal(
      isFilteredRowSelected({
        allMatching: true,
        id: 'a',
        excludedIds: ['b'],
        includedIds: [],
      }),
      true,
    );
    assert.equal(
      isFilteredRowSelected({
        allMatching: true,
        id: 'b',
        excludedIds: ['b'],
        includedIds: [],
      }),
      false,
    );
  });

  it('builds server bulk payloads for both modes', () => {
    assert.deepEqual(
      buildBulkSelectionPayload({
        allMatching: true,
        includedIds: [],
        excludedIds: ['x'],
      }),
      { allMatchingFilters: true, excludeIds: ['x'] },
    );
    assert.deepEqual(
      buildBulkSelectionPayload({
        allMatching: false,
        includedIds: ['a', 'b'],
        excludedIds: [],
      }),
      { ids: ['a', 'b'] },
    );
  });
});
