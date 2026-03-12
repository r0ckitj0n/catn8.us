import React from 'react';
import { PriorityTableSortState } from '../../hooks/usePriorityTableLayout';

interface Accumul8TableHeaderCellProps {
  label: string;
  columnKey: string;
  className?: string;
  sortState: PriorityTableSortState;
  sortable?: boolean;
  onSort: (key: string) => void;
  onResizeStart: (key: string, event: React.MouseEvent<HTMLSpanElement>) => void;
}

function resolveAriaSort(sortState: PriorityTableSortState, columnKey: string): React.AriaAttributes['aria-sort'] {
  if (!sortState || sortState.key !== columnKey) {
    return 'none';
  }
  return sortState.direction === 'asc' ? 'ascending' : 'descending';
}

function resolveSortGlyph(sortState: PriorityTableSortState, columnKey: string): string {
  if (!sortState || sortState.key !== columnKey) {
    return '<>';
  }
  return sortState.direction === 'asc' ? '/\\' : '\\/';
}

export function Accumul8TableHeaderCell({
  label,
  columnKey,
  className,
  sortState,
  sortable = true,
  onSort,
  onResizeStart,
}: Accumul8TableHeaderCellProps) {
  return (
    <th className={className} aria-sort={sortable ? resolveAriaSort(sortState, columnKey) : undefined}>
      <div className="accumul8-table-header-cell">
        {sortable ? (
          <button
            type="button"
            className="accumul8-table-header-button"
            onClick={() => onSort(columnKey)}
          >
            <span>{label}</span>
            <span className="accumul8-table-header-sort-indicator" aria-hidden="true">
              {resolveSortGlyph(sortState, columnKey)}
            </span>
          </button>
        ) : (
          <span className="accumul8-table-header-button accumul8-table-header-button--static">
            <span>{label}</span>
          </span>
        )}
        <span
          className="accumul8-table-header-resize-handle"
          onMouseDown={(event) => onResizeStart(columnKey, event)}
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${label} column`}
        />
      </div>
    </th>
  );
}
