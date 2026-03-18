import React from 'react';

import { Accumul8Account } from '../../../types/accumul8';

interface UseAccumul8PageUiHelpersOptions {
  accounts: Accumul8Account[];
  dateRangeFilterOptions: Array<{ value: string; label: string }>;
  flashSaveButtonTimeoutRef: React.MutableRefObject<number | null>;
  getActiveFilterClass: (baseClass: string, isActive: boolean) => string;
  inlineRowRefs: React.MutableRefObject<Record<string, HTMLTableRowElement | null>>;
  setFlashingSaveButtonKey: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useAccumul8PageUiHelpers({
  accounts,
  dateRangeFilterOptions,
  flashSaveButtonTimeoutRef,
  getActiveFilterClass,
  inlineRowRefs,
  setFlashingSaveButtonKey,
}: UseAccumul8PageUiHelpersOptions) {
  const linkedAccountsByConnectionId = React.useMemo(() => {
    const next: Record<number, Accumul8Account[]> = {};
    accounts.forEach((account) => {
      const connectionId = Number(account.bank_connection_id || 0);
      if (connectionId <= 0) return;
      if (!next[connectionId]) next[connectionId] = [];
      next[connectionId].push(account);
    });
    return next;
  }, [accounts]);

  const renderDateRangeControls = React.useCallback((
    prefix: 'ledger' | 'pay-bills',
    filter: string,
    setFilter: (value: any) => void,
    customStartDate: string,
    setCustomStartDate: (value: string) => void,
    customEndDate: string,
    setCustomEndDate: (value: string) => void,
    includeAllDates = false,
  ) => (
    <div className="accumul8-panel-toolbar-range d-flex flex-wrap align-items-end gap-2">
      <div className="accumul8-toolbar-field accumul8-toolbar-field--compact">
        <label className="visually-hidden" htmlFor={`accumul8-${prefix}-range`}>Date Range</label>
        <select id={`accumul8-${prefix}-range`} className={getActiveFilterClass('form-select form-select-sm accumul8-panel-toolbar-range-select', includeAllDates ? filter !== 'all_dates' : filter !== '30_days')} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Date range">
          {includeAllDates ? <option value="all_dates">All Dates</option> : null}
          {dateRangeFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      {filter === 'custom' ? (
        <>
          <div className="accumul8-toolbar-field accumul8-toolbar-field--compact">
            <label className="visually-hidden" htmlFor={`accumul8-${prefix}-start`}>Start date</label>
            <input id={`accumul8-${prefix}-start`} className={getActiveFilterClass('form-control form-control-sm', customStartDate.trim() !== '')} type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} aria-label="Start date" />
          </div>
          <div className="accumul8-toolbar-field accumul8-toolbar-field--compact">
            <label className="visually-hidden" htmlFor={`accumul8-${prefix}-end`}>End date</label>
            <input id={`accumul8-${prefix}-end`} className={getActiveFilterClass('form-control form-control-sm', customEndDate.trim() !== '')} type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} aria-label="End date" />
          </div>
        </>
      ) : null}
    </div>
  ), [dateRangeFilterOptions, getActiveFilterClass]);

  const setInlineRowRef = React.useCallback((key: string, node: HTMLTableRowElement | null) => {
    if (node) {
      inlineRowRefs.current[key] = node;
      return;
    }
    delete inlineRowRefs.current[key];
  }, [inlineRowRefs]);

  const flashSaveButton = React.useCallback((key: string) => {
    setFlashingSaveButtonKey(key);
    if (flashSaveButtonTimeoutRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(flashSaveButtonTimeoutRef.current);
    }
    if (typeof window !== 'undefined') {
      flashSaveButtonTimeoutRef.current = window.setTimeout(() => {
        setFlashingSaveButtonKey((current) => (current === key ? '' : current));
        flashSaveButtonTimeoutRef.current = null;
      }, 900);
    }
  }, [flashSaveButtonTimeoutRef, setFlashingSaveButtonKey]);

  const parseCustomUserIds = React.useCallback((raw: string): number[] => raw.split(',').map((v) => Number(v.trim())).filter((n) => Number.isFinite(n) && n > 0), []);

  return { flashSaveButton, linkedAccountsByConnectionId, parseCustomUserIds, renderDateRangeControls, setInlineRowRef };
}
