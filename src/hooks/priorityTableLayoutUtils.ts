import React from 'react';

import type { PriorityTableColumn, PriorityTableSortState } from './usePriorityTableLayout';

export function estimateTextWidth(value: unknown): number {
  const normalized = normalizeTextWidthValue(value).replace(/\t/g, '    ').trim();
  if (!normalized) {
    return 0;
  }
  const longestLine = normalized
    .split(/\r?\n/)
    .reduce((max, line) => Math.max(max, line.trim().length), 0);
  return Math.ceil(28 + longestLine * 8.4);
}

export function compareSortValues(left: unknown, right: unknown): number {
  const normalizedLeft = normalizeSortValue(left);
  const normalizedRight = normalizeSortValue(right);
  const leftEmpty = normalizedLeft === '';
  const rightEmpty = normalizedRight === '';
  if (leftEmpty && rightEmpty) {
    return 0;
  }
  if (leftEmpty) {
    return 1;
  }
  if (rightEmpty) {
    return -1;
  }
  if (typeof normalizedLeft === 'number' && typeof normalizedRight === 'number') {
    return normalizedLeft - normalizedRight;
  }
  return String(normalizedLeft).localeCompare(String(normalizedRight), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export function getContainerWidth(tableRef: React.RefObject<HTMLTableElement | null>): number {
  const table = tableRef.current;
  const container = table?.parentElement;
  return container ? Math.floor(container.clientWidth) : 0;
}

export function sortPriorityTableRows<Row>(
  rows: Row[],
  sortState: PriorityTableSortState,
  columnsByKey: Record<string, PriorityTableColumn<Row>>,
): Row[] {
  if (!sortState) {
    return rows;
  }
  const targetColumn = columnsByKey[sortState.key];
  if (!targetColumn?.sortable) {
    return rows;
  }
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftValue = targetColumn.sortAccessor ? targetColumn.sortAccessor(left.row) : targetColumn.contentAccessor?.(left.row);
      const rightValue = targetColumn.sortAccessor ? targetColumn.sortAccessor(right.row) : targetColumn.contentAccessor?.(right.row);
      const comparison = compareSortValues(leftValue, rightValue);
      if (comparison !== 0) {
        return sortState.direction === 'asc' ? comparison : -comparison;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.row);
}

function normalizeTextWidthValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeTextWidthValue(item)).filter(Boolean).join('\n');
  }
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  return String(value);
}

function normalizeSortValue(value: unknown): string | number {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return String(value).trim().toLowerCase();
}
