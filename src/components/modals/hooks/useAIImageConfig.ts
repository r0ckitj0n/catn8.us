import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { catn8LocalStorageGet, catn8LocalStorageSet } from '../../../utils/storageUtils';
import { formatTestResult, normalizeText } from '../../../utils/textUtils';
import { aiImageGetModelChoices, aiImageParamOptions, aiImageDefaultParams } from '../../../utils/aiImageUtils';
import { IToast, AiLooseObject } from '../../../types/common';

export type AIImageConfigState = {
  provider: string;
  model: string;
  base_url: string;
  params: AiLooseObject;
  provider_config: AiLooseObject;
};

export type AIImageSavePayload = {
  provider: string;
  model: string;
  base_url: string;
  params: AiLooseObject;
  provider_config: AiLooseObject;
  secrets?: AiLooseObject;
};

const LS_AI_IMAGE_PROVIDER_TEST = 'catn8.last_test.ai_image.provider';
const LS_AI_IMAGE_LOCATION_REF_TEST = 'catn8.last_test.ai_image.location_ref';

export function useAIImageConfig(open: boolean, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const cleanSnapshotRef = React.useRef('');

  const [lastAiImageProviderTest, setLastAiImageProviderTest] = React.useState('');
  const [lastAiImageLocationRefTest, setLastAiImageLocationRefTest] = React.useState('');

  const [config, setConfig] = useState<AIImageConfigState>({
    provider: 'openai',
    model: 'gpt-image-1',
    base_url: '',
    params: {},
    provider_config: {},
  });
  const [hasSecrets, setHasSecrets] = useState<Record<string, AiLooseObject>>({});
  const [secretsByProvider, setSecretsByProvider] = useState<Record<string, AiLooseObject>>({});

  const providerKey = normalizeText(config.provider);
  const modelChoices = React.useMemo(() => aiImageGetModelChoices(config.provider), [config.provider]);
  const paramOptions = React.useMemo(() => aiImageParamOptions(config.provider), [config.provider]);

  const buildSnapshot = React.useCallback(() => {
    const cfg = (config && typeof config === 'object') ? (config as any) : {};
    const providerNorm = normalizeText(cfg.provider);
    const secrets = (secretsByProvider && typeof secretsByProvider === 'object' && providerNorm && secretsByProvider[providerNorm] && typeof secretsByProvider[providerNorm] === 'object')
      ? secretsByProvider[providerNorm]
      : {};
    return JSON.stringify({ cfg, secrets });
  }, [config, secretsByProvider]);

  React.useEffect(() => {
    if (!open) return;
    setBusy(true);
    setError('');
    setMessage('');
    setLastAiImageProviderTest(catn8LocalStorageGet(LS_AI_IMAGE_PROVIDER_TEST));
    setLastAiImageLocationRefTest(catn8LocalStorageGet(LS_AI_IMAGE_LOCATION_REF_TEST));

    ApiClient.get('/api/settings/ai_image.php')
      .then((res) => {
        const cfg = res?.config || {};
        const params = (cfg && typeof cfg === 'object' && cfg.params && typeof cfg.params === 'object') ? cfg.params : {};
        const providerConfig = (cfg && typeof cfg === 'object' && cfg.provider_config && typeof cfg.provider_config === 'object') ? cfg.provider_config : {};
        const nextConfig = {
          provider: String(cfg.provider || 'openai'),
          model: String(cfg.model || 'gpt-image-1'),
          base_url: String(cfg.base_url || ''),
          params,
          provider_config: providerConfig,
        };
        setConfig(nextConfig);
        setHasSecrets((res && typeof res === 'object' && res.has_secrets && typeof res.has_secrets === 'object') ? res.has_secrets : {});
        cleanSnapshotRef.current = JSON.stringify({ cfg: nextConfig, secrets: {} });
      })
      .catch((e) => setError(e?.message || 'Failed to load image AI configuration'))
      .finally(() => setBusy(false));
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    if (!config || typeof config !== 'object') return;
    if (!config.provider) return;
    const choices = aiImageGetModelChoices(config.provider);
    if (!choices.length) return;
    const current = String(config.model || '');
    if (choices.some((m) => String(m.value) === current)) return;
    setConfig((c) => ({ ...c, model: String(choices[0].value || '') }));
  }, [open, config.provider, config.model]);

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

  const testAiImageProvider = async () => {
    if (busy) return;
    setLastAiImageProviderTest('Running…');
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.get('/api/settings/ai_image_test.php');
      const provider = String(res?.ai_image?.provider || '').trim();
      const model = String(res?.ai_image?.model || '').trim();
      const sample = String(res?.sample || '').trim();
      const details = `${provider}${model ? ` / ${model}` : ''}${sample ? ` — ${sample}` : ''}`;
      const next = formatTestResult('success', details);
      setLastAiImageProviderTest(next);
      catn8LocalStorageSet(LS_AI_IMAGE_PROVIDER_TEST, next);
      setMessage(`Test OK: ${details}`);
    } catch (e: any) {
      const next = formatTestResult('failure', String(e?.message || e || 'Failed'));
      setLastAiImageProviderTest(next);
      catn8LocalStorageSet(LS_AI_IMAGE_PROVIDER_TEST, next);
      setError(String(e?.message || e || 'Failed to test provider'));
    } finally {
      setBusy(false);
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
      if (providerSecrets) {
        payload.secrets = providerSecrets;
      }

      const res = await ApiClient.post('/api/settings/ai_image.php', payload);
      const cfg = res?.config || {};
      const nextParams = (cfg && typeof cfg === 'object' && cfg.params && typeof cfg.params === 'object') ? cfg.params : {};
      const nextProviderConfig = (cfg && typeof cfg === 'object' && cfg.provider_config && typeof cfg.provider_config === 'object') ? cfg.provider_config : {};
      const nextConfig = {
        provider: String(cfg.provider || payload.provider || 'openai'),
        model: String(cfg.model || payload.model || 'gpt-image-1'),
        base_url: String(cfg.base_url || payload.base_url || ''),
        params: nextParams,
        provider_config: nextProviderConfig,
      };
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
    busy, setBusy,
    config, setConfig,
    hasSecrets, setHasSecrets,
    secretsByProvider, setSecretsByProvider,
    lastAiImageProviderTest, setLastAiImageProviderTest,
    lastAiImageLocationRefTest, setLastAiImageLocationRefTest,
    providerKey,
    modelChoices,
    paramOptions,
    isDirty,
    testAiImageProvider,
    save
  };
}
