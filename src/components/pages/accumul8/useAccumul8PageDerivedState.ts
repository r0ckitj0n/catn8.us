import React from 'react';

import { toEntityEndexGuideKey } from './accumul8PageEntityUtils';

export function useAccumul8PageDerivedState(options: any) {
  const handleProjectedBalanceCardClick = React.useCallback(() => {
    options.setSummaryWindow((currentWindow: number) => {
      const currentIndex = options.summaryWindowOptions.indexOf(currentWindow);
      const nextIndex = currentIndex >= 0
        ? (currentIndex + 1) % options.summaryWindowOptions.length
        : options.summaryWindowOptions.length - 1;
      return options.summaryWindowOptions[nextIndex];
    });
  }, [options.setSummaryWindow, options.summaryWindowOptions]);

  const budgetRowsSorted = React.useMemo(() => (
    [...options.budgetRows].sort((a, b) => (a.row_order - b.row_order) || (a.id - b.id))
  ), [options.budgetRows]);

  const entityEndexGuideByParentKey = React.useMemo(() => (
    options.entityEndexGuides.reduce((acc: Record<string, any>, guide: any) => {
      const key = toEntityEndexGuideKey(guide);
      if (key) acc[key] = guide;
      return acc;
    }, {})
  ), [options.entityEndexGuides]);

  const activeInlineRows = React.useMemo(() => ([
    options.activeLedgerRowId !== null ? {
      key: `ledger-${options.activeLedgerRowId}`,
      hasDraft: Boolean(options.ledgerDraftById[options.activeLedgerRowId]),
      clear: () => options.setActiveLedgerRowId((current: number | null) => (current === options.activeLedgerRowId ? null : current)),
    } : null,
    options.activePayBillRowId !== null ? {
      key: `paybill-${options.activePayBillRowId}`,
      hasDraft: Boolean(options.payBillDraftById[options.activePayBillRowId]),
      clear: () => options.setActivePayBillRowId((current: number | null) => (current === options.activePayBillRowId ? null : current)),
    } : null,
    options.activeDebtorRowId !== null ? {
      key: `debtor-${options.activeDebtorRowId}`,
      hasDraft: Boolean(options.debtorDraftById[options.activeDebtorRowId]),
      clear: () => options.setActiveDebtorRowId((current: number | null) => (current === options.activeDebtorRowId ? null : current)),
    } : null,
    options.activeEntityRowId !== null ? {
      key: `entity-${options.activeEntityRowId}`,
      hasDraft: Boolean(options.entityDraftById[options.activeEntityRowId]),
      clear: () => options.setActiveEntityRowId((current: number | null) => (current === options.activeEntityRowId ? null : current)),
    } : null,
    options.activeRecurringRowId !== null ? {
      key: `recurring-${options.activeRecurringRowId}`,
      hasDraft: Boolean(options.recurringDraftById[options.activeRecurringRowId]),
      clear: () => options.setActiveRecurringRowId((current: number | null) => (current === options.activeRecurringRowId ? null : current)),
    } : null,
  ].filter(Boolean) as Array<{ key: string; hasDraft: boolean; clear: () => void }>), [
    options.activeDebtorRowId,
    options.activeEntityRowId,
    options.activeLedgerRowId,
    options.activePayBillRowId,
    options.activeRecurringRowId,
    options.debtorDraftById,
    options.entityDraftById,
    options.ledgerDraftById,
    options.payBillDraftById,
    options.recurringDraftById,
    options.setActiveDebtorRowId,
    options.setActiveEntityRowId,
    options.setActiveLedgerRowId,
    options.setActivePayBillRowId,
    options.setActiveRecurringRowId,
  ]);

  return {
    activeInlineRows,
    budgetRowsSorted,
    entityEndexGuideByParentKey,
    handleProjectedBalanceCardClick,
  };
}
