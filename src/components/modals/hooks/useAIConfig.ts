import React, { useCallback, useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { catn8LocalStorageGet, catn8LocalStorageSet } from '../../../utils/storageUtils';
import { formatTestResult, normalizeText } from '../../../utils/textUtils';
import { aiGetModelChoices } from '../../../utils/aiUtils';
import { IToast, AiLooseObject } from '../../../types/common';
import { IAiModelChoice, IAiModelsRequest, IAiModelsResponse } from '../../../types/aiSettings';
import { AIConfigSavePayload, AIConfigState } from './aiConfigTypes';
import { buildAIConfigSnapshot, canAttemptLiveAIModelRefresh, createDefaultAIConfigState, getInitialAIModelChoices, LS_AI_PROVIDER_TEST, normalizeAIConfigState } from './aiConfigUtils';

export function useAIConfig(open: boolean, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const cleanSnapshotRef = React.useRef('');
  const [lastAiProviderTest, setLastAiProviderTest] = React.useState('');
  const [config, setConfig] = useState<AIConfigState>(createDefaultAIConfigState);
  const [hasSecrets, setHasSecrets] = useState<Record<string, AiLooseObject>>({});
  const [secretsByProvider, setSecretsByProvider] = useState<Record<string, AiLooseObject>>({});

  const providerKey = normalizeText(config.provider);
  const [modelChoices, setModelChoices] = React.useState<IAiModelChoice[]>(getInitialAIModelChoices);
  const [isRefreshingModels, setIsRefreshingModels] = React.useState(false);
  const [modelChoicesSource, setModelChoicesSource] = React.useState<'catalog' | 'live'>('catalog');

  const buildSnapshot = React.useCallback((nextConfig = config, nextSecretsByProvider = secretsByProvider) => buildAIConfigSnapshot(nextConfig, nextSecretsByProvider), [config, secretsByProvider]);
  const canAttemptLiveModelRefresh = useCallback(() => canAttemptLiveAIModelRefresh({ config, hasSecrets, secretsByProvider, providerKey }), [config.location, config.provider_config, hasSecrets, providerKey, secretsByProvider]);

  React.useEffect(() => {
    if (!open) return;
    setBusy(true);
    setError('');
    setMessage('');
    setLastAiProviderTest(catn8LocalStorageGet(LS_AI_PROVIDER_TEST));
    setHasSecrets({});
    setSecretsByProvider({});

    ApiClient.get('/api/settings/ai.php')
      .then((resAi) => {
        const nextConfig = normalizeAIConfigState(resAi?.config);
        setConfig(nextConfig);
        setModelChoices(aiGetModelChoices(nextConfig.provider));
        setModelChoicesSource('catalog');
        setHasSecrets((resAi && typeof resAi === 'object' && resAi.has_secrets && typeof resAi.has_secrets === 'object') ? resAi.has_secrets : {});
        cleanSnapshotRef.current = buildSnapshot(nextConfig, {});
      })
      .catch((e) => setError(e?.message || 'Failed to load AI configuration'))
      .finally(() => setBusy(false));
  }, [open]);

  React.useEffect(() => {
    if (!error) return;
    if (typeof onToast === 'function') onToast({ tone: 'error', message: String(error) });
    setError('');
  }, [error, onToast]);

  React.useEffect(() => {
    if (!message) return;
    if (typeof onToast === 'function') onToast({ tone: 'success', message: String(message) });
    setMessage('');
  }, [message, onToast]);

  const isDirty = String(cleanSnapshotRef.current || '') !== buildSnapshot();

  const testAiProvider = async () => {
    setLastAiProviderTest('Running…');
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.get('/api/settings/ai_test.php');
      const provider = String(res?.ai?.provider || '').trim();
      const model = String(res?.ai?.model || '').trim();
      const sample = String(res?.sample || '').trim();
      const label = provider ? provider + (model ? ' / ' + model : '') : 'AI provider';
      const next = formatTestResult('success', label + (sample ? ': ' + sample : ''));
      setLastAiProviderTest(next);
      catn8LocalStorageSet(LS_AI_PROVIDER_TEST, next);
      setMessage(label + ' OK' + (sample ? ': ' + sample : ''));
    } catch (e: any) {
      const next = formatTestResult('failure', String(e?.message || 'Failed'));
      setLastAiProviderTest(next);
      catn8LocalStorageSet(LS_AI_PROVIDER_TEST, next);
      setError(e?.message || 'Failed to test AI provider');
    } finally {
      setBusy(false);
    }
  };

  const refreshModelChoices = useCallback(async () => {
    if (busy || isRefreshingModels) return;
    setIsRefreshingModels(true);
    setError('');
    try {
      const providerSecrets = secretsByProvider[providerKey] && typeof secretsByProvider[providerKey] === 'object'
        ? secretsByProvider[providerKey]
        : {};
      const req: IAiModelsRequest = {
        mode: 'chat',
        provider: config.provider,
        model: config.model,
        base_url: config.base_url,
        location: config.location,
        provider_config: config.provider_config || {},
        secrets: providerSecrets,
      };
      const res = await ApiClient.post<IAiModelsResponse>('/api/settings/ai_models.php', req);
      const models = Array.isArray(res?.models) ? res.models : [];
      if (models.length) {
        const normalized = models
          .map((m: any) => ({
            value: String(m?.value || '').trim(),
            label: String(m?.label || m?.value || '').trim(),
          }))
          .filter((m: any) => m.value !== '');
        if (normalized.length) {
          setModelChoices(normalized);
          setModelChoicesSource(String(res?.source || 'live') === 'live' ? 'live' : 'catalog');
          if (!normalized.some((m: any) => m.value === String(config.model || '').trim())) {
            setConfig((prev) => ({ ...prev, model: normalized[0].value }));
          }
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to refresh model list');
    } finally {
      setIsRefreshingModels(false);
    }
  }, [
    busy,
    config.base_url,
    config.location,
    config.model,
    config.provider,
    config.provider_config,
    isRefreshingModels,
    providerKey,
    secretsByProvider,
  ]);

  React.useEffect(() => {
    if (!open) return;
    if (!config || typeof config !== 'object') return;
    if (!config.provider) return;
    const choices = modelChoices.length ? modelChoices : aiGetModelChoices(config.provider);
    if (!choices.length) return;
    const current = String(config.model || '').trim();
    if (current !== '') return;
    setConfig((c) => ({ ...c, model: String(choices[0].value || '') }));
  }, [open, config.provider, config.model, modelChoices]);

  React.useEffect(() => {
    if (!open) return;
    setModelChoices(aiGetModelChoices(config.provider));
    setModelChoicesSource('catalog');
  }, [open, config.provider]);

  React.useEffect(() => {
    if (!open) return;
    if (!canAttemptLiveModelRefresh()) return;
    void refreshModelChoices();
  }, [open, providerKey, canAttemptLiveModelRefresh, refreshModelChoices]);

  const save = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      let providerConfig = config?.provider_config;
      if (!providerConfig || typeof providerConfig !== 'object' || Array.isArray(providerConfig)) providerConfig = {};

      const payload: AIConfigSavePayload = {
        provider: String(config.provider || '').trim(),
        model: String(config.model || '').trim(),
        base_url: String(config.base_url || '').trim(),
        location: String(config.location || '').trim(),
        temperature: Number(config.temperature),
        system_prompt: String(config.system_prompt || ''),
        provider_config: providerConfig as AiLooseObject,
      };

      const providerNorm = normalizeText(payload.provider);
      const providerSecrets = secretsByProvider[providerNorm] && typeof secretsByProvider[providerNorm] === 'object' ? secretsByProvider[providerNorm] : null;
      if (providerSecrets) {
        payload.secrets = providerSecrets;
      }

      const resAi = await ApiClient.post('/api/settings/ai.php', payload);
      const nextConfigState = normalizeAIConfigState(resAi?.config, payload);
      setConfig(nextConfigState);
      setHasSecrets((resAi && typeof resAi === 'object' && resAi.has_secrets && typeof resAi.has_secrets === 'object') ? resAi.has_secrets : {});
      setSecretsByProvider((all) => {
        const next = { ...(all || {}) };
        if (providerNorm) next[providerNorm] = {};
        return next;
      });
      setMessage('Saved.');
      cleanSnapshotRef.current = buildSnapshot(nextConfigState, { [providerNorm]: {} });
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return {
    busy, setBusy, config, setConfig, hasSecrets, setHasSecrets, secretsByProvider, setSecretsByProvider,
    lastAiProviderTest,
    providerKey,
    modelChoices,
    modelChoicesSource,
    isRefreshingModels,
    isDirty,
    testAiProvider,
    refreshModelChoices,
    save,
  };
}
