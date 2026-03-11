import React from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { openTellerConnect } from '../../../core/tellerConnect';
import { catn8LocalStorageGet, catn8LocalStorageSet } from '../../../utils/storageUtils';
import { formatTestResult } from '../../../utils/textUtils';
import { IToast } from '../../../types/common';
import {
  Accumul8TellerConnectTokenResponse,
  Accumul8TellerEnrollmentResponse,
  Accumul8TellerSyncResponse,
} from '../../../types/accumul8';
import {
  ITellerSettingsDeleteRequest,
  ITellerSettingsGetResponse,
  ITellerSettingsMutationResponse,
  ITellerSettingsSaveRequest,
  ITellerSettingsTestRequest,
  ITellerSettingsTestResponse,
  TellerEnvironment,
} from '../../../types/tellerSettings';

const LS_TELLER_TEST = 'catn8.last_test.settings.teller';

interface TellerFormState {
  env: TellerEnvironment;
  application_id: string;
  certificate: string;
  private_key: string;
}

interface TellerStatusState {
  has_application_id: boolean;
  has_certificate: boolean;
  has_private_key: boolean;
}

const defaultFormState: TellerFormState = {
  env: 'sandbox',
  application_id: '',
  certificate: '',
  private_key: '',
};

const defaultStatusState: TellerStatusState = {
  has_application_id: false,
  has_certificate: false,
  has_private_key: false,
};

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
      const next: TellerFormState = {
        env: (res?.config?.env || 'sandbox') as TellerEnvironment,
        application_id: String(res?.config?.application_id || ''),
        certificate: '',
        private_key: '',
      };
      setForm(next);
      setStatus({
        has_application_id: Boolean(res?.status?.has_application_id),
        has_certificate: Boolean(res?.status?.has_certificate),
        has_private_key: Boolean(res?.status?.has_private_key),
      });
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
    const next: TellerFormState = {
      env: (res?.config?.env || form.env) as TellerEnvironment,
      application_id: String(res?.config?.application_id || ''),
      certificate: '',
      private_key: '',
    };
    setForm(next);
    const nextStatus = {
      has_application_id: Boolean(res?.status?.has_application_id),
      has_certificate: Boolean(res?.status?.has_certificate),
      has_private_key: Boolean(res?.status?.has_private_key),
    };
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
      const next: TellerFormState = {
        env: (res?.config?.env || form.env) as TellerEnvironment,
        application_id: String(res?.config?.application_id || ''),
        certificate: '',
        private_key: '',
      };
      setForm(next);
      setStatus({
        has_application_id: Boolean(res?.status?.has_application_id),
        has_certificate: Boolean(res?.status?.has_certificate),
        has_private_key: Boolean(res?.status?.has_private_key),
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

      if (!effective.status.has_application_id || !effective.status.has_certificate || !effective.status.has_private_key) {
        throw new Error('Teller application id, certificate, and private key are required before connecting.');
      }

      const tokenRes = await ApiClient.post<Accumul8TellerConnectTokenResponse>('/api/accumul8.php?action=teller_connect_token', {});
      const applicationId = String(tokenRes?.application_id || effective.applicationId || '');
      const environment = (String(tokenRes?.environment || effective.env || 'sandbox') || 'sandbox') as TellerEnvironment;
      if (applicationId === '') {
        throw new Error('No Teller application id is available');
      }

      const connectResult = await openTellerConnect(applicationId, environment);
      if (connectResult.outcome === 'cancelled') {
        setMessage('Teller Connect was closed before connecting an account.');
        return;
      }

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

      const syncRes = await ApiClient.post<Accumul8TellerSyncResponse>('/api/accumul8.php?action=teller_sync_transactions', {
        connection_id: connectionId,
      });
      const added = Number(syncRes?.added || 0);
      const modified = Number(syncRes?.modified || 0);
      const removed = Number(syncRes?.removed || 0);
      setMessage(`Teller connected and synced (${added} added, ${modified} modified, ${removed} removed).`);
      await load();
    } catch (err: any) {
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
