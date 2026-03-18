export interface IWordsearchPuzzle {
  id: number;
  owner_user_id: number;
  title: string;
  topic_id: number;
  grid_size: number;
  difficulty: string;
  pages_count: number;
  created_at: string;
  updated_at: string;
}

export interface IWordsearchPuzzlePage {
  id: number;
  puzzle_id: number;
  page_number: number;
  description_text: string;
  summary_text: string;
  created_at: string;
  updated_at: string;
}

export interface IWordsearchTopic {
  id: number;
  title: string;
  words_per_page: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface IMysteryImage {
  title?: string;
  url: string;
  alt_text?: string;
  prompt_text?: string;
  negative_prompt_text?: string;
  provider?: string;
  model?: string;
}

export interface ITtsVoice {
  voice_name: string;
  display_name?: string;
  language_code?: string;
  ssml_gender?: string;
}

export interface IAgentProfile {
  id: number;
  agent_id: number;
  name: string;
  role: string;
  description?: string;
  is_archived: number;
}

export interface IAgentImagesResponse {
  success: boolean;
  ir_urls?: string[];
  [key: string]: unknown;
}

export type InterrogationStatus = 'idle' | 'connecting' | 'connected' | 'setup_complete' | 'streaming' | 'ready' | 'interrupted' | 'closed';

export interface ISuspect {
  id: string | number;
  voice_id: string;
  accent_prompt: string;
}
