import React from 'react';

import { ApiClient } from '../../../core/ApiClient';
import { IToast } from '../../../types/common';

export type Tabul8AiSettings = {
  enabled: number;
  model: string;
  fallback: 'celebr8r' | 'manual' | string;
  auto_label_on_snap: number;
  monthly_cap_usd: number;
  per_party_limit: number;
  has_api_key: number;
  api_key_last4: string;
  api_key_masked: string;
  usage: {
    month: string;
    request_count: number;
    estimated_spend_usd: number;
    by_party: Record<string, number>;
  };
  default_model: string;
  allowed_models: string[];
  timeout_seconds: number;
};

const blank: Tabul8AiSettings = {
  enabled: 0,
  model: 'gpt-4o-mini',
  fallback: 'celebr8r',
  auto_label_on_snap: 1,
  monthly_cap_usd: 10,
  per_party_limit: 80,
  has_api_key: 0,
  api_key_last4: '',
  api_key_masked: '',
  usage: { month: '', request_count: 0, estimated_spend_usd: 0, by_party: {} },
  default_model: 'gpt-4o-mini',
  allowed_models: ['gpt-4o-mini'],
  timeout_seconds: 8,
};

export function useTabul8Settings(open: boolean, onToast?: (t: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [settings, setSettings] = React.useState<Tabul8AiSettings>(blank);
  const [apiKeyDraft, setApiKeyDraft] = React.useState('');
  const [enabled, setEnabled] = React.useState(false);
  const [autoLabel, setAutoLabel] = React.useState(true);
  const [model, setModel] = React.useState('gpt-4o-mini');
  const [customModel, setCustomModel] = React.useState('');
  const [fallback, setFallback] = React.useState<'celebr8r' | 'manual'>('celebr8r');
  const [monthlyCap, setMonthlyCap] = React.useState('10');
  const [partyLimit, setPartyLimit] = React.useState('80');
  const [testResult, setTestResult] = React.useState<string>('');

  const load = React.useCallback(async () => {
    setBusy(true);
    try {
      const res = await ApiClient.get<{ success: boolean; settings: Tabul8AiSettings }>(
        '/api/settings/tabul8.php',
      );
      const s = res.settings || blank;
      setSettings(s);
      setEnabled(Number(s.enabled) === 1);
      setAutoLabel(Number(s.auto_label_on_snap) === 1);
      setModel(s.model || s.default_model || 'gpt-4o-mini');
      setCustomModel('');
      setFallback((s.fallback === 'manual' ? 'manual' : 'celebr8r'));
      setMonthlyCap(String(s.monthly_cap_usd ?? 10));
      setPartyLimit(String(s.per_party_limit ?? 80));
      setApiKeyDraft('');
      setTestResult('');
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Failed to load Tabul8 settings' });
    } finally {
      setBusy(false);
    }
  }, [onToast]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const save = async () => {
    setBusy(true);
    try {
      const chosenModel = customModel.trim() || model;
      const body: Record<string, unknown> = {
        action: 'save',
        enabled: enabled ? 1 : 0,
        auto_label_on_snap: autoLabel ? 1 : 0,
        model: chosenModel,
        fallback,
        monthly_cap_usd: Number(monthlyCap) || 0,
        per_party_limit: Number(partyLimit) || 0,
      };
      if (apiKeyDraft.trim()) {
        body.api_key = apiKeyDraft.trim();
      }
      const res = await ApiClient.post<{ success: boolean; settings: Tabul8AiSettings }>(
        '/api/settings/tabul8.php',
        body,
      );
      setSettings(res.settings);
      setApiKeyDraft('');
      onToast?.({ tone: 'success', message: 'Tabul8 AI settings saved' });
      await load();
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Save failed' });
    } finally {
      setBusy(false);
    }
  };

  const clearKey = async () => {
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; settings: Tabul8AiSettings }>(
        '/api/settings/tabul8.php',
        { action: 'clear_key' },
      );
      setSettings(res.settings);
      setApiKeyDraft('');
      onToast?.({ tone: 'success', message: 'OpenAI key removed' });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Clear failed' });
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async () => {
    setBusy(true);
    setTestResult('');
    try {
      // Save draft key first if present so test uses it.
      if (apiKeyDraft.trim()) {
        await ApiClient.post('/api/settings/tabul8.php', {
          action: 'save',
          api_key: apiKeyDraft.trim(),
          enabled: enabled ? 1 : 0,
          auto_label_on_snap: autoLabel ? 1 : 0,
          model: customModel.trim() || model,
          fallback,
          monthly_cap_usd: Number(monthlyCap) || 0,
          per_party_limit: Number(partyLimit) || 0,
        });
        setApiKeyDraft('');
      }
      const res = await ApiClient.post<{
        success: boolean;
        test: { ok: boolean; message: string; model?: string; sample?: string };
        settings: Tabul8AiSettings;
      }>('/api/settings/tabul8.php', { action: 'test' });
      setSettings(res.settings);
      const t = res.test;
      setTestResult(
        t.ok
          ? `OK — model ${t.model || ''} ${t.sample ? `(“${t.sample}”)` : ''}`.trim()
          : `Failed — ${t.message}`,
      );
      onToast?.({
        tone: t.ok ? 'success' : 'error',
        message: t.ok ? 'OpenAI connection OK' : (t.message || 'Test failed'),
      });
    } catch (error: any) {
      const payload = error?.payload;
      if (payload?.settings) setSettings(payload.settings);
      const msg = payload?.test?.message || error?.message || 'Test failed';
      setTestResult(`Failed — ${msg}`);
      onToast?.({ tone: 'error', message: msg });
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    settings,
    apiKeyDraft,
    setApiKeyDraft,
    enabled,
    setEnabled,
    autoLabel,
    setAutoLabel,
    model,
    setModel,
    customModel,
    setCustomModel,
    fallback,
    setFallback,
    monthlyCap,
    setMonthlyCap,
    partyLimit,
    setPartyLimit,
    testResult,
    load,
    save,
    clearKey,
    testConnection,
  };
}
