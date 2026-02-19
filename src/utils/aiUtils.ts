import { normalizeText } from './textUtils';

export const AI_PROVIDER_CHOICES = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google_ai_studio', label: 'Google AI Studio' },
  { value: 'google_vertex_ai', label: 'Google Vertex AI' },
  { value: 'azure_openai', label: 'Azure OpenAI' },
  { value: 'aws_bedrock', label: 'AWS Bedrock' },
  { value: 'together_ai', label: 'Together AI' },
  { value: 'fireworks_ai', label: 'Fireworks AI' },
  { value: 'huggingface', label: 'Hugging Face' },
];

export const AI_MODEL_CHOICES_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
    { value: 'gpt-4o', label: 'gpt-4o' },
    { value: 'gpt-5.2-low', label: 'gpt-5.2-low (low reasoning)' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-latest', label: 'claude-3-5-sonnet-latest' },
    { value: 'claude-3-5-haiku-latest', label: 'claude-3-5-haiku-latest' },
  ],
  google_ai_studio: [
    { value: 'gemini-2.0-flash-001', label: 'gemini-2.0-flash-001' },
    { value: 'gemini-2.0-flash-lite-001', label: 'gemini-2.0-flash-lite-001' },
    { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
    { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
    { value: 'gemini-3.0-flash', label: 'gemini-3.0-flash' },
  ],
  google_vertex_ai: [
    { value: 'publishers/google/models/gemini-2.0-flash-001', label: 'publishers/google/models/gemini-2.0-flash-001' },
    { value: 'publishers/google/models/gemini-2.0-flash-lite-001', label: 'publishers/google/models/gemini-2.0-flash-lite-001' },
    { value: 'publishers/google/models/gemini-2.5-flash', label: 'publishers/google/models/gemini-2.5-flash' },
    { value: 'publishers/google/models/gemini-2.5-pro', label: 'publishers/google/models/gemini-2.5-pro' },
    { value: 'publishers/google/models/gemini-3.0-flash', label: 'publishers/google/models/gemini-3.0-flash' },
  ],
  azure_openai: [
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini (Azure deployment)' },
    { value: 'gpt-4o', label: 'gpt-4o (Azure deployment)' },
    { value: 'gpt-5.2-low', label: 'gpt-5.2-low (Azure deployment)' },
  ],
  aws_bedrock: [
    { value: 'anthropic.claude-3-5-sonnet-20240620-v1:0', label: 'anthropic.claude-3-5-sonnet-20240620-v1:0' },
    { value: 'anthropic.claude-3-5-haiku-20241022-v1:0', label: 'anthropic.claude-3-5-haiku-20241022-v1:0' },
  ],
  together_ai: [
    { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' },
    { value: 'mistralai/Mixtral-8x7B-Instruct-v0.1', label: 'mistralai/Mixtral-8x7B-Instruct-v0.1' },
  ],
  fireworks_ai: [
    { value: 'accounts/fireworks/models/llama-v3p1-70b-instruct', label: 'accounts/fireworks/models/llama-v3p1-70b-instruct' },
    { value: 'accounts/fireworks/models/qwen2p5-72b-instruct', label: 'accounts/fireworks/models/qwen2p5-72b-instruct' },
  ],
  huggingface: [
    { value: 'meta-llama/Llama-3.1-70B-Instruct', label: 'meta-llama/Llama-3.1-70B-Instruct' },
    { value: 'mistralai/Mistral-7B-Instruct-v0.3', label: 'mistralai/Mistral-7B-Instruct-v0.3' },
  ],
};

export function aiGetModelChoices(provider: string) {
  const key = normalizeText(provider);
  return AI_MODEL_CHOICES_BY_PROVIDER[key] || [];
}
