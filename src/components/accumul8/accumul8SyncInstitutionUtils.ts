import { Accumul8BankConnection, Accumul8BankConnectionUpsertRequest } from '../../types/accumul8';
import { SyncInstitutionFormState } from './Accumul8SyncInstitutionEditor';

export const DEFAULT_SYNC_INSTITUTION_FORM: SyncInstitutionFormState = {
  provider_name: 'teller',
  institution_id: '',
  institution_name: '',
  teller_enrollment_id: '',
  teller_user_id: '',
  status: 'setup_pending',
};

export const SYNC_INSTITUTION_STATUS_OPTIONS = [
  { value: 'setup_pending', label: 'Setup Pending' },
  { value: 'connected', label: 'Connected' },
  { value: 'sync_error', label: 'Sync Error' },
  { value: 'paused', label: 'Paused' },
];

export function toSyncInstitutionFormState(connection?: Accumul8BankConnection | null): SyncInstitutionFormState {
  if (!connection) {
    return DEFAULT_SYNC_INSTITUTION_FORM;
  }
  return {
    provider_name: String(connection.provider_name || 'teller'),
    institution_id: String(connection.institution_id || ''),
    institution_name: String(connection.institution_name || ''),
    teller_enrollment_id: String(connection.teller_enrollment_id || ''),
    teller_user_id: String(connection.teller_user_id || ''),
    status: String(connection.status || 'setup_pending'),
  };
}

export function toSyncInstitutionPayload(form: SyncInstitutionFormState): Accumul8BankConnectionUpsertRequest {
  return {
    provider_name: form.provider_name,
    institution_id: form.institution_id.trim() || undefined,
    institution_name: form.institution_name.trim() || undefined,
    teller_enrollment_id: form.teller_enrollment_id.trim() || undefined,
    teller_user_id: form.teller_user_id.trim() || undefined,
    status: form.status.trim() || undefined,
  };
}
