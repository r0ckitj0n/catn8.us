import { AiLooseObject } from '../../../types/common';

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
