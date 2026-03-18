import React from 'react';

import { formatCurrency } from './accumul8SpreadsheetViewUtils';

interface Accumul8SpreadsheetToolbarProps {
  busy: boolean;
  budgetFilterQuery: string;
  isAtPlanningLimit: boolean;
  monthLabel: string;
  selectedSummary: { inflow: number; net: number; outflow: number; recurringCount: number } | null;
  setBudgetFilterQuery: (value: string) => void;
  onMonthShift: (offset: number) => void;
}

export function Accumul8SpreadsheetToolbar({
  busy,
  budgetFilterQuery,
  isAtPlanningLimit,
  monthLabel,
  selectedSummary,
  setBudgetFilterQuery,
  onMonthShift,
}: Accumul8SpreadsheetToolbarProps) {
  return (
    <div className="accumul8-panel-toolbar">
      <div className="accumul8-spreadsheet-toolbar-controls">
        <div className="accumul8-spreadsheet-nav">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onMonthShift(-1)} disabled={busy} aria-label="Previous month">
            <i className="bi bi-chevron-left"></i>
          </button>
          <div className="accumul8-spreadsheet-nav-label">{monthLabel}</div>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onMonthShift(1)} disabled={busy || isAtPlanningLimit} aria-label="Next month">
            <i className="bi bi-chevron-right"></i>
          </button>
        </div>
        {selectedSummary ? <div className="accumul8-month-stats"><span>{selectedSummary.recurringCount} recurring items</span></div> : null}
      </div>
      <div className="accumul8-spreadsheet-filter">
        <input type="text" className="form-control" value={budgetFilterQuery} onChange={(event) => setBudgetFilterQuery(event.target.value)} placeholder="Filter budget list" aria-label="Filter budget list" disabled={busy} />
      </div>
      {selectedSummary ? (
        <div className="accumul8-month-summary">
          <div><span>Inflow</span><strong>{formatCurrency(selectedSummary.inflow)}</strong></div>
          <div><span>Outflow</span><strong>{formatCurrency(selectedSummary.outflow)}</strong></div>
          <div><span>Net</span><strong>{formatCurrency(selectedSummary.net)}</strong></div>
        </div>
      ) : null}
    </div>
  );
}
