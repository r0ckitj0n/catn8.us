import React from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { openPlaidLink } from '../../../core/plaidLink';
import { catn8LocalStorageGet, catn8LocalStorageSet } from '../../../utils/storageUtils';
import { formatTestResult } from '../../../utils/textUtils';
import { IToast } from '../../../types/common';
import {
  Accumul8PlaidCreateLinkTokenResponse,
  Accumul8PlaidExchangeResponse,
  Accumul8PlaidSyncResponse,
} from '../../../types/accumul8';
import {
  IPlaidSettingsDeleteRequest,
  IPlaidSettingsGetResponse,
  IPlaidSettingsMutationResponse,
  IPlaidSettingsSaveRequest,
  IPlaidSettingsTestRequest,
  IPlaidSettingsTestResponse,
  PlaidEnvironment,
} from '../../../types/plaidSettings';

const LS_PLAID_TEST = 'catn8.last_test.settings.plaid';

interface PlaidFormState {
  env: PlaidEnvironment;
  client_id: string;
  secret: string;
}

interface PlaidStatusState {
  has_client_id: boolean;
  has_secret: boolean;
}

const defaultFormState: PlaidFormState = {
  env: 'sandbox',
  client_id: '',
  secret: '',
};

const defaultStatusState: PlaidStatusState = {
  has_client_id: false,
  has_secret: false,
};

