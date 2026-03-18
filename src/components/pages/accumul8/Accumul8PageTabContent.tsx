import React from 'react';

import { Accumul8AIcountantPanel } from '../../accumul8/Accumul8AIcountantPanel';
import { Accumul8ContactsTab } from './Accumul8ContactsTab';
import { Accumul8DebtorsTab } from './Accumul8DebtorsTab';
import { Accumul8EntityEndexTab } from './Accumul8EntityEndexTab';
import { Accumul8LedgerTab } from './Accumul8LedgerTab';
import { Accumul8NotificationsTab } from './Accumul8NotificationsTab';
import { Accumul8PayBillsTab } from './Accumul8PayBillsTab';
import { Accumul8RecurringTab } from './Accumul8RecurringTab';
import { Accumul8SyncTab } from './Accumul8SyncTab';

const Accumul8StatementsPanel = React.lazy(async () => {
  const mod = await import('../../accumul8/Accumul8StatementsPanel');
  return { default: mod.Accumul8StatementsPanel };
});

const Accumul8CalendarView = React.lazy(async () => {
  const mod = await import('../../accumul8/Accumul8CalendarView');
  return { default: mod.Accumul8CalendarView };
});

const Accumul8SpreadsheetView = React.lazy(async () => {
  const mod = await import('../../accumul8/Accumul8SpreadsheetView');
  return { default: mod.Accumul8SpreadsheetView };
});

const ACCUMUL8_TAB_LOADING_FALLBACK = <div className="accumul8-panel text-muted py-4">Loading view...</div>;

interface Accumul8PageTabContentProps {
  aiPanelProps: React.ComponentProps<typeof Accumul8AIcountantPanel>;
  calendarViewProps: React.ComponentProps<typeof Accumul8CalendarView>;
  contactsTabProps: React.ComponentProps<typeof Accumul8ContactsTab>;
  debtorsTabProps: React.ComponentProps<typeof Accumul8DebtorsTab>;
  entityEndexTabProps: React.ComponentProps<typeof Accumul8EntityEndexTab>;
  ledgerTabProps: React.ComponentProps<typeof Accumul8LedgerTab>;
  notificationsTabProps: React.ComponentProps<typeof Accumul8NotificationsTab>;
  payBillsTabProps: React.ComponentProps<typeof Accumul8PayBillsTab>;
  recurringTabProps: React.ComponentProps<typeof Accumul8RecurringTab>;
  spreadsheetViewProps: React.ComponentProps<typeof Accumul8SpreadsheetView>;
  statementsPanelProps: React.ComponentProps<typeof Accumul8StatementsPanel>;
  syncTabProps: React.ComponentProps<typeof Accumul8SyncTab>;
  tab: 'aicountant' | 'ledger' | 'calendar' | 'spreadsheet' | 'debtors' | 'pay_bills' | 'contacts' | 'entity_endex' | 'recurring' | 'notifications' | 'sync' | 'statements';
}

export function Accumul8PageTabContent({
  aiPanelProps,
  calendarViewProps,
  contactsTabProps,
  debtorsTabProps,
  entityEndexTabProps,
  ledgerTabProps,
  notificationsTabProps,
  payBillsTabProps,
  recurringTabProps,
  spreadsheetViewProps,
  statementsPanelProps,
  syncTabProps,
  tab,
}: Accumul8PageTabContentProps) {
  return (
    <div className={`accumul8-tab-shell accumul8-tab-shell--${tab}`}>
      {tab === 'aicountant' ? (
        <div className="accumul8-panel accumul8-panel--viewport-fill">
          <Accumul8AIcountantPanel {...aiPanelProps} />
        </div>
      ) : null}
      {tab === 'ledger' ? <Accumul8LedgerTab {...ledgerTabProps} /> : null}
      {tab === 'calendar' ? (
        <React.Suspense fallback={ACCUMUL8_TAB_LOADING_FALLBACK}>
          <div className="accumul8-panel accumul8-panel--viewport-fill accumul8-panel--calendar-scroll">
            <Accumul8CalendarView {...calendarViewProps} />
          </div>
        </React.Suspense>
      ) : null}
      {tab === 'spreadsheet' ? (
        <React.Suspense fallback={ACCUMUL8_TAB_LOADING_FALLBACK}>
          <div className="accumul8-panel accumul8-panel--viewport-fill">
            <Accumul8SpreadsheetView {...spreadsheetViewProps} />
          </div>
        </React.Suspense>
      ) : null}
      {tab === 'debtors' ? <Accumul8DebtorsTab {...debtorsTabProps} /> : null}
      {tab === 'pay_bills' ? <Accumul8PayBillsTab {...payBillsTabProps} /> : null}
      {tab === 'contacts' ? <Accumul8ContactsTab {...contactsTabProps} /> : null}
      {tab === 'entity_endex' ? <Accumul8EntityEndexTab {...entityEndexTabProps} /> : null}
      {tab === 'recurring' ? <Accumul8RecurringTab {...recurringTabProps} /> : null}
      {tab === 'notifications' ? <Accumul8NotificationsTab {...notificationsTabProps} /> : null}
      {tab === 'sync' ? <Accumul8SyncTab {...syncTabProps} /> : null}
      {tab === 'statements' ? (
        <React.Suspense fallback={ACCUMUL8_TAB_LOADING_FALLBACK}>
          <div className="accumul8-panel accumul8-panel--viewport-fill">
            <Accumul8StatementsPanel {...statementsPanelProps} />
          </div>
        </React.Suspense>
      ) : null}
    </div>
  );
}
