import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { catn8LocalStorageGet, catn8LocalStorageSet } from '../../../utils/storageUtils';
import { formatTestResult, normalizeText } from '../../../utils/textUtils';
import { aiImageGetModelChoices, aiImageParamOptions } from '../../../utils/aiImageUtils';
import { IToast, AiLooseObject } from '../../../types/common';
import { IAiImageDraftTestRequest, IAiModelChoice, IAiModelsRequest, IAiModelsResponse } from '../../../types/aiSettings';
import { AIImageConfigState, AIImageSavePayload } from './aiImageConfigTypes';
import { buildAIImageConfigSnapshot, createDefaultAIImageConfigState, getInitialAIImageModelChoices, LS_AI_IMAGE_LOCATION_REF_TEST, LS_AI_IMAGE_PROVIDER_TEST, normalizeAIImageConfigState } from './aiImageConfigUtils';

export function useAIImageConfig(open: boolean, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const cleanSnapshotRef = React.useRef('');
  const [lastAiImageProviderTest, setLastAiImageProviderTest] = React.useState('');
  const [lastAiImageLocationRefTest, setLastAiImageLocationRefTest] = React.useState('');
  const [config, setConfig] = useState<AIImageConfigState>(createDefaultAIImageConfigState);
  const [hasSecrets, setHasSecrets] = useState<Record<string, AiLooseObject>>({});
  const [secretsByProvider, setSecretsByProvider] = useState<Record<string, AiLooseObject>>({});

  const providerKey = normalizeText(config.provider);
  const [modelChoices, setModelChoices] = React.useState<IAiModelChoice[]>(getInitialAIImageModelChoices);
  const [isRefreshingModels, setIsRefreshingModels] = React.useState(false);
  const [modelChoicesSource, setModelChoicesSource] = React.useState<'catalog' | 'live'>('catalog');
  const paramOptions = React.useMemo(() => aiImageParamOptions(config.provider), [config.provider]);

  const buildSnapshot = React.useCallback(() => buildAIImageConfigSnapshot(config, secretsByProvider), [config, secretsByProvider]);

  React.useEffect(() => {
    if (!open) return;
    setBusy(true);
    setError('');
    setMessage('');
    setLastAiImageProviderTest(catn8LocalStorageGet(LS_AI_IMAGE_PROVIDER_TEST));
    setLastAiImageLocationRefTest(catn8LocalStorageGet(LS_AI_IMAGE_LOCATION_REF_TEST));

    ApiClient.get('/api/settings/ai_image.php')
      .then((res) => {
        const nextConfig = normalizeAIImageConfigState(res?.config);
        setConfig(nextConfig);
        setModelChoices(aiImageGetModelChoices(nextConfig.provider));
        setModelChoicesSource('catalog');
        setHasSecrets((res && typeof res === 'object' && res.has_secrets && typeof res.has_secrets === 'object') ? res.has_secrets : {});
        cleanSnapshotRef.current = JSON.stringify({ cfg: nextConfig, secrets: {} });
      })
      .catch((e) => setError(e?.message || 'Failed to load image AI configuration'))
      .finally(() => setBusy(false));
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    if (!config || typeof config !== 'object' || !config.provider) return;
    const choices = modelChoices.length ? modelChoices : aiImageGetModelChoices(config.provider);
    if (!choices.length) return;
    const current = String(config.model || '');
    if (choices.some((m) => String(m.value) === current)) return;
    setConfig((c) => ({ ...c, model: String(choices[0].value || '') }));
  }, [open, config.provider, config.model, modelChoices]);

  React.useEffect(() => {
    if (!open) return;
    setModelChoices(aiImageGetModelChoices(config.provider));
    setModelChoicesSource('catalog');
  }, [open, config.provider]);

  React.useEffect(() => {
    if (!error) return;
    onToast?.({ tone: 'error', message: String(error) });
    setError('');
  }, [error, onToast]);

  React.useEffect(() => {
    if (!message) return;
    onToast?.({ tone: 'success', message: String(message) });
    setMessage('');
  }, [message, onToast]);

  const isDirty = String(cleanSnapshotRef.current || '') !== buildSnapshot();

  const applyAiImageProviderTestResult = React.useCallback((response: any) => {
    const provider = String(response?.ai_image?.provider || '').trim();
    const model = String(response?.ai_image?.model || '').trim();
    const sample = String(response?.sample || '').trim();
    const details = `${provider}${model ? ` / ${model}` : ''}${sample ? ` — ${sample}` : ''}`;
    const next = formatTestResult('success', details); setLastAiImageProviderTest(next); catn8LocalStorageSet(LS_AI_IMAGE_PROVIDER_TEST, next);
    setMessage(`Test OK: ${details}`);
  }, []);

  const testAiImageProvider = async () => {
    if (busy) return;
    setLastAiImageProviderTest('Running…');
    setBusy(true);
    setError('');
    setMessage('');
    try {
      applyAiImageProviderTestResult(await ApiClient.get('/api/settings/ai_image_test.php'));
    } catch (e: any) {
      const next = formatTestResult('failure', String(e?.message || e || 'Failed'));
      setLastAiImageProviderTest(next);
      catn8LocalStorageSet(LS_AI_IMAGE_PROVIDER_TEST, next);
      setError(String(e?.message || e || 'Failed to test provider'));
    } finally {
      setBusy(false);
    }
  };

  const testAiImageProviderDraft = async () => {
    if (busy) return;
    setLastAiImageProviderTest('Running…');
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const providerSecrets = secretsByProvider[providerKey] && typeof secretsByProvider[providerKey] === 'object' ? secretsByProvider[providerKey] : {};
      const req: IAiImageDraftTestRequest = {
        provider: config.provider,
        model: config.model,
        base_url: config.base_url,
        provider_config: config.provider_config || {},
        params: config.params || {},
        secrets: providerSecrets,
      };
      applyAiImageProviderTestResult(await ApiClient.post('/api/settings/ai_image_test.php', req));
    } catch (e: any) {
      const next = formatTestResult('failure', String(e?.message || e || 'Failed'));
      setLastAiImageProviderTest(next);
      catn8LocalStorageSet(LS_AI_IMAGE_PROVIDER_TEST, next);
      setError(String(e?.message || e || 'Failed to test provider'));
    } finally {
      setBusy(false);
    }
  };

  const refreshModelChoices = async () => {
    if (busy || isRefreshingModels) return;
    setIsRefreshingModels(true);
    setError('');
    try {
      const providerSecrets = secretsByProvider[providerKey] && typeof secretsByProvider[providerKey] === 'object' ? secretsByProvider[providerKey] : {};
      const req: IAiModelsRequest = {
        mode: 'image',
        provider: config.provider,
        model: config.model,
        base_url: config.base_url,
        provider_config: config.provider_config || {},
        params: config.params || {},
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
  };

  const save = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const params = config?.params;
      if (!params || typeof params !== 'object' || Array.isArray(params)) throw new Error('Params must be an object');
      const providerConfig = config?.provider_config;
      if (providerConfig && (typeof providerConfig !== 'object' || Array.isArray(providerConfig))) throw new Error('Provider config must be an object');
      const payload: AIImageSavePayload = {
        provider: String(config.provider || '').trim(),
        model: String(config.model || '').trim(),
        base_url: String(config.base_url || '').trim(),
        params: params as AiLooseObject,
        provider_config: (providerConfig || {}) as AiLooseObject,
      };
      const providerNorm = normalizeText(config.provider);
      const providerSecrets = secretsByProvider[providerNorm] && typeof secretsByProvider[providerNorm] === 'object' ? secretsByProvider[providerNorm] : null;
      if (providerSecrets) payload.secrets = providerSecrets;
      const res = await ApiClient.post('/api/settings/ai_image.php', payload);
      const nextConfig = normalizeAIImageConfigState(res?.config, payload);
      setConfig(nextConfig);
      setHasSecrets((res && typeof res === 'object' && res.has_secrets && typeof res.has_secrets === 'object') ? res.has_secrets : {});
      setSecretsByProvider((all) => {
        const next = { ...(all || {}) };
        if (providerNorm) next[providerNorm] = {};
        return next;
      });
      setMessage('Saved.');
      cleanSnapshotRef.current = buildSnapshot();
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return {
    busy, setBusy, config, setConfig, hasSecrets, setHasSecrets, secretsByProvider, setSecretsByProvider,
    lastAiImageProviderTest, setLastAiImageProviderTest, lastAiImageLocationRefTest, setLastAiImageLocationRefTest,
    providerKey, modelChoices, modelChoicesSource, isRefreshingModels, paramOptions, isDirty,
    testAiImageProvider, testAiImageProviderDraft, refreshModelChoices, save,
  };
}
