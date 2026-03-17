import { ApiClient } from '../../../core/ApiClient';
import { openTellerConnect } from '../../../core/tellerConnect';
import { isWatchedTellerInstitution, logTellerDiagnostic } from '../../../core/tellerDiagnostics';
import {
  Accumul8TellerConnectTokenResponse,
  Accumul8TellerEnrollmentResponse,
  Accumul8TellerSyncResponse,
} from '../../../types/accumul8';
import { TellerEnvironment } from '../../../types/tellerSettings';

type EffectiveTellerConfig = {
  status: {
    has_application_id: boolean;
    has_certificate: boolean;
    has_private_key: boolean;
  };
  applicationId: string;
  env: TellerEnvironment;
};

export async function connectTellerBank(
  effective: EffectiveTellerConfig,
  onComplete: () => Promise<void>,
): Promise<string> {
  if (!effective.status.has_application_id || !effective.status.has_certificate || !effective.status.has_private_key) {
    throw new Error('Teller application id, certificate, and private key are required before connecting.');
  }

  const tokenRes = await ApiClient.post<Accumul8TellerConnectTokenResponse>('/api/accumul8.php?action=teller_connect_token', {});
  const applicationId = String(tokenRes?.application_id || effective.applicationId || '');
  const environment = (String(tokenRes?.environment || effective.env || 'sandbox') || 'sandbox') as TellerEnvironment;
  if (applicationId === '') {
    throw new Error('No Teller application id is available');
  }

  let connectedInstitutionId = '';
  let connectedInstitutionName = '';
  let connectedEnrollmentId = '';

  void logTellerDiagnostic({
    source: 'teller-settings-modal',
    event_name: 'open_requested',
    message: 'Teller Connect requested from Teller settings modal',
    meta: {
      environment,
      application_id_prefix: applicationId.slice(0, 12),
      select_account: 'disabled',
    },
  });

  const connectResult = await openTellerConnect(applicationId, environment, {
    selectAccount: 'disabled',
    onEvent: (event) => {
      if (event.name === 'open') {
        return;
      }
      const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
      const detectedInstitutionId = String((payload as any)?.institution_id || '');
      const institutionId = String((payload as any)?.enrollment?.institution?.id || detectedInstitutionId || connectedInstitutionId || '');
      const institutionName = String((payload as any)?.enrollment?.institution?.name || connectedInstitutionName || '');
      const enrollmentId = String((payload as any)?.enrollment?.id || connectedEnrollmentId || '');
      const failureMessage = String((payload as any)?.message || (payload as any)?.code || '');
      void logTellerDiagnostic({
        source: 'teller-settings-modal',
        event_name: event.name === 'failure' ? 'failure' : event.name,
        institution_id: institutionId || undefined,
        institution_name: institutionName || undefined,
        enrollment_id: enrollmentId || undefined,
        message: failureMessage || `Teller Connect ${event.name}`,
        meta: {
          select_account: 'disabled',
          event_payload: payload,
          watched_institution: isWatchedTellerInstitution(institutionId, institutionName) ? 1 : 0,
        },
      });
    },
  });

  if (connectResult.outcome === 'cancelled') {
    return 'Teller Connect was closed before connecting an account.';
  }

  connectedInstitutionId = String(connectResult.payload?.enrollment?.institution?.id || '');
  connectedInstitutionName = String(connectResult.payload?.enrollment?.institution?.name || '');
  connectedEnrollmentId = String(connectResult.payload?.enrollment?.id || '');

  const exchangeRes = await ApiClient.post<Accumul8TellerEnrollmentResponse>('/api/accumul8.php?action=teller_enroll', {
    access_token: String(connectResult.payload?.accessToken || ''),
    enrollment_id: String(connectResult.payload?.enrollment?.id || ''),
    institution_id: String(connectResult.payload?.enrollment?.institution?.id || ''),
    institution_name: String(connectResult.payload?.enrollment?.institution?.name || ''),
    user_id: String(connectResult.payload?.user?.id || ''),
  });
  const connectionId = Number(exchangeRes?.connection_id || 0);
  if (connectionId <= 0) {
    throw new Error('Teller enrollment did not return a valid connection id');
  }

  void logTellerDiagnostic({
    source: 'teller-settings-modal',
    event_name: 'enroll_success',
    institution_id: connectedInstitutionId || undefined,
    institution_name: connectedInstitutionName || undefined,
    enrollment_id: connectedEnrollmentId || undefined,
    connection_id: connectionId,
    message: 'Teller enrollment persisted successfully',
    meta: {
      select_account: 'disabled',
      watched_institution: isWatchedTellerInstitution(connectedInstitutionId, connectedInstitutionName) ? 1 : 0,
    },
  });

  const syncRes = await ApiClient.post<Accumul8TellerSyncResponse>('/api/accumul8.php?action=teller_sync_transactions', {
    connection_id: connectionId,
  });

  void logTellerDiagnostic({
    source: 'teller-settings-modal',
    event_name: 'sync_success',
    institution_id: connectedInstitutionId || undefined,
    institution_name: connectedInstitutionName || undefined,
    enrollment_id: connectedEnrollmentId || undefined,
    connection_id: connectionId,
    message: 'Teller sync completed successfully',
    meta: {
      select_account: 'disabled',
      watched_institution: isWatchedTellerInstitution(connectedInstitutionId, connectedInstitutionName) ? 1 : 0,
      added: Number(syncRes?.added || 0),
      modified: Number(syncRes?.modified || 0),
      unchanged: Number(syncRes?.unchanged || 0),
      removed: Number(syncRes?.removed || 0),
      account_count: Array.isArray(syncRes?.accounts) ? syncRes.accounts.length : 0,
    },
  });

  await onComplete();

  const added = Number(syncRes?.added || 0);
  const modified = Number(syncRes?.modified || 0);
  const removed = Number(syncRes?.removed || 0);
  return `Teller connected and synced (${added} added, ${modified} modified, ${removed} removed).`;
}
