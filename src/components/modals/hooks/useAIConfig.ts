import React, { useState } from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { catn8LocalStorageGet, catn8LocalStorageSet } from '../../../utils/storageUtils';
import { formatTestResult, normalizeText } from '../../../utils/textUtils';
import { aiGetModelChoices } from '../../../utils/aiUtils';
import { IToast, AiLooseObject } from '../../../types/common';

export type AIConfigState = {
  provider: string;
  model: string;
  base_url: string;
  location: string;
  temperature: number;
  system_prompt: string;
  provider_config: AiLooseObject;
};

export type AIConfigSavePayload = {
  provider: string;
  model: string;
  base_url: string;
  location: string;
  temperature: number;
  system_prompt: string;
  provider_config: AiLooseObject;
  secrets?: AiLooseObject;
};

const LS_AI_PROVIDER_TEST = 'catn8.last_test.ai.provider';

export function useAIConfig(open: boolean, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const cleanSnapshotRef = React.useRef('');

  const [lastAiProviderTest, setLastAiProviderTest] = React.useState('');

  const [config, setConfig] = useState<AIConfigState>({
    provider: 'openai',
    model: 'gpt-4o-mini',
    base_url: '',
    location: '',
    temperature: 0.2,
    system_prompt: '',
    provider_config: {},
  });
  const [hasSecrets, setHasSecrets] = useState<Record<string, AiLooseObject>>({});
  const [secretsByProvider, setSecretsByProvider] = useState<Record<string, AiLooseObject>>({});

  const providerKey = normalizeText(config.provider);
  const modelChoices = React.useMemo(() => aiGetModelChoices(config.provider), [config.provider]);

  const buildSnapshot = React.useCallback((nextConfig = config, nextSecretsByProvider = secretsByProvider) => {
    const cfg = (nextConfig && typeof nextConfig === 'object') ? (nextConfig as any) : {};
    const providerNorm = normalizeText(cfg.provider);
    const secrets = (nextSecretsByProvider && typeof nextSecretsByProvider === 'object' && providerNorm && nextSecretsByProvider[providerNorm] && typeof nextSecretsByProvider[providerNorm] === 'object')
      ? nextSecretsByProvider[providerNorm]
      : {};
    return JSON.stringify({ cfg, secrets });
  }, [config, secretsByProvider]);

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
        const cfg = resAi?.config || {};
        const providerConfig = (cfg && typeof cfg === 'object' && cfg.provider_config && typeof cfg.provider_config === 'object' && !Array.isArray(cfg.provider_config)) ? cfg.provider_config : {};
        const nextConfig = {
          provider: String(cfg.provider || 'openai'),
          model: String(cfg.model || 'gpt-4o-mini'),
          base_url: String(cfg.base_url || ''),
          location: String(cfg.location || ''),
          temperature: Number.isFinite(Number(cfg.temperature)) ? Number(cfg.temperature) : 0.2,
          system_prompt: String(cfg.system_prompt || ''),
          provider_config: providerConfig,
        };
        setConfig(nextConfig);
        setHasSecrets((resAi && typeof resAi === 'object' && resAi.has_secrets && typeof resAi.has_secrets === 'object') ? resAi.has_secrets : {});
        cleanSnapshotRef.current = buildSnapshot(nextConfig, {});
      })
      .catch((e) => setError(e?.message || 'Failed to load AI configuration'))
      .finally(() => setBusy(false));
  }, [open, buildSnapshot]);

  React.useEffect(() => {
    if (!open) return;
    if (!config || typeof config !== 'object') return;
    if (!config.provider) return;
    const choices = aiGetModelChoices(config.provider);
    if (!choices.length) return;
    const current = String(config.model || '').trim();
    if (current !== '') return;
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

      const nextCfg = resAi?.config || {};
      const nextProviderConfig = (nextCfg && typeof nextCfg === 'object' && nextCfg.provider_config && typeof nextCfg.provider_config === 'object' && !Array.isArray(nextCfg.provider_config)) ? nextCfg.provider_config : {};
      const nextConfigState = {
        provider: String(nextCfg.provider || payload.provider || 'openai'),
        model: String(nextCfg.model || payload.model || 'gpt-4o-mini'),
        base_url: String(nextCfg.base_url || payload.base_url || ''),
        location: String(nextCfg.location || payload.location || ''),
        temperature: Number.isFinite(Number(nextCfg.temperature)) ? Number(nextCfg.temperature) : Number(payload.temperature),
        system_prompt: String(nextCfg.system_prompt || payload.system_prompt || ''),
        provider_config: nextProviderConfig,
      };
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
    busy, setBusy,
    config, setConfig,
    hasSecrets, setHasSecrets,
    secretsByProvider, setSecretsByProvider,
    lastAiProviderTest,
    providerKey,
    modelChoices,
    isDirty,
    testAiProvider,
    save
  };
}
