import React from 'react';

import { ApiClient } from '../../../core/ApiClient';
import { openTellerConnect } from '../../../core/tellerConnect';
import { isWatchedTellerInstitution, logTellerDiagnostic } from '../../../core/tellerDiagnostics';
import {
  Accumul8TellerConnectTokenResponse,
  Accumul8TellerEnrollmentResponse,
  Accumul8TellerSyncResponse,
} from '../../../types/accumul8';
import { formatTellerConnectError, isTellerEligibilityFailure } from './accumul8PageRecurringSyncUtils';

interface UseAccumul8SyncActionsOptions {
  load: () => Promise<unknown>;
  onToast?: (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  scopedActionUrl: (action: string) => string;
  setLastSyncReport: React.Dispatch<React.SetStateAction<{
    connectionId: number;
    institutionName: string;
    syncedAt: string;
    result: Accumul8TellerSyncResponse;
  } | null>>;
  setSyncHelpError: React.Dispatch<React.SetStateAction<string>>;
  setSyncHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSyncHelpToken: React.Dispatch<React.SetStateAction<string>>;
  setSyncingConnectionId: React.Dispatch<React.SetStateAction<number | null>>;
  setTab: React.Dispatch<React.SetStateAction<'aicountant' | 'ledger' | 'calendar' | 'spreadsheet' | 'debtors' | 'pay_bills' | 'contacts' | 'entity_endex' | 'recurring' | 'notifications' | 'sync' | 'statements'>>;
  syncBankConnection: (connectionId: number) => Promise<Accumul8TellerSyncResponse | null | undefined>;
  syncProvider: { configured: boolean | number; env?: string | null };
}

export function useAccumul8SyncActions({
  load,
  onToast,
  scopedActionUrl,
  setLastSyncReport,
  setSyncHelpError,
  setSyncHelpOpen,
  setSyncHelpToken,
  setSyncingConnectionId,
  setTab,
  syncBankConnection,
  syncProvider,
}: UseAccumul8SyncActionsOptions) {
  const openSyncHelp = React.useCallback((opts?: { token?: string; error?: string }) => {
    setSyncHelpToken(String(opts?.token || ''));
    setSyncHelpError(String(opts?.error || ''));
    setSyncHelpOpen(true);
  }, [setSyncHelpError, setSyncHelpOpen, setSyncHelpToken]);

  const openStatementImportFallback = React.useCallback(() => {
    setSyncHelpOpen(false);
    setTab('statements');
  }, [setSyncHelpOpen, setTab]);

  const runConnectionSync = React.useCallback(async (connectionId: number, institutionName: string) => {
    setSyncingConnectionId(connectionId);
    try {
      const result = await syncBankConnection(connectionId);
      if (!result || !result.success) return;
      setLastSyncReport({ connectionId, institutionName, syncedAt: new Date().toISOString(), result });
    } finally {
      setSyncingConnectionId((current) => (current === connectionId ? null : current));
    }
  }, [setLastSyncReport, setSyncingConnectionId, syncBankConnection]);

  const runTellerConnect = React.useCallback(async () => {
    if (!onToast) return;
    if (!syncProvider.configured) {
      onToast({ tone: 'error', message: 'Teller is not configured. Save credentials in Settings first.' });
      return;
    }
    let connectedInstitutionName = '';
    let connectedInstitutionId = '';
    let connectedEnrollmentId = '';
    try {
      const tokenRes = await ApiClient.post<Accumul8TellerConnectTokenResponse>(scopedActionUrl('teller_connect_token'), {});
      const applicationId = String(tokenRes?.application_id || '');
      const environment = String(tokenRes?.environment || syncProvider.env || 'sandbox') as 'sandbox' | 'development' | 'production';
      if (!applicationId) throw new Error('No Teller application id returned');
      void logTellerDiagnostic({ source: 'accumul8-sync-page', event_name: 'open_requested', message: 'Teller Connect requested from Accumul8 sync page', meta: { environment, application_id_prefix: applicationId.slice(0, 12), select_account: 'disabled' } });
      setSyncHelpError('');
      setSyncHelpToken(applicationId);
      const linkResult = await openTellerConnect(applicationId, environment, {
        selectAccount: 'disabled',
        onEvent: (event) => {
          if (event.name === 'open') return;
          const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
          const detectedInstitutionId = String((payload as any)?.institution_id || '');
          const institutionId = String((payload as any)?.enrollment?.institution?.id || detectedInstitutionId || connectedInstitutionId || '');
          const institutionName = String((payload as any)?.enrollment?.institution?.name || connectedInstitutionName || '');
          const enrollmentId = String((payload as any)?.enrollment?.id || connectedEnrollmentId || '');
          const failureMessage = String((payload as any)?.message || (payload as any)?.code || '');
          void logTellerDiagnostic({ source: 'accumul8-sync-page', event_name: event.name === 'failure' ? 'failure' : event.name, institution_id: institutionId || undefined, institution_name: institutionName || undefined, enrollment_id: enrollmentId || undefined, message: failureMessage || `Teller Connect ${event.name}`, meta: { select_account: 'disabled', event_payload: payload, watched_institution: isWatchedTellerInstitution(institutionId, institutionName) ? 1 : 0 } });
        },
      });
      if (linkResult.outcome === 'cancelled') {
        const exitMessage = 'Teller Connect closed without linking an account. If Teller showed "no suitable accounts," that means the bank/login is not exposing any eligible accounts for sync right now. Use the Bank Statements tab as the fallback import path.';
        openSyncHelp({ error: exitMessage });
        onToast({ tone: 'info', message: exitMessage });
        return;
      }
      connectedInstitutionId = String(linkResult.payload?.enrollment?.institution?.id || '');
      connectedInstitutionName = String(linkResult.payload?.enrollment?.institution?.name || '');
      connectedEnrollmentId = String(linkResult.payload?.enrollment?.id || '');
      const exchangeRes = await ApiClient.post<Accumul8TellerEnrollmentResponse>(scopedActionUrl('teller_enroll'), {
        access_token: String(linkResult.payload?.accessToken || ''),
        enrollment_id: connectedEnrollmentId,
        user_id: String(linkResult.payload?.user?.id || ''),
        institution_id: connectedInstitutionId,
        institution_name: connectedInstitutionName,
      });
      const connectionId = Number(exchangeRes?.connection_id || 0);
      if (connectionId <= 0) throw new Error('Teller enrollment did not return a valid connection id');
      const syncRes = await ApiClient.post<Accumul8TellerSyncResponse>(scopedActionUrl('teller_sync_transactions'), { connection_id: connectionId });
      setLastSyncReport({ connectionId, institutionName: connectedInstitutionName || 'Connected institution', syncedAt: new Date().toISOString(), result: syncRes });
      const added = Number(syncRes?.added || 0);
      onToast({ tone: 'success', message: `Teller connected and synced (${added} transaction${added === 1 ? '' : 's'} imported).` });
      await load();
    } catch (error: any) {
      const rawMessage = String(error?.message || 'Failed to start Teller Connect');
      void logTellerDiagnostic({ source: 'accumul8-sync-page', event_name: connectedInstitutionId || connectedInstitutionName ? 'sync_error' : 'error', institution_id: connectedInstitutionId || undefined, institution_name: connectedInstitutionName || undefined, enrollment_id: connectedEnrollmentId || undefined, message: rawMessage, meta: { select_account: 'disabled', watched_institution: isWatchedTellerInstitution(connectedInstitutionId, connectedInstitutionName) ? 1 : 0 } });
      const message = formatTellerConnectError(rawMessage, connectedInstitutionName);
      openSyncHelp({ error: message });
      onToast({ tone: isTellerEligibilityFailure(rawMessage) ? 'warning' : 'error', message });
    }
  }, [load, onToast, openSyncHelp, scopedActionUrl, setLastSyncReport, setSyncHelpError, setSyncHelpToken, syncProvider.configured, syncProvider.env]);

  return { openStatementImportFallback, openSyncHelp, runConnectionSync, runTellerConnect };
}
