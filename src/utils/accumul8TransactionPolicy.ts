import { Accumul8Transaction } from '../types/accumul8';

export interface Accumul8TransactionEditPolicy {
  sourceKind: string;
  sourceLabel: string;
  isImported: boolean;
  canEditCoreFields: boolean;
  canEditPaidState: boolean;
  canEditBudgetPlanner: boolean;
  canDelete: boolean;
}

export function normalizeAccumul8TransactionSourceKind(sourceKind: string | null | undefined): string {
  return String(sourceKind || '').trim().toLowerCase() || 'manual';
}

export function getAccumul8TransactionSourceLabel(sourceKind: string | null | undefined): string {
  const normalized = normalizeAccumul8TransactionSourceKind(sourceKind);
  if (normalized === 'statement_upload' || normalized === 'statement_pdf') {
    return 'Bank Statement';
  }
  if (normalized === 'plaid') {
    return 'Bank Sync';
  }
  if (normalized === 'recurring') {
    return 'Scheduled / Recurring';
  }
  return 'Manual';
}

export function getAccumul8TransactionEditPolicy(
  transaction: Pick<Accumul8Transaction, 'source_kind'> | null | undefined,
): Accumul8TransactionEditPolicy {
  const sourceKind = normalizeAccumul8TransactionSourceKind(transaction?.source_kind);
  const isImported = sourceKind === 'statement_upload' || sourceKind === 'statement_pdf' || sourceKind === 'plaid';

  if (isImported) {
    const canDeleteImported = sourceKind === 'statement_upload' || sourceKind === 'statement_pdf';
    return {
      sourceKind,
      sourceLabel: getAccumul8TransactionSourceLabel(sourceKind),
      isImported: true,
      canEditCoreFields: false,
      canEditPaidState: false,
      canEditBudgetPlanner: false,
      canDelete: canDeleteImported,
    };
  }

  return {
    sourceKind,
    sourceLabel: getAccumul8TransactionSourceLabel(sourceKind),
    isImported: false,
    canEditCoreFields: true,
    canEditPaidState: true,
    canEditBudgetPlanner: true,
    canDelete: true,
  };
}
