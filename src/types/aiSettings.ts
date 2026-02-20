import { AiLooseObject } from './common';

export interface IAiModelsRequest {
  mode: 'chat' | 'image';
  provider: string;
  model: string;
  base_url: string;
  location?: string;
  provider_config: AiLooseObject;
  params?: AiLooseObject;
  secrets?: AiLooseObject;
}

export interface IAiModelChoice {
  value: string;
  label: string;
}

export interface IAiModelsResponse {
  success: boolean;
  source: 'catalog' | 'live';
  models: IAiModelChoice[];
}

export interface IAiImageDraftTestRequest {
  provider: string;
  model: string;
  base_url: string;
  provider_config: AiLooseObject;
  params: AiLooseObject;
  secrets?: AiLooseObject;
}
