import { Accumul8EntryType } from '../../types/accumul8';

export interface Accumul8TransactionModalFormState {
  transaction_date: string;
  due_date: string;
  paid_date: string;
  entry_type: Accumul8EntryType;
  description: string;
  memo: string;
  amount: number;
  rta_amount: number;
  is_paid: number;
  is_reconciled: number;
  is_budget_planner: number;
  entity_id: string;
  account_id: string;
  balance_entity_id: string;
  debtor_id: string;
}

export type Accumul8IouDirection = 'charge' | 'credit';
