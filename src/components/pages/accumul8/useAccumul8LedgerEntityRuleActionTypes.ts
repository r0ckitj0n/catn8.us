import React from 'react';

import {
  Accumul8Entity,
  Accumul8EntityAlias,
  Accumul8EntityEndexGuide,
  Accumul8RecurringPayment,
  Accumul8Transaction,
} from '../../../types/accumul8';

export interface UseAccumul8LedgerEntityRuleActionsOptions {
  accumul8ActionUrl: (action: string) => string;
  closeLedgerEntityModal: () => void;
  entities: Accumul8Entity[];
  entityAliases: Accumul8EntityAlias[];
  entityEndexGuides: Accumul8EntityEndexGuide[];
  ledgerEntityModalTransactionId: number | null;
  load: () => Promise<unknown>;
  onToast?: (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  recurringPayments: Accumul8RecurringPayment[];
  setLedgerEntityModalSaving: React.Dispatch<React.SetStateAction<boolean>>;
  transactions: Accumul8Transaction[];
}
