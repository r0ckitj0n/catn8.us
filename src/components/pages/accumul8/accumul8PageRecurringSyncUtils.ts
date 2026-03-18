import {
  Accumul8Account,
  Accumul8Direction,
  Accumul8RecurringPayment,
  Accumul8TellerSyncAccountSummary,
  Accumul8Transaction,
} from '../../../types/accumul8';
import { getAccumul8AccountDisplayName } from '../../../utils/accumul8Accounts';

export function normalizeRecurringText(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeEntityAliasKey(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function recurringTextMatchScore(left: string | null | undefined, right: string | null | undefined): number {
  const leftText = normalizeRecurringText(left);
  const rightText = normalizeRecurringText(right);
  if (!leftText || !rightText) return 0;
  const leftKey = normalizeEntityAliasKey(leftText);
  const rightKey = normalizeEntityAliasKey(rightText);
  if (leftKey && rightKey && leftKey === rightKey) return 12;
  if (leftText === rightText) return 11;
  if (leftText.includes(rightText) || rightText.includes(leftText)) return 8;
  if (leftKey && rightKey && (leftKey.includes(rightKey) || rightKey.includes(leftKey))) return 7;
  const leftTokens = Array.from(new Set(leftText.split(/[^a-z0-9]+/i).filter((token) => token.length >= 3)));
  const rightTokens = Array.from(new Set(rightText.split(/[^a-z0-9]+/i).filter((token) => token.length >= 3)));
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;
  let shared = 0;
  leftTokens.forEach((leftToken) => {
    if (rightTokens.some((rightToken) => rightToken === leftToken || (leftToken.length >= 5 && rightToken.length >= 5 && (leftToken.startsWith(rightToken) || rightToken.startsWith(leftToken))))) shared += 1;
  });
  const coverage = shared / Math.max(1, Math.min(leftTokens.length, rightTokens.length));
  if (coverage >= 1) return 8;
  if (coverage >= 0.5) return 5;
  if (coverage >= 0.34) return 3;
  return 0;
}

export function recurringAmountMatchScore(expectedAmount: number, actualAmount: number): number {
  const difference = Math.abs(Number(expectedAmount || 0) - Number(actualAmount || 0));
  if (difference <= 0.01) return 10;
  if (difference <= 1.0) return 8;
  const maxMagnitude = Math.max(Math.abs(expectedAmount), Math.abs(actualAmount));
  const relativeDifference = maxMagnitude > 0.009 ? (difference / maxMagnitude) : 0;
  if (difference <= 5.0 && relativeDifference <= 0.05) return 6;
  if (difference <= 25.0 && relativeDifference <= 0.1) return 4;
  return -1;
}

export function findRecurringRuleForTransactionMapping(transaction: Accumul8Transaction, recurringPayments: Accumul8RecurringPayment[], targetEntityId: number): Accumul8RecurringPayment | null {
  if (Number(transaction.recurring_payment_id || 0) > 0) return recurringPayments.find((item) => item.id === Number(transaction.recurring_payment_id)) || null;
  const transactionAmount = Number(transaction.amount || 0);
  const transactionDirection: Accumul8Direction = transactionAmount >= 0 ? 'inflow' : 'outflow';
  const transactionDescription = String(transaction.description || '').trim();
  const scored = recurringPayments.map((recurring) => {
    if (Number(recurring.is_active || 0) !== 1 || (recurring.direction || 'outflow') !== transactionDirection) return { recurring, score: Number.NEGATIVE_INFINITY };
    if (Number(transaction.account_id || 0) > 0 && Number(recurring.account_id || 0) > 0 && Number(recurring.account_id) !== Number(transaction.account_id)) return { recurring, score: Number.NEGATIVE_INFINITY };
    if (Number(recurring.entity_id || 0) > 0 && Number(recurring.entity_id) !== targetEntityId) return { recurring, score: Number.NEGATIVE_INFINITY };
    const amountScore = recurringAmountMatchScore(Math.abs(transactionAmount), Math.abs(Number(recurring.amount || 0)));
    if (amountScore < 0) return { recurring, score: Number.NEGATIVE_INFINITY };
    const textCandidates = [recurring.title, recurring.entity_name, recurring.contact_name, ...(recurring.recurring_bank_aliases || [])];
    const bestTextScore = textCandidates.reduce((best, candidate) => Math.max(best, recurringTextMatchScore(transactionDescription, candidate)), 0);
    if (bestTextScore < 5) return { recurring, score: Number.NEGATIVE_INFINITY };
    let score = amountScore + bestTextScore;
    if (Number(recurring.account_id || 0) > 0 && Number(recurring.account_id) === Number(transaction.account_id || 0)) score += 5;
    if (Number(recurring.entity_id || 0) === targetEntityId) score += 5;
    if (normalizeEntityAliasKey(recurring.title) === normalizeEntityAliasKey(transactionDescription)) score += 4;
    return { recurring, score };
  }).filter((item) => Number.isFinite(item.score));
  scored.sort((left, right) => right.score - left.score);
  const best = scored[0] || null;
  const runnerUp = scored[1] || null;
  if (!best || best.score < 14 || (runnerUp && (best.score - runnerUp.score) < 3)) return null;
  return best.recurring;
}

export function formatSyncConnectionStatus(status: string): string {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'connected') return 'Connected';
  if (normalized === 'setup_pending') return 'Setup Pending';
  if (normalized === 'sync_error') return 'Sync Error';
  if (normalized === '') return 'Unknown';
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

export function isTellerRateLimited(message: string): boolean {
  const normalized = String(message || '').trim().toLowerCase();
  return normalized.includes('too_many_requests') || normalized.includes('request rate limit exceeded') || normalized.includes('http 429') || normalized.includes('status of 429');
}

export function formatSyncStatusLabel(status: string, lastError: string): string {
  if (isTellerRateLimited(lastError)) return 'Wait And Retry';
  return formatSyncConnectionStatus(status);
}

export function formatSyncStatusMessage(lastError: string): string {
  if (!String(lastError || '').trim()) return '';
  if (isTellerRateLimited(lastError)) return 'Teller asked us to pause before the next sync. Give it a little time, then retry.';
  return String(lastError);
}

export function formatAccountMappingLabel(account: Accumul8Account): string {
  return [getAccumul8AccountDisplayName(account), account.account_subtype || account.account_type || '', account.mask_last4 ? `...${account.mask_last4}` : (account.account_number_mask || '')].filter(Boolean).join(' | ');
}

export function formatSyncSummaryAccountLabel(account: Accumul8TellerSyncAccountSummary): string {
  return [account.remote_account_name || 'Unnamed account', account.remote_account_subtype || account.remote_account_type || '', account.mask_last4 ? `...${account.mask_last4}` : ''].filter(Boolean).join(' | ');
}

export function formatTellerCoverageLabel(startDate: string, endDate: string): string {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (endDate) return `through ${endDate}`;
  if (startDate) return `starting ${startDate}`;
  return 'No Teller history saved yet';
}

export function formatAccountBackfillNote(account: Accumul8Account): string {
  const coverage = formatTellerCoverageLabel(account.teller_history_start_date, account.teller_history_end_date);
  if (account.teller_backfill_complete) return `Backfill complete. Coverage: ${coverage}.`;
  if (account.teller_backfill_cursor_id || account.teller_history_start_date || account.teller_history_end_date) return `Backfill in progress. Coverage so far: ${coverage}.`;
  if (account.teller_sync_anchor_date) return `Recent sync checkpoint saved at ${account.teller_sync_anchor_date}. Historical backfill starts on the next sync.`;
  return 'Waiting for first Teller sync.';
}

export function formatSyncSummaryBackfillNote(account: Accumul8TellerSyncAccountSummary): string {
  if (!account.transactions_supported) return account.sync_skipped_reason || 'Teller did not expose transaction access for this account.';
  const coverage = formatTellerCoverageLabel(account.history_start_date, account.history_end_date);
  if (account.backfill_complete) return `Backfill complete. Coverage: ${coverage}.`;
  if (account.backfill_pages_fetched > 0) return `Backfill in progress. Coverage so far: ${coverage}. Pulled ${account.backfill_pages_fetched} older page${account.backfill_pages_fetched === 1 ? '' : 's'} this sync and will resume next time.`;
  return `Backfill not finished yet. Recent refresh window: ${account.recent_window_start_date} to ${account.recent_window_end_date}. Coverage so far: ${coverage}.`;
}

export function isTellerEligibilityFailure(message: string): boolean {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('suitable account') || normalized.includes('suitable accounts') || normalized.includes('unable to link your account') || normalized.includes('unable to link account');
}

export function formatTellerConnectError(message: string, institutionName: string): string {
  if (!isTellerEligibilityFailure(message)) return message;
  const label = institutionName.trim() || 'this bank';
  return `${label} connected through Teller, but Teller says none of the accounts under this login are eligible for Accumul8 sync. Try another ${label} login/account, or use the Bank Statements tab to import statements instead.`;
}
