import {
  Accumul8Account,
  Accumul8Entity,
  Accumul8RecurringPayment,
  Accumul8Transaction,
  Accumul8TransactionUpsertRequest,
} from '../../types/accumul8';
import { Accumul8SpreadsheetMonthRow, Accumul8SpreadsheetMonthSummary } from '../../utils/accumul8Spreadsheet';

export interface Accumul8SpreadsheetViewProps {
  busy: boolean;
  selectedMonth: string;
  recurringPayments: Accumul8RecurringPayment[];
  transactions: Accumul8Transaction[];
  entities: Accumul8Entity[];
  accounts: Accumul8Account[];
  onSelectedMonthChange: (monthValue: string) => void;
  onEnsureBudgetMonth: (monthValue: string) => Promise<void>;
  onUpdateTransaction: (id: number, form: Accumul8TransactionUpsertRequest) => Promise<void>;
  onDeleteRecurring: (id: number, description: string) => void;
  onOpenRecurring: (id: number) => void;
}

export interface EditableSpreadsheetRow extends Accumul8SpreadsheetMonthRow {
  original_due_date: string;
  balance: number;
  vendor_input: string;
}

export interface EditableSpreadsheetMonthPanel {
  monthLabel: string;
  monthValue: string;
  rows: EditableSpreadsheetRow[];
  summary: Accumul8SpreadsheetMonthSummary;
}
