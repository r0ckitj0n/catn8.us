import React from 'react';

export type PriorityTableSortDirection = 'asc' | 'desc';

export type PriorityTableSortState = {
  key: string;
  direction: PriorityTableSortDirection;
} | null;

export interface PriorityTableColumn<Row> {
  key: string;
  header: string;
  minWidth: number;
  maxAutoWidth?: number;
  priority?: number;
  sortable?: boolean;
  resizable?: boolean;
  contentAccessor?: (row: Row) => unknown;
  sortAccessor?: (row: Row) => unknown;
  defaultSortDirection?: PriorityTableSortDirection;
}

type UsePriorityTableLayoutArgs<Row> = {
  tableRef: React.RefObject<HTMLTableElement | null>;
  rows: Row[];
  columns: Array<PriorityTableColumn<Row>>;
};

export interface PriorityTableLayout<Row> {
  rows: Row[];
  columnsByKey: Record<string, PriorityTableColumn<Row>>;
  sortState: PriorityTableSortState;
  tableStyle: React.CSSProperties;
  getColumnStyle: (key: string) => React.CSSProperties;
  requestSort: (key: string) => void;
  startResize: (key: string, event: React.MouseEvent<HTMLSpanElement>) => void;
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

function estimateTextWidth(value: unknown): number {
  const normalized = normalizeTextWidthValue(value).replace(/\t/g, '    ').trim();
  if (!normalized) {
    return 0;
  }
  const longestLine = normalized
    .split(/\r?\n/)
    .reduce((max, line) => Math.max(max, line.trim().length), 0);
  return Math.ceil(28 + longestLine * 8.4);
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

function compareSortValues(left: unknown, right: unknown): number {
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

function getContainerWidth(tableRef: React.RefObject<HTMLTableElement | null>): number {
  const table = tableRef.current;
  const container = table?.parentElement;
  return container ? Math.floor(container.clientWidth) : 0;
}

export function usePriorityTableLayout<Row>({
  tableRef,
  rows,
  columns,
}: UsePriorityTableLayoutArgs<Row>): PriorityTableLayout<Row> {
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [sortState, setSortState] = React.useState<PriorityTableSortState>(null);
  const [columnOverrides, setColumnOverrides] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    const updateWidth = () => setContainerWidth(getContainerWidth(tableRef));
    updateWidth();
    const container = tableRef.current?.parentElement;
    if (!container || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(container);
    return () => observer.disconnect();
  }, [tableRef]);

  const columnsByKey = React.useMemo(() => (
    columns.reduce<Record<string, PriorityTableColumn<Row>>>((acc, column) => {
      acc[column.key] = column;
      return acc;
    }, {})
  ), [columns]);

  const computedWidths = React.useMemo(() => {
    const widths: Record<string, number> = {};
    let totalWidth = 0;
    columns.forEach((column) => {
      const sampledRows = rows.slice(0, 150);
      const contentWidth = sampledRows.reduce((max, row) => {
        const nextValue = column.contentAccessor ? column.contentAccessor(row) : '';
        return Math.max(max, estimateTextWidth(nextValue));
      }, 0);
      const headerWidth = estimateTextWidth(column.header);
      const autoWidth = Math.max(column.minWidth, headerWidth, contentWidth);
      const clampedWidth = Math.min(column.maxAutoWidth ?? autoWidth, autoWidth);
      const overrideWidth = columnOverrides[column.key];
      const finalWidth = Math.max(column.minWidth, overrideWidth ?? clampedWidth);
      widths[column.key] = finalWidth;
      totalWidth += finalWidth;
    });

    const availableExtra = Math.max(containerWidth - totalWidth, 0);
    const growableColumns = columns.filter((column) => (column.priority ?? 0) > 0 && columnOverrides[column.key] === undefined);
    const totalPriority = growableColumns.reduce((sum, column) => sum + (column.priority ?? 0), 0);

    if (availableExtra > 0 && totalPriority > 0) {
      let distributed = 0;
      growableColumns.forEach((column, index) => {
        const remaining = availableExtra - distributed;
        const isLast = index === growableColumns.length - 1;
        const slice = isLast
          ? remaining
          : Math.floor((availableExtra * (column.priority ?? 0)) / totalPriority);
        widths[column.key] += slice;
        distributed += slice;
      });
      totalWidth += availableExtra;
    }

    return {
      widths,
      totalWidth,
    };
  }, [columnOverrides, columns, containerWidth, rows]);

  const sortedRows = React.useMemo(() => {
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
  }, [columnsByKey, rows, sortState]);

  const requestSort = React.useCallback((key: string) => {
    setSortState((current) => {
      const column = columnsByKey[key];
      if (!column?.sortable) {
        return current;
      }
      if (!current || current.key !== key) {
        return {
          key,
          direction: column.defaultSortDirection ?? 'asc',
        };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  }, [columnsByKey]);

  const startResize = React.useCallback((key: string, event: React.MouseEvent<HTMLSpanElement>) => {
    const column = columnsByKey[key];
    if (!column || column.resizable === false) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const startingWidth = computedWidths.widths[key] ?? column.minWidth;
    const startX = event.clientX;
    const minimumWidth = column.minWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setColumnOverrides((current) => ({
        ...current,
        [key]: Math.max(minimumWidth, Math.round(startingWidth + delta)),
      }));
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('accumul8-column-resize-active');
    };
    document.body.classList.add('accumul8-column-resize-active');
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [columnsByKey, computedWidths.widths]);

  const tableStyle = React.useMemo<React.CSSProperties>(() => ({
    minWidth: `${Math.ceil(Math.max(computedWidths.totalWidth, containerWidth || 0))}px`,
  }), [computedWidths.totalWidth, containerWidth]);

  const getColumnStyle = React.useCallback((key: string): React.CSSProperties => ({
    width: `${Math.round(computedWidths.widths[key] ?? columnsByKey[key]?.minWidth ?? 120)}px`,
  }), [columnsByKey, computedWidths.widths]);

  return {
    rows: sortedRows,
    columnsByKey,
    sortState,
    tableStyle,
    getColumnStyle,
    requestSort,
    startResize,
  };
}
