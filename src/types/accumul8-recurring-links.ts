import type { Accumul8Transaction } from './accumul8-core-base';

export interface Accumul8RecurringLinkRequest {
  recurring_id: number;
  transaction_id: number;
}

export interface Accumul8RecurringLinkResponse {
  success: boolean;
  recurring_id: number;
  linked_transaction_id: number;
  linked_history_count: number;
  history_count: number;
}

export interface Accumul8RecurringLinkHistoryResponse {
  success: boolean;
  recurring_id: number;
  history_count: number;
  transactions: Accumul8Transaction[];
}

export interface Accumul8RecurringLinkCandidatesResponse {
  success: boolean;
  recurring_id: number;
  transactions: Accumul8Transaction[];
}