export function usePlaidConfig(open: boolean, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [form, setForm] = React.useState<PlaidFormState>(defaultFormState);
  const [status, setStatus] = React.useState<PlaidStatusState>(defaultStatusState);
  const [lastPlaidTest, setLastPlaidTest] = React.useState('');
  const [source, setSource] = React.useState('secret_store');
  const cleanFormRef = React.useRef('');

  const load = React.useCallback(async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.get<IPlaidSettingsGetResponse>('/api/settings/plaid.php?action=get');
      const next: PlaidFormState = {
        env: (res?.config?.env || 'sandbox') as PlaidEnvironment,
        client_id: String(res?.config?.client_id || ''),
        secret: '',
      };
      setForm(next);
      setStatus({
        has_client_id: Boolean(res?.status?.has_client_id),
        has_secret: Boolean(res?.status?.has_secret),
      });
      setSource(String(res?.source || 'secret_store'));
      cleanFormRef.current = JSON.stringify({ ...next, secret: '' });
    } catch (e: any) {
      setError(e?.message || 'Failed to load Plaid settings');
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setLastPlaidTest(catn8LocalStorageGet(LS_PLAID_TEST));
    void load();
  }, [open, load]);

  const isDirty = React.useMemo(() => {
    const current = JSON.stringify(form);
    return current !== String(cleanFormRef.current || '');
  }, [form]);

  const persistCurrentSettings = React.useCallback(async () => {
    const req: IPlaidSettingsSaveRequest = {
      env: form.env,
      client_id: form.client_id,
      secret: form.secret,
    };
    const res = await ApiClient.post<IPlaidSettingsMutationResponse>('/api/settings/plaid.php?action=save', req);
    const next: PlaidFormState = {
      env: (res?.config?.env || form.env) as PlaidEnvironment,
      client_id: String(res?.config?.client_id || ''),
      secret: '',
    };
    setForm(next);
    const nextStatus = {
      has_client_id: Boolean(res?.status?.has_client_id),
      has_secret: Boolean(res?.status?.has_secret),
    };
    setStatus(nextStatus);
    cleanFormRef.current = JSON.stringify(next);
    return {
      message: String(res?.message || 'Saved Plaid settings'),
      status: nextStatus,
    };
  }, [form]);

  const save = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await persistCurrentSettings();
      setMessage(result.message);
    } catch (err: any) {
      setError(err?.message || 'Failed to save Plaid settings');
    } finally {
      setBusy(false);
    }
  };

  const removeCredential = async (field: IPlaidSettingsDeleteRequest['field']) => {
    if (field !== 'client_id' && field !== 'secret' && field !== 'all') return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.post<IPlaidSettingsMutationResponse>('/api/settings/plaid.php?action=delete', { field });
      const next: PlaidFormState = {
        env: (res?.config?.env || form.env) as PlaidEnvironment,
        client_id: String(res?.config?.client_id || ''),
        secret: '',
      };
      setForm(next);
      setStatus({
        has_client_id: Boolean(res?.status?.has_client_id),
        has_secret: Boolean(res?.status?.has_secret),
      });
      cleanFormRef.current = JSON.stringify(next);
      setMessage(String(res?.message || 'Credential deleted'));
    } catch (err: any) {
      setError(err?.message || 'Failed to delete credential');
    } finally {
      setBusy(false);
    }
  };

  const test = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    setLastPlaidTest('Running...');
    try {
      const req: IPlaidSettingsTestRequest = {
        env: form.env,
        client_id: form.client_id,
        secret: form.secret,
      };
      const res = await ApiClient.post<IPlaidSettingsTestResponse>('/api/settings/plaid.php?action=test', req);
      const text = String(res?.message || 'Plaid test passed');
      const next = formatTestResult('success', text);
      setLastPlaidTest(next);
      catn8LocalStorageSet(LS_PLAID_TEST, next);
      setMessage(text);
      await load();
    } catch (err: any) {
      const text = String(err?.message || 'Plaid test failed');
      const next = formatTestResult('failure', text);
      setLastPlaidTest(next);
      catn8LocalStorageSet(LS_PLAID_TEST, next);
      setError(text);
    } finally {
      setBusy(false);
    }
  };

  const connectBank = async () => {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      let effectiveStatus = status;
      if (isDirty) {
        const saveResult = await persistCurrentSettings();
        effectiveStatus = saveResult.status;
      }

      if (!effectiveStatus.has_client_id || !effectiveStatus.has_secret) {
        throw new Error('Plaid credentials are missing. Save Client ID and Secret first.');
      }

      const tokenRes = await ApiClient.post<Accumul8PlaidCreateLinkTokenResponse>('/api/accumul8.php?action=plaid_create_link_token', { client_name: 'Accumul8' });
      const token = String(tokenRes?.link_token || '');
      if (!token) {
        throw new Error('No link token returned');
      }

      const linkResult = await openPlaidLink(token);
      if (linkResult.outcome === 'cancelled') {
        setMessage('Plaid Link was closed before connecting an account.');
        return;
      }

      const institutionId = String(linkResult.metadata?.institution?.institution_id || '');
      const institutionName = String(linkResult.metadata?.institution?.name || '');
      const exchangeRes = await ApiClient.post<Accumul8PlaidExchangeResponse>('/api/accumul8.php?action=plaid_exchange_public_token', {
        public_token: String(linkResult.publicToken || ''),
        institution_id: institutionId,
        institution_name: institutionName,
      });
      const connectionId = Number(exchangeRes?.connection_id || 0);
      if (connectionId <= 0) {
        throw new Error('Plaid exchange did not return a valid connection id');
      }

      const syncRes = await ApiClient.post<Accumul8PlaidSyncResponse>('/api/accumul8.php?action=plaid_sync_transactions', {
        connection_id: connectionId,
      });
      const added = Number(syncRes?.added || 0);
      const modified = Number(syncRes?.modified || 0);
      const removed = Number(syncRes?.removed || 0);
      setMessage(`Plaid connected and synced (${added} added, ${modified} modified, ${removed} removed).`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to connect bank via Plaid');
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    if (!error || !onToast) return;
    onToast({ tone: 'error', message: error });
    setError('');
  }, [error, onToast]);

  React.useEffect(() => {
    if (!message || !onToast) return;
    onToast({ tone: 'success', message });
    setMessage('');
  }, [message, onToast]);

  return {
    busy,
    form,
    setForm,
    status,
    source,
    isDirty,
    lastPlaidTest,
    load,
    save,
    removeCredential,
    test,
    connectBank,
  };
}
