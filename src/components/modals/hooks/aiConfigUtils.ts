import { aiGetModelChoices } from '../../../utils/aiUtils';
import { normalizeText } from '../../../utils/textUtils';
import { AiLooseObject } from '../../../types/common';

import { AIConfigState } from './aiConfigTypes';

export const LS_AI_PROVIDER_TEST = 'catn8.last_test.ai.provider';

export function createDefaultAIConfigState(): AIConfigState {
  return {
    provider: 'openai',
    model: 'gpt-5.2-mini',
    base_url: '',
    location: '',
    temperature: 0.2,
    system_prompt: '',
    provider_config: {},
  };
}

export function normalizeAIConfigState(cfg: any, fallback?: Partial<AIConfigState>): AIConfigState {
  const providerConfig = (cfg && typeof cfg === 'object' && cfg.provider_config && typeof cfg.provider_config === 'object' && !Array.isArray(cfg.provider_config))
    ? cfg.provider_config
    : {};
  return {
    provider: String(cfg?.provider || fallback?.provider || 'openai'),
    model: String(cfg?.model || fallback?.model || 'gpt-5.2-mini'),
    base_url: String(cfg?.base_url || fallback?.base_url || ''),
    location: String(cfg?.location || fallback?.location || ''),
    temperature: Number.isFinite(Number(cfg?.temperature)) ? Number(cfg.temperature) : Number(fallback?.temperature ?? 0.2),
    system_prompt: String(cfg?.system_prompt || fallback?.system_prompt || ''),
    provider_config: providerConfig,
  };
}

export function getInitialAIModelChoices() {
  return aiGetModelChoices('openai');
}

export function buildAIConfigSnapshot(
  nextConfig: AIConfigState,
  nextSecretsByProvider: Record<string, AiLooseObject>,
): string {
  const cfg = (nextConfig && typeof nextConfig === 'object') ? (nextConfig as any) : {};
  const providerNorm = normalizeText(cfg.provider);
  const secrets = (nextSecretsByProvider && typeof nextSecretsByProvider === 'object' && providerNorm && nextSecretsByProvider[providerNorm] && typeof nextSecretsByProvider[providerNorm] === 'object')
    ? nextSecretsByProvider[providerNorm]
    : {};
  return JSON.stringify({ cfg, secrets });
}

export function canAttemptLiveAIModelRefresh(args: {
  config: AIConfigState;
  hasSecrets: Record<string, AiLooseObject>;
  secretsByProvider: Record<string, AiLooseObject>;
  providerKey: string;
}): boolean {
  const { config, hasSecrets, secretsByProvider, providerKey } = args;
  const savedSecrets = hasSecrets[providerKey] && typeof hasSecrets[providerKey] === 'object'
    ? hasSecrets[providerKey]
    : {};
  const draftSecrets = secretsByProvider[providerKey] && typeof secretsByProvider[providerKey] === 'object'
    ? secretsByProvider[providerKey]
    : {};
  const hasApiKey = Number((savedSecrets as any).api_key || 0) === 1 || String((draftSecrets as any).api_key || '').trim() !== '';
  const hasServiceAccount = Number((savedSecrets as any).service_account_json || 0) === 1 || String((draftSecrets as any).service_account_json || '').trim() !== '';
  const hasAwsAccessKey = Number((savedSecrets as any).aws_access_key_id || 0) === 1 || String((draftSecrets as any).aws_access_key_id || '').trim() !== '';
  const hasAwsSecretKey = Number((savedSecrets as any).aws_secret_access_key || 0) === 1 || String((draftSecrets as any).aws_secret_access_key || '').trim() !== '';

  if (providerKey === 'google_vertex_ai') {
    return hasServiceAccount && String(config.location || '').trim() !== '';
  }
  if (providerKey === 'aws_bedrock') {
    return hasAwsAccessKey && hasAwsSecretKey && String((config.provider_config as any)?.aws_region || '').trim() !== '';
  }
  if (providerKey === 'azure_openai') {
    return hasApiKey
      && String((config.provider_config as any)?.azure_endpoint || '').trim() !== ''
      && String((config.provider_config as any)?.azure_api_version || '').trim() !== '';
  }
  return hasApiKey;
}
