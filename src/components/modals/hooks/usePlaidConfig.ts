import React from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { catn8LocalStorageGet, catn8LocalStorageSet } from '../../../utils/storageUtils';
import { formatTestResult } from '../../../utils/textUtils';
import { IToast } from '../../../types/common';
import {
  IPlaidSettingsDeleteRequest,
  IPlaidSettingsGetResponse,
  IPlaidSettingsMutationResponse,
  IPlaidSettingsSaveRequest,
  IPlaidSettingsTestRequest,
  IPlaidSettingsTestResponse,
} from '../../../types/plaidSettings';
import { defaultFormState, defaultStatusState, LS_PLAID_TEST, mapPlaidFormState, mapPlaidStatusState, PlaidFormState, PlaidStatusState } from './plaidConfigUtils';

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
      const next = mapPlaidFormState(res?.config);
      setForm(next);
      setStatus(mapPlaidStatusState(res?.status));
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

  const isDirty = React.useMemo(() => JSON.stringify(form) !== String(cleanFormRef.current || ''), [form]);

  const persistCurrentSettings = React.useCallback(async () => {
    const req: IPlaidSettingsSaveRequest = {
      env: form.env,
      client_id: form.client_id,
      secret: form.secret,
      products: form.products,
      country_codes: form.country_codes,
      redirect_uri: form.redirect_uri,
    };
    const res = await ApiClient.post<IPlaidSettingsMutationResponse>('/api/settings/plaid.php?action=save', req);
    const next = mapPlaidFormState(res?.config, form.env);
    setForm(next);
    const nextStatus = mapPlaidStatusState(res?.status);
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
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.post<IPlaidSettingsMutationResponse>('/api/settings/plaid.php?action=delete', { field });
      const next = mapPlaidFormState(res?.config, form.env);
      setForm(next);
      setStatus(mapPlaidStatusState(res?.status));
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
    test,
    removeCredential,
  };
}
