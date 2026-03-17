import { aiImageGetModelChoices } from '../../../utils/aiImageUtils';
import { normalizeText } from '../../../utils/textUtils';
import { AiLooseObject } from '../../../types/common';

import { AIImageConfigState } from './aiImageConfigTypes';

export const LS_AI_IMAGE_PROVIDER_TEST = 'catn8.last_test.ai_image.provider';
export const LS_AI_IMAGE_LOCATION_REF_TEST = 'catn8.last_test.ai_image.location_ref';

export function createDefaultAIImageConfigState(): AIImageConfigState {
  return {
    provider: 'openai',
    model: 'gpt-image-1',
    base_url: '',
    params: {},
    provider_config: {},
  };
}

export function normalizeAIImageConfigState(cfg: any, fallback?: Partial<AIImageConfigState>): AIImageConfigState {
  const params = (cfg && typeof cfg === 'object' && cfg.params && typeof cfg.params === 'object') ? cfg.params : {};
  const providerConfig = (cfg && typeof cfg === 'object' && cfg.provider_config && typeof cfg.provider_config === 'object') ? cfg.provider_config : {};
  return {
    provider: String(cfg?.provider || fallback?.provider || 'openai'),
    model: String(cfg?.model || fallback?.model || 'gpt-image-1'),
    base_url: String(cfg?.base_url || fallback?.base_url || ''),
    params,
    provider_config: providerConfig,
  };
}

export function getInitialAIImageModelChoices() {
  return aiImageGetModelChoices('openai');
}

export function buildAIImageConfigSnapshot(
  config: AIImageConfigState,
  secretsByProvider: Record<string, AiLooseObject>,
): string {
  const cfg = (config && typeof config === 'object') ? (config as any) : {};
  const providerNorm = normalizeText(cfg.provider);
  const secrets = (secretsByProvider && typeof secretsByProvider === 'object' && providerNorm && secretsByProvider[providerNorm] && typeof secretsByProvider[providerNorm] === 'object')
    ? secretsByProvider[providerNorm]
    : {};
  return JSON.stringify({ cfg, secrets });
}
