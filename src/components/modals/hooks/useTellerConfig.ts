import React from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { logTellerDiagnostic } from '../../../core/tellerDiagnostics';
import { catn8LocalStorageGet, catn8LocalStorageSet } from '../../../utils/storageUtils';
import { formatTestResult } from '../../../utils/textUtils';
import { IToast } from '../../../types/common';
import {
  ITellerSettingsDeleteRequest,
  ITellerSettingsGetResponse,
  ITellerSettingsMutationResponse,
  ITellerSettingsSaveRequest,
  ITellerSettingsTestRequest,
  ITellerSettingsTestResponse,
} from '../../../types/tellerSettings';
import { connectTellerBank } from './tellerConnectBank';
import { defaultFormState, defaultStatusState, LS_TELLER_TEST, mapTellerFormState, mapTellerStatusState, TellerFormState, TellerStatusState } from './tellerConfigUtils';

export function useTellerConfig(open: boolean, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [form, setForm] = React.useState<TellerFormState>(defaultFormState);
  const [status, setStatus] = React.useState<TellerStatusState>(defaultStatusState);
  const [lastTellerTest, setLastTellerTest] = React.useState('');
  const [source, setSource] = React.useState('secret_store');
  const cleanFormRef = React.useRef('');

  const load = React.useCallback(async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.get<ITellerSettingsGetResponse>('/api/settings/teller.php?action=get');
      const next = mapTellerFormState(res?.config);
      setForm(next);
      setStatus(mapTellerStatusState(res?.status));
      setSource(String(res?.source || 'secret_store'));
      cleanFormRef.current = JSON.stringify({ ...next, certificate: '', private_key: '' });
    } catch (e: any) {
      setError(e?.message || 'Failed to load Teller settings');
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setLastTellerTest(catn8LocalStorageGet(LS_TELLER_TEST));
    void load();
  }, [open, load]);

  const isDirty = React.useMemo(() => JSON.stringify(form) !== String(cleanFormRef.current || ''), [form]);

  const persistCurrentSettings = React.useCallback(async () => {
    const req: ITellerSettingsSaveRequest = {
      env: form.env,
      application_id: form.application_id,
      certificate: form.certificate,
      private_key: form.private_key,
    };
    const res = await ApiClient.post<ITellerSettingsMutationResponse>('/api/settings/teller.php?action=save', req);
    const next = mapTellerFormState(res?.config, form.env);
    setForm(next);
    const nextStatus = mapTellerStatusState(res?.status);
    setStatus(nextStatus);
    cleanFormRef.current = JSON.stringify(next);
    return {
      message: String(res?.message || 'Saved Teller settings'),
      status: nextStatus,
      applicationId: next.application_id,
      env: next.env,
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
      setError(err?.message || 'Failed to save Teller settings');
    } finally {
      setBusy(false);
    }
  };

  const removeCredential = async (field: ITellerSettingsDeleteRequest['field']) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.post<ITellerSettingsMutationResponse>('/api/settings/teller.php?action=delete', { field });
      const next = mapTellerFormState(res?.config, form.env);
      setForm(next);
      setStatus(mapTellerStatusState(res?.status));
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
    setLastTellerTest('Running...');
    try {
      const req: ITellerSettingsTestRequest = {
        env: form.env,
        application_id: form.application_id,
        certificate: form.certificate,
        private_key: form.private_key,
      };
      const res = await ApiClient.post<ITellerSettingsTestResponse>('/api/settings/teller.php?action=test', req);
      const text = String(res?.message || 'Teller test passed');
      const next = formatTestResult('success', text);
      setLastTellerTest(next);
      catn8LocalStorageSet(LS_TELLER_TEST, next);
      setMessage(text);
      await load();
    } catch (err: any) {
      const text = String(err?.message || 'Teller test failed');
      const next = formatTestResult('failure', text);
      setLastTellerTest(next);
      catn8LocalStorageSet(LS_TELLER_TEST, next);
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
      let effective = {
        status,
        applicationId: form.application_id,
        env: form.env,
      };
      if (isDirty) {
        const saved = await persistCurrentSettings();
        effective = {
          status: saved.status,
          applicationId: saved.applicationId,
          env: saved.env,
        };
      }
      setMessage(await connectTellerBank(effective, load));
    } catch (err: any) {
      void logTellerDiagnostic({
        source: 'teller-settings-modal',
        event_name: 'error',
        message: String(err?.message || 'Failed to connect bank via Teller'),
        meta: {
          select_account: 'disabled',
        },
      });
      setError(err?.message || 'Failed to connect bank via Teller');
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
    lastTellerTest,
    load,
    save,
    test,
    connectBank,
    removeCredential,
  };
}
