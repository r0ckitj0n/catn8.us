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

export const AI_PROVIDER_REQUIREMENTS: Record<string, { summary: string; required: string[]; optional?: string[] }> = {
  openai: {
    summary: 'Best fit for general text workflows, statement scanning, and document analysis.',
    required: ['API key', 'Model'],
    optional: ['Base URL for compatible/self-hosted gateways'],
  },
  anthropic: {
    summary: 'General text provider focused on chat, extraction, and structured analysis.',
    required: ['API key', 'Model'],
  },
  google_ai_studio: {
    summary: 'Gemini API for general text, multimodal prompts, and direct bank statement document scanning.',
    required: ['API key', 'Model'],
  },
  google_vertex_ai: {
    summary: 'Vertex-hosted Gemini with Google Cloud auth and regional routing.',
    required: ['Service account JSON', 'Model', 'Location'],
  },
  azure_openai: {
    summary: 'Azure-hosted OpenAI deployment with explicit endpoint settings.',
    required: ['API key', 'Model', 'Endpoint', 'Deployment', 'API version'],
  },
  aws_bedrock: {
    summary: 'AWS-managed foundation models using IAM-style credentials.',
    required: ['AWS access key ID', 'AWS secret access key', 'Model', 'Region'],
    optional: ['AWS session token'],
  },
  together_ai: {
    summary: 'OpenAI-compatible inference provider for open-weight chat models.',
    required: ['API key', 'Model'],
    optional: ['Base URL'],
  },
  fireworks_ai: {
    summary: 'Fast inference provider for open models with OpenAI-style endpoints.',
    required: ['API key', 'Model'],
    optional: ['Base URL'],
  },
  huggingface: {
    summary: 'Inference API for hosted open models.',
    required: ['API token', 'Model'],
  },
};

export const AI_MODEL_CHOICES_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-5.2', label: 'gpt-5.2' },
    { value: 'gpt-5.2-mini', label: 'gpt-5.2-mini' },
    { value: 'gpt-5.2-chat-latest', label: 'gpt-5.2-chat-latest' },
    { value: 'gpt-5', label: 'gpt-5' },
    { value: 'gpt-5-mini', label: 'gpt-5-mini' },
    { value: 'gpt-4.1', label: 'gpt-4.1' },
    { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-5', label: 'claude-sonnet-4-5' },
    { value: 'claude-opus-4-1', label: 'claude-opus-4-1' },
    { value: 'claude-haiku-4-5', label: 'claude-haiku-4-5' },
  ],
  google_ai_studio: [
    { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
    { value: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite' },
    { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
    { value: 'gemini-2.0-flash-001', label: 'gemini-2.0-flash-001' },
  ],
  google_vertex_ai: [
    { value: 'publishers/google/models/gemini-2.5-flash', label: 'publishers/google/models/gemini-2.5-flash' },
    { value: 'publishers/google/models/gemini-2.5-flash-lite', label: 'publishers/google/models/gemini-2.5-flash-lite' },
    { value: 'publishers/google/models/gemini-2.5-pro', label: 'publishers/google/models/gemini-2.5-pro' },
    { value: 'publishers/google/models/gemini-2.0-flash-001', label: 'publishers/google/models/gemini-2.0-flash-001' },
  ],
  azure_openai: [
    { value: 'gpt-5.2', label: 'gpt-5.2 (deployment name)' },
    { value: 'gpt-5.2-mini', label: 'gpt-5.2-mini (deployment name)' },
    { value: 'gpt-5', label: 'gpt-5 (deployment name)' },
    { value: 'gpt-4.1', label: 'gpt-4.1 (deployment name)' },
    { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini (deployment name)' },
  ],
  aws_bedrock: [
    { value: 'anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'anthropic.claude-sonnet-4-5-20250929-v1:0' },
    { value: 'anthropic.claude-haiku-4-5-20251001-v1:0', label: 'anthropic.claude-haiku-4-5-20251001-v1:0' },
    { value: 'amazon.nova-pro-v1:0', label: 'amazon.nova-pro-v1:0' },
  ],
  together_ai: [
    { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' },
    { value: 'Qwen/Qwen2.5-72B-Instruct-Turbo', label: 'Qwen/Qwen2.5-72B-Instruct-Turbo' },
    { value: 'deepseek-ai/DeepSeek-V3', label: 'deepseek-ai/DeepSeek-V3' },
  ],
  fireworks_ai: [
    { value: 'accounts/fireworks/models/llama-v3p1-70b-instruct', label: 'accounts/fireworks/models/llama-v3p1-70b-instruct' },
    { value: 'accounts/fireworks/models/qwen2p5-72b-instruct', label: 'accounts/fireworks/models/qwen2p5-72b-instruct' },
    { value: 'accounts/fireworks/models/deepseek-v3', label: 'accounts/fireworks/models/deepseek-v3' },
  ],
  huggingface: [
    { value: 'meta-llama/Llama-3.3-70B-Instruct', label: 'meta-llama/Llama-3.3-70B-Instruct' },
    { value: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen/Qwen2.5-72B-Instruct' },
    { value: 'mistralai/Mistral-Small-3.1-24B-Instruct-2503', label: 'mistralai/Mistral-Small-3.1-24B-Instruct-2503' },
  ],
};

export function aiGetModelChoices(provider: string) {
  const key = normalizeText(provider);
  return AI_MODEL_CHOICES_BY_PROVIDER[key] || [];
}

export function aiGetProviderRequirements(provider: string) {
  const key = normalizeText(provider);
  return AI_PROVIDER_REQUIREMENTS[key] || null;
}
