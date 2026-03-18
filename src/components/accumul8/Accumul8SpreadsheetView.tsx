import React from 'react';

import { Accumul8SpreadsheetTable } from './Accumul8SpreadsheetTable';
import { Accumul8SpreadsheetToolbar } from './Accumul8SpreadsheetToolbar';
import { Accumul8SpreadsheetViewProps } from './accumul8SpreadsheetTypes';
import { useAccumul8SpreadsheetState } from './useAccumul8SpreadsheetState';

export function Accumul8SpreadsheetView(props: Accumul8SpreadsheetViewProps) {
  const {
    accounts,
    busy,
    entities,
    onDeleteRecurring,
    onEnsureBudgetMonth,
    onOpenRecurring,
    onSelectedMonthChange,
    onUpdateTransaction,
    recurringPayments,
    selectedMonth,
    transactions,
  } = props;
  const state = useAccumul8SpreadsheetState({
    accounts,
    entities,
    onEnsureBudgetMonth,
    onSelectedMonthChange,
    onUpdateTransaction,
    recurringPayments,
    selectedMonth,
    transactions,
  });
  const monthLabel = state.monthOptions.find((option) => option.value === selectedMonth)?.label || selectedMonth;

  return (
    <div className="accumul8-spreadsheet">
      <Accumul8SpreadsheetToolbar
        busy={busy}
        budgetFilterQuery={state.budgetFilterQuery}
        isAtPlanningLimit={state.isAtPlanningLimit}
        monthLabel={monthLabel}
        selectedSummary={state.selectedSummary}
        setBudgetFilterQuery={state.setBudgetFilterQuery}
        onMonthShift={state.handleMonthShift}
      />

      <div className="accumul8-spreadsheet-grid">
        {state.filteredMonthPanels.map((panel) => (
          <Accumul8SpreadsheetTable
            key={panel.monthValue}
            accounts={accounts}
            accountDisplayNameById={state.accountDisplayNameById}
            activeRowKey={state.activeRowKey}
            budgetTable={state.budgetTable}
            budgetTableRef={state.budgetTableRef}
            busy={busy}
            draftRowByKey={state.draftRowByKey}
            entities={entities}
            normalizedBudgetFilterQuery={state.normalizedBudgetFilterQuery}
            panel={panel}
            paymentMethodLabels={state.paymentMethodLabels}
            setActiveRowKey={state.setActiveRowKey}
            setInlineRowRef={state.setInlineRowRef}
            setRowDraft={state.setRowDraft}
            onDeleteRecurring={onDeleteRecurring}
            onHandleRowRtaChange={state.handleRowRtaChange}
            onOpenRecurring={onOpenRecurring}
            onSaveRow={(row) => { void state.saveRow(row); }}
          />
        ))}
      </div>
    </div>
  );
}
