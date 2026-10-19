import React from 'react';

import { ApiClient } from '../../../core/ApiClient';
import { promptMfaStepUp } from '../../../core/mfaStepUp';
import { openPlaidLink } from '../../../core/plaidConnect';
import {
  Accumul8BankConnection,
  Accumul8TellerSyncResponse,
} from '../../../types/accumul8';
import {
  Accumul8PlaidExchangeResponse,
  Accumul8PlaidLinkTokenResponse,
} from '../../../types/accumul8-plaid';
import { AuthMfaChallengeResponse } from '../../../types/authMfa';

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

  const runTellerConnectFlow = React.useCallback(async (existingConnection?: Accumul8BankConnection | null, isRetry = false) => {
    if (!onToast) return;
    if (!syncProvider.configured) {
      onToast({ tone: 'info', message: 'Plaid not configured — add keys in Settings' });
      return;
    }
    const existingConnectionId = Number(existingConnection?.id || 0);
    const existingInstitutionName = String(existingConnection?.institution_name || existingConnection?.institution_id || '').trim();
    let connectedInstitutionName = existingInstitutionName;
    try {
      const tokenRes = await ApiClient.post<Accumul8PlaidLinkTokenResponse>(scopedActionUrl('plaid_link_token'), {
        existing_connection_id: existingConnectionId > 0 ? existingConnectionId : undefined,
      });
      const linkToken = String(tokenRes?.link_token || '');
      if (!linkToken) throw new Error('No Plaid link token returned');
      setSyncHelpError('');
      setSyncHelpToken(linkToken);
      const linkResult = await openPlaidLink(linkToken);
      if (linkResult.outcome === 'cancelled') {
        const exitMessage = existingConnectionId > 0
          ? `Plaid reconnect closed without finishing for ${existingInstitutionName || 'this institution'}.`
          : 'Plaid Link closed without linking an account.';
        onToast({ tone: 'info', message: exitMessage });
        return;
      }
      connectedInstitutionName = String(linkResult.payload.metadata?.institution?.name || existingInstitutionName || '');
      const institutionId = String(linkResult.payload.metadata?.institution?.institution_id || '');
      const exchangeRes = await ApiClient.post<Accumul8PlaidExchangeResponse>(scopedActionUrl('plaid_exchange_public_token'), {
        public_token: String(linkResult.payload.publicToken || ''),
        existing_connection_id: existingConnectionId > 0 ? existingConnectionId : undefined,
        institution_id: institutionId,
        institution_name: connectedInstitutionName,
        institution: {
          institution_id: institutionId,
          name: connectedInstitutionName,
        },
      });
      const connectionId = Number(exchangeRes?.connection_id || 0);
      if (connectionId <= 0) throw new Error('Plaid exchange did not return a valid connection id');
      const syncRes = await ApiClient.post<Accumul8TellerSyncResponse>(scopedActionUrl('sync_transactions'), { connection_id: connectionId });
      setLastSyncReport({
        connectionId,
        institutionName: connectedInstitutionName || 'Connected institution',
        syncedAt: new Date().toISOString(),
        result: syncRes,
      });
      const added = Number(syncRes?.added || 0);
      onToast({
        tone: 'success',
        message: existingConnectionId > 0
          ? `Reconnected ${connectedInstitutionName || 'bank connection'} via Plaid and synced (${added} transaction${added === 1 ? '' : 's'} imported).`
          : `Plaid connected and synced (${added} transaction${added === 1 ? '' : 's'} imported).`,
      });
      await load();
    } catch (error: any) {
      const payload = error?.payload as AuthMfaChallengeResponse | undefined;
      if (!isRetry && payload?.mfa_step_up_required) {
        const verified = await promptMfaStepUp(
          String(payload.email_masked || ''),
          'Connecting a bank needs a code from the last 12 hours, including on a trusted device.'
        );
        if (verified) {
          await runTellerConnectFlow(existingConnection, true);
          return;
        }
      }
      const message = String(error?.message || 'Failed to start Plaid Link');
      openSyncHelp({ error: message });
      onToast({ tone: 'error', message });
    }
  }, [load, onToast, openSyncHelp, scopedActionUrl, setLastSyncReport, setSyncHelpError, setSyncHelpToken, syncProvider.configured]);

  const runTellerConnect = React.useCallback(async () => {
    await runTellerConnectFlow(null);
  }, [runTellerConnectFlow]);

  const runTellerReconnect = React.useCallback(async (connection: Accumul8BankConnection) => {
    await runTellerConnectFlow(connection);
  }, [runTellerConnectFlow]);

  return { openStatementImportFallback, openSyncHelp, runConnectionSync, runTellerConnect, runTellerReconnect };
}
