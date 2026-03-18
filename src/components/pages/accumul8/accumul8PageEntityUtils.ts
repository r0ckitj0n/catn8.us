import {
  Accumul8Account,
  Accumul8ContactType,
  Accumul8Debtor,
  Accumul8Entity,
  Accumul8EntityEndexGuide,
  Accumul8Transaction,
} from '../../../types/accumul8';
import { formatInlineDate, formatInlineText } from './accumul8PageDateSearchUtils';

export type EntityTransactionSummary = {
  count: number;
  lastAmount: number | null;
  lastDate: string;
};

export function normalizeDebtorGroupKey(value: string | null | undefined): string {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isIouAccount(account: Pick<Accumul8Account, 'account_type' | 'account_name'>): boolean {
  const accountType = String(account.account_type || '').trim().toLowerCase();
  const accountName = String(account.account_name || '').trim().toLowerCase();
  return accountType.includes('iou') || /\biou\b/.test(accountName);
}

export function getActiveFilterClass(baseClassName: string, isActive: boolean): string {
  return isActive ? `${baseClassName} accumul8-filter-control--active` : baseClassName;
}

export function isLaunchableHttpUrl(value: string | null | undefined): boolean {
  return /^https?:\/\//i.test(String(value || '').trim());
}

export function getLedgerDescriptionLabel(
  transaction: Pick<Accumul8Transaction, 'description' | 'entity_name'>,
  draft?: Pick<Partial<Accumul8Transaction>, 'description' | 'entity_name'>,
): string {
  const entityName = String(draft?.entity_name ?? transaction.entity_name ?? '').trim();
  const fallbackDescription = String(draft?.description ?? transaction.description ?? '').trim();
  return formatInlineText(entityName || fallbackDescription, '-');
}

export function isOpeningBalanceTransaction(transaction: Accumul8Transaction): boolean {
  const normalizedDescription = String(transaction.description || '').trim().toLowerCase();
  const normalizedMemo = String(transaction.memo || '').trim().toLowerCase();
  return normalizedDescription === 'opening balance' && (normalizedMemo === '' || normalizedMemo.includes('opening balance'));
}

export function normalizeEntityAliasKey(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function toEntityEndexGuideKey(guide: Pick<Accumul8EntityEndexGuide, 'parent_name'>): string {
  return normalizeEntityAliasKey(guide.parent_name);
}

export function normalizeEntityContactType(entity: Pick<Accumul8Entity, 'contact_type' | 'is_payee' | 'is_payer' | 'is_balance_person'>): Accumul8ContactType {
  const raw = String(entity.contact_type || '').trim().toLowerCase();
  if (raw === 'repayment' || Number(entity.is_balance_person || 0) === 1) return 'repayment';
  if (raw === 'payer' || (Number(entity.is_payer || 0) === 1 && Number(entity.is_payee || 0) === 0)) return 'payer';
  return 'payee';
}

export function inferEntityContactTypeForAmount(amount: number): Accumul8ContactType {
  return amount > 0 ? 'payer' : 'payee';
}

export function uniqueTextValues(values: Array<string | null | undefined>, normalize: (value: string) => string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const display = String(value || '').trim();
    const key = normalize(display);
    if (!display || !key || seen.has(key)) return;
    seen.add(key);
    result.push(display);
  });
  return result;
}

export function buildEntityGuideRule(description: string, entityName: string): string {
  const normalizedDescription = String(description || '').trim();
  const normalizedEntityName = String(entityName || '').trim();
  if (!normalizedDescription || !normalizedEntityName) return 'Contains approved entity-name variants';
  return `Contains approved variants of "${normalizedEntityName}" based on "${normalizedDescription}"`;
}

export function normalizeEntityKind(value: string | null | undefined, isVendor = 0): 'business' | 'contact' {
  return String(value || '').trim().toLowerCase() === 'business' || Number(isVendor || 0) === 1 ? 'business' : 'contact';
}

export function formatEntityTypeLabel(contactType: Accumul8ContactType): string {
  if (contactType === 'repayment') return 'Repayment';
  return contactType === 'payer' ? 'Payer' : 'Payee';
}

export function formatEntityRoles(entity: Pick<Accumul8Entity, 'contact_type' | 'entity_kind' | 'is_payee' | 'is_payer' | 'is_vendor' | 'is_balance_person'>): string {
  const roles: string[] = [formatEntityTypeLabel(normalizeEntityContactType(entity))];
  if (normalizeEntityKind(entity.entity_kind, entity.is_vendor) === 'business') roles.push('Business');
  return roles.join(' • ') || 'Unassigned';
}

export function formatEntityContactSummary(entity: Pick<Accumul8Entity, 'phone_number' | 'email' | 'street_address' | 'city' | 'state' | 'zip'>): string[] {
  const lines: string[] = [];
  const primary = [entity.phone_number || '', entity.email || ''].filter(Boolean).join(' | ');
  if (primary) lines.push(primary);
  if (entity.street_address) lines.push(entity.street_address);
  const locality = [entity.city || '', entity.state || '', entity.zip || ''].filter(Boolean).join(', ');
  if (locality) lines.push(locality);
  return lines;
}

export function formatEntityTransactionSummaryLabel(summary: EntityTransactionSummary): string {
  if (!summary.lastDate) return `${summary.count} tx`;
  const amountLabel = summary.lastAmount === null ? '-' : Number(summary.lastAmount || 0).toFixed(2);
  return `${amountLabel} ${formatInlineDate(summary.lastDate)} ${summary.count} tx`;
}

export type Accumul8DebtorGroupRow = Accumul8Debtor & {
  group_key: string;
  member_ids: number[];
  has_duplicate_members: boolean;
};
