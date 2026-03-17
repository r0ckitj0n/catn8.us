import type { Accumul8RecurringLedgerSyncResponse } from './accumul8-core';

export interface Accumul8AIcountantConversation {
  id: number;
  owner_user_id: number;
  title: string;
  system_prompt: string;
  status: string;
  conversation_summary: string;
  last_message_preview: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface Accumul8AIcountantMessage {
  id: number;
  conversation_id: number;
  owner_user_id: number;
  role: 'user' | 'assistant' | 'system';
  content_text: string;
  provider: string;
  model: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface Accumul8AIcountantConversationResponse {
  success: boolean;
  conversation: Accumul8AIcountantConversation;
  messages: Accumul8AIcountantMessage[];
}

export interface Accumul8AIcountantListResponse {
  success: boolean;
  conversations: Accumul8AIcountantConversation[];
  default_system_prompt: string;
  suggested_starters: string[];
}

export interface Accumul8MessageBoardMessage {
  id: number;
  owner_user_id: number;
  actor_user_id: number;
  source_kind: string;
  message_level: string;
  title: string;
  body_text: string;
  meta: Record<string, unknown>;
  is_acknowledged: number;
  acknowledged_at: string;
  duplicate_count: number;
  created_at: string;
}

export interface Accumul8MessageBoardResponse {
  success: boolean;
  messages: Accumul8MessageBoardMessage[];
  unacknowledged_count: number;
}

export interface Accumul8BalanceBooksResponseCore {
  synced_connection_count: number;
  skipped_connection_count: number;
  error_connection_count: number;
  opening_balance_reconciliation: Accumul8OpeningBalanceReconciliationResponseCore;
}

export interface Accumul8BalanceBooksResponse extends Accumul8BalanceBooksResponseCore {
  success: boolean;
  messages: Accumul8MessageBoardMessage[];
  unacknowledged_count: number;
}

export interface Accumul8OpeningBalanceReconciliationResult {
  account_id: number;
  account_name: string;
  prior_ledger_balance: number;
  bank_balance: number;
  adjustment_amount: number;
  transaction_id: number;
  transaction_date: string;
  action: 'created' | 'updated';
}

export interface Accumul8OpeningBalanceReviewItem {
  account_id: number;
  account_name: string;
  reason: string;
}

export interface Accumul8OpeningBalanceReconciliationResponseCore {
  reconciled_count: number;
  skipped_count: number;
  review_needed_count: number;
  review_needed_accounts: Accumul8OpeningBalanceReviewItem[];
  results: Accumul8OpeningBalanceReconciliationResult[];
}

export interface Accumul8OpeningBalanceReconciliationResponse extends Accumul8OpeningBalanceReconciliationResponseCore {
  success: boolean;
  messages: Accumul8MessageBoardMessage[];
  unacknowledged_count: number;
}

export interface Accumul8AIcountantWatchlistResponseCore {
  summary_title: string;
  summary_body: string;
  overdue_count: number;
  due_soon_count: number;
  recurring_soon_count: number;
  sent_email_count: number;
  failed_email_count: number;
  notification_rule_id: number | null;
}

export interface Accumul8AIcountantWatchlistResponse extends Accumul8AIcountantWatchlistResponseCore {
  success: boolean;
  messages: Accumul8MessageBoardMessage[];
  unacknowledged_count: number;
}

export interface Accumul8AIcountantHousekeepingResponse {
  success: boolean;
  ledger_sync: Accumul8RecurringLedgerSyncResponse;
  balance_books: Accumul8BalanceBooksResponseCore;
  opening_balance_reconciliation: Accumul8OpeningBalanceReconciliationResponseCore;
  watchlist: Accumul8AIcountantWatchlistResponseCore;
  attention_needed: number;
  messages: Accumul8MessageBoardMessage[];
  unacknowledged_count: number;
}
