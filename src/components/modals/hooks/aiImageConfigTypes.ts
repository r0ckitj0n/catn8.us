import { AiLooseObject } from '../../../types/common';

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
