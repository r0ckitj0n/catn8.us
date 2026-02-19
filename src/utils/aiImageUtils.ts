import { normalizeText } from './textUtils';

export const AI_IMAGE_PROVIDER_CHOICES = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'azure_openai', label: 'Azure OpenAI' },
  { value: 'google_vertex_ai', label: 'Google Vertex AI' },
  { value: 'aws_bedrock', label: 'AWS Bedrock' },
  { value: 'stability_ai', label: 'Stability AI' },
  { value: 'replicate', label: 'Replicate' },
  { value: 'together_ai', label: 'Together AI' },
  { value: 'fireworks_ai', label: 'Fireworks AI' },
  { value: 'huggingface', label: 'Hugging Face' },
];

export const AI_IMAGE_MODEL_CHOICES_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-image-1', label: 'gpt-image-1' },
    { value: 'dall-e-3', label: 'dall-e-3' },
    { value: 'dall-e-2', label: 'dall-e-2' },
  ],
  azure_openai: [
    { value: 'gpt-image-1', label: 'gpt-image-1 (Azure deployment)' },
    { value: 'dall-e-3', label: 'dall-e-3 (Azure deployment)' },
  ],
  google_vertex_ai: [
    { value: 'imagen-3.0-generate-001', label: 'imagen-3.0-generate-001' },
    { value: 'imagen-3.0-fast-generate-001', label: 'imagen-3.0-fast-generate-001' },
    { value: 'imagen-2.0-generate-001', label: 'imagen-2.0-generate-001' },
  ],
  aws_bedrock: [
    { value: 'amazon.titan-image-generator-v2:0', label: 'amazon.titan-image-generator-v2:0' },
    { value: 'amazon.titan-image-generator-v1', label: 'amazon.titan-image-generator-v1' },
    { value: 'stability.stable-diffusion-xl-v1', label: 'stability.stable-diffusion-xl-v1' },
  ],
  stability_ai: [
    { value: 'stable-image-ultra', label: 'stable-image-ultra' },
    { value: 'stable-image-core', label: 'stable-image-core' },
    { value: 'stable-diffusion-3-large', label: 'stable-diffusion-3-large' },
  ],
  replicate: [
    { value: 'black-forest-labs/flux-1.1-pro', label: 'black-forest-labs/flux-1.1-pro' },
    { value: 'black-forest-labs/flux-1.1-pro-ultra', label: 'black-forest-labs/flux-1.1-pro-ultra' },
    { value: 'stability-ai/stable-diffusion-3', label: 'stability-ai/stable-diffusion-3' },
  ],
  together_ai: [
    { value: 'black-forest-labs/FLUX.1-schnell', label: 'black-forest-labs/FLUX.1-schnell' },
    { value: 'black-forest-labs/FLUX.1.1-pro', label: 'black-forest-labs/FLUX.1.1-pro' },
  ],
  fireworks_ai: [
    { value: 'playground-v2.5-1024px-aesthetic', label: 'playground-v2.5-1024px-aesthetic' },
    { value: 'stable-diffusion-xl-1024-v1-0', label: 'stable-diffusion-xl-1024-v1-0' },
  ],
  huggingface: [
    { value: 'black-forest-labs/FLUX.1-schnell', label: 'black-forest-labs/FLUX.1-schnell' },
    { value: 'stabilityai/stable-diffusion-3.5-large', label: 'stabilityai/stable-diffusion-3.5-large' },
  ],
};

export function aiImageGetModelChoices(provider: string) {
  const key = normalizeText(provider);
  return AI_IMAGE_MODEL_CHOICES_BY_PROVIDER[key] || [];
}

export function aiImageDefaultParams(provider: string, model: string) {
  const p = normalizeText(provider);
  const m = normalizeText(model);
  if (p === 'openai' && (m === 'dall-e-3' || m === 'dall-e-2')) {
    return { size: '1024x1024', quality: m === 'dall-e-3' ? 'standard' : 'standard', style: m === 'dall-e-3' ? 'vivid' : 'natural', n: 1 };
  }
  if (p === 'google_vertex_ai') {
    return { aspect_ratio: '1:1', quality: 'standard', style: 'photorealistic', n: 1 };
  }
  if (p === 'aws_bedrock' || p === 'stability_ai' || p === 'replicate' || p === 'together_ai' || p === 'fireworks_ai' || p === 'huggingface') {
    return { aspect_ratio: '1:1', quality: 'standard', style: 'none', n: 1 };
  }
  return { size: '1024x1024', quality: 'standard', style: 'natural', n: 1 };
}

export function aiImageParamOptions(provider: string) {
  const p = normalizeText(provider);
  if (p === 'openai' || p === 'azure_openai') {
    return {
      size: ['1024x1024', '1024x1536', '1536x1024', '512x512', '256x256'],
      quality: ['standard', 'hd'],
      style: ['natural', 'vivid'],
      n: [1, 2, 3, 4],
    };
  }
  return {
    aspect_ratio: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    quality: ['standard', 'high'],
    style: ['none', 'photorealistic', 'cinematic', 'illustration'],
    n: [1, 2, 3, 4],
  };
}
