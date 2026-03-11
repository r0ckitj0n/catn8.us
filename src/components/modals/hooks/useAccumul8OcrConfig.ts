import React from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IToast } from '../../../types/common';
import { Accumul8OcrSettings, Accumul8OcrSettingsResponse } from '../../../types/accumul8OcrSettings';

const emptySettings: Accumul8OcrSettings = {
  has_service_account_json: 0,
  project_id: '',
  client_email: '',
  client_email_hint: '',
};

export function useAccumul8OcrConfig(open: boolean, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [settings, setSettings] = React.useState<Accumul8OcrSettings>(emptySettings);
  const [serviceAccountJson, setServiceAccountJson] = React.useState('');
  const cleanRef = React.useRef('');

  const load = React.useCallback(async () => {
    setBusy(true);
    try {
      const res = await ApiClient.get<Accumul8OcrSettingsResponse>('/api/settings/accumul8_ocr.php');
      const next = res?.settings || emptySettings;
      setSettings(next);
      setServiceAccountJson('');
      cleanRef.current = '';
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Failed to load Accumul8 OCR settings' });
    } finally {
      setBusy(false);
    }
  }, [onToast]);

  React.useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const save = React.useCallback(async () => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Accumul8OcrSettingsResponse>('/api/settings/accumul8_ocr.php', {
        service_account_json: serviceAccountJson,
      });
      const next = res?.settings || emptySettings;
      setSettings(next);
      setServiceAccountJson('');
      cleanRef.current = '';
      onToast?.({ tone: 'success', message: 'Accumul8 OCR credential saved' });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Failed to save Accumul8 OCR settings' });
    } finally {
      setBusy(false);
    }
  }, [onToast, serviceAccountJson]);

  const clear = React.useCallback(async () => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Accumul8OcrSettingsResponse>('/api/settings/accumul8_ocr.php', {
        clear: 1,
      });
      setSettings(res?.settings || emptySettings);
      setServiceAccountJson('');
      cleanRef.current = '';
      onToast?.({ tone: 'success', message: 'Accumul8 OCR credential removed' });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Failed to remove Accumul8 OCR settings' });
    } finally {
      setBusy(false);
    }
  }, [onToast]);

  const isDirty = serviceAccountJson.trim() !== '' && serviceAccountJson !== cleanRef.current;

  return {
    busy,
    settings,
    serviceAccountJson,
    setServiceAccountJson,
    isDirty,
    load,
    save,
    clear,
  };
}
