import { Accumul8StatementUpload } from '../../types/accumul8';
import { Accumul8StatementNewAccountDraft } from './Accumul8StatementPlanCard';

export function formatStatementFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function formatStatementDateRange(upload: Accumul8StatementUpload): string {
  if (upload.period_start && upload.period_end) return `${upload.period_start} to ${upload.period_end}`;
  if (upload.period_end) return `Ending ${upload.period_end}`;
  return 'Period not detected';
}

export function createStatementNewAccountDraft(upload: Accumul8StatementUpload): Accumul8StatementNewAccountDraft {
  return {
    banking_organization_name: upload.banking_organization_name || upload.plan?.institution_name || '',
    account_name: upload.plan?.suggested_new_account.account_name || upload.account_name_hint || '',
    account_type: upload.plan?.suggested_new_account.account_type || 'checking',
    institution_name: upload.plan?.suggested_new_account.institution_name || upload.institution_name || '',
    mask_last4: upload.plan?.suggested_new_account.mask_last4 || upload.account_mask_last4 || '',
  };
}
