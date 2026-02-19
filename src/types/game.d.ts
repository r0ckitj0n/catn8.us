/**
 * TypeScript Interfaces for Mystery Game and Core System.
 * Matches the Single Source of Truth database schema defined in src/data/database_schema.md,
 * supplemented with UI-specific properties returned by API loaders.
 * 
 * Note: Database uses snake_case; frontend interfaces use snake_case for direct API compatibility.
 */

// --- Core System ---

export interface IUser {
  id: number;
  username: string;
  email: string;
  password_hash?: string;
  is_admin: number; // 0 or 1
  is_active: number; // 0 or 1
  email_verified: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface IGroup {
  id: number;
  slug: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ISecret {
  id: number;
  key: string;
  value_enc: string;
  created_at: string;
  updated_at: string;
}

// --- Mystery Game ---

export interface IMystery {
  id: number;
  owner_user_id: number;
  slug: string;
  title: string;
  settings_json: string | IMysterySettings;
  is_archived: number;
  updated_at: string;
}

export interface IMysterySettings {
  tts?: {
    language_code?: string;
    voice_map_active?: 'google' | 'live';
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ICase {
  id: number;
  owner_user_id: number;
  mystery_id: number;
  backstory_id: number;
  slug: string;
  title: string;
  description: string;
  is_template: number;
  is_archived: number;
  briefing?: string; // UI alias for description in some contexts
}

export interface IScenario {
  id: number;
  game_id: number;
  backstory_id: number;
  slug: string;
  title: string;
  status: string;
  specs_json: any;
  constraints_json: any;
  briefing_text: string;
  csi_report_text: string;
  csi_report_json: any;
  csi_detective_entity_id: number | null;
  crime_scene_location?: string;
  crime_scene_location_id?: number | null;
  crime_scene_location_master_id?: number | null;
  crime_scene_weapon: string;
  crime_scene_motive: string;
  created_at: string;
  updated_at: string;
  is_active?: number; // UI state helper
}

export interface IEntity {
  id: number;
  game_id: number;
  entity_type: 'character' | 'location' | 'weapon' | 'motive' | string;
  slug: string;
  name: string;
  data_json: any;
  roles_json: string | string[];
  accent_preference: string;
  is_archived: number;
  created_at: string;
  updated_at: string;
  image?: IMysteryImage | string; // Derived
}

export interface IScenarioEntity {
  id: number;
  scenario_id: number;
  entity_id: number;
  role: 'suspect' | 'sheriff' | 'csi_detective' | string;
  override_json: any;
  entity_name?: string; // UI Join
  slug?: string; // UI Join
  data?: any; // UI Join
  data_json?: any; // UI Join
  roles_json?: string | string[]; // UI Join
  master_agent_id?: number; // UI Join
  agent_id?: number; // UI Join
}

export interface ILie {
  id: number;
  scenario_id: number;
  entity_id: number;
  lie_type: string;
  topic_key: string;
  lie_text: string;
  truth_text: string;
  trigger_questions_json: string[];
  relevance: string;
  notes: string;
}

export interface IDeposition {
  id: number;
  scenario_id: number;
  entity_id: number;
  deposition_text: string;
  created_at: string;
  updated_at: string;
}

export interface IMurderer {
  id: number;
  scenario_id: number;
  entity_id: number;
}

export interface IColdHardFacts {
  id: number;
  scenario_id: number;
  facts_json: Record<string, unknown>;
  annotations_json: Record<string, unknown>[];
}

export interface IRunSession {
  id: number;
  case_id: number;
  scenario_id: number;
  owner_user_id: number;
  status: 'active' | string;
  run_settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IJob {
  id: number;
  game_id: number;
  scenario_id: number | null;
  entity_id: number | null;
  action: string;
  spec_json: Record<string, unknown>;
  status: 'queued' | 'running' | 'done' | 'error' | 'failed' | 'canceled';
  result_json: Record<string, unknown>;
  result?: any;
  created_at: string;
  updated_at: string;
  error_text?: string;
  job_action?: string; // UI Alias
  job_spec?: Record<string, unknown>; // UI Alias
}

export interface IInterrogationEvent {
  id: number;
  scenario_id: number;
  entity_id: number;
  question_text: string;
  answer_text: string;
  meta_json: Record<string, unknown>;
  asked_at: string;
}

export interface IConversationEvent {
  id: number;
  scenario_id: number;
  entity_id: number;
  channel: string;
  provider: string;
  role: string;
  content_text: string;
  meta_json: any;
  entity_name?: string; // UI Join
  speaker?: string; // UI Join
  content?: string; // UI Alias for content_text
  timestamp?: string; // UI Alias for asked_at or created_at
  created_at?: string; // UI Alias
}

export interface ICaseNote {
  id: number;
  scenario_id: number;
  title: string;
  note_type: 'detective_note' | string;
  content_rich_json: Record<string, unknown>;
  clue_count: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

export interface IBackstory {
  id: number;
  mystery_id: number;
  owner_user_id: number;
  slug: string;
  title: string;
  backstory_summary: string;
  backstory_text: string;
  location_master_id: number | null;
  meta_json: Record<string, unknown>;
  spawned_case_id: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

export interface IMasterCharacter {
  id: number;
  mystery_id: number;
  slug: string;
  name: string;
  agent_id: number;
  is_law_enforcement: number;
  voice_profile_id: number | null;
  character_image_path: string;
  image_path: string;
  dob: string | null;
  age: number;
  hometown: string;
  address: string;
  aliases_json: string[];
  ethnicity: string;
  zodiac: string;
  mbti: string;
  height: string;
  weight: string;
  eye_color: string;
  hair_color: string;
  distinguishing_marks: string;
  education: string;
  employment_json: Record<string, unknown>[];
  criminal_record: string;
  fav_color: string;
  fav_snack: string;
  fav_drink: string;
  fav_music: string;
  fav_hobby: string;
  fav_pet: string;
  rapport_likes_json?: string[];
  rapport_dislikes_json?: string[];
  rapport_quirks_json?: string[];
  rapport_fun_facts_json?: string[];
  rapport_json?: any;
  favorites_json?: any;
  voice_id: string;
  is_archived: number;
  is_regen_locked: number;
  is_case_locked?: number; // UI derived state
  image?: IMysteryImage | string; // Derived
  locks?: string[]; // Derived
  rapport?: {
    likes: string[];
    dislikes: string[];
    quirks: string[];
    fun_facts: string[];
  };
  favorites?: {
    color: string;
    snack: string;
    drink: string;
    music: string;
    hobby: string;
    pet: string;
  };
  data?: any; // UI/Join wrapper
  roles_json?: any; // Join from entity
  description?: string; // For union compatibility
  items?: any[]; // For union compatibility
  location_id?: number | string; // For union compatibility
  address_line1?: string; // For union compatibility
  address_line2?: string; // For union compatibility
  city?: string; // For union compatibility
  region?: string; // For union compatibility
  postal_code?: string; // For union compatibility
  country?: string; // For union compatibility
}

export interface IMasterLocation {
  id: number;
  mystery_id: number;
  slug: string;
  name: string;
  description: string;
  location_id: string; // Changed from number to string to match usage
  address_line1: string;
  address_line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  base_image_prompt?: string;
  overlay_asset_prompt?: string;
  overlay_trigger?: string;
  is_archived: number;
  is_case_locked?: number; // UI state
  image?: IMysteryImage | string; // Derived
  is_locked?: number; // UI state
  data?: any; // UI/Join wrapper
  items?: any[]; // Join from entity
  roles_json?: any; // For union compatibility
}

export interface IMasterWeapon {
  id: number;
  mystery_id: number;
  slug: string;
  name: string;
  description: string;
  fingerprints?: string[]; // Added
  is_archived: number;
  is_case_locked?: number; // UI state
  image?: IMysteryImage | string; // Derived
  is_locked?: number; // UI state
  data?: any; // UI/Join wrapper
  items?: any[]; // Join from entity
  roles_json?: any; // For union compatibility
}

export interface IMasterMotive {
  id: number;
  mystery_id: number;
  slug: string;
  name: string;
  description: string;
  is_archived: number;
  is_case_locked?: number; // UI state
  image?: IMysteryImage | string; // Derived
  is_locked?: number; // UI state
  data?: any; // UI/Join wrapper
  items?: any[]; // For union compatibility
  roles_json?: any; // For union compatibility
}

export interface IVoiceProfile {
  id: number;
  display_name: string;
  notes: string;
  provider: string;
  language_code: string;
  ssml_gender: string;
}

export interface IEvidence {
  id: number;
  scenario_id: number;
  notes: any[]; // Derived UI field (joined or parsed)
  is_archived: number;
  slug?: string;
  title?: string;
  description?: string;
  image_url?: string;
  type?: string;
}

export interface IRapSheet {
  id: number;
  scenario_id: number;
  entity_id: number;
  content_text: string;
  created_at: string;
  updated_at: string;
}

export interface IStoryBookEntry {
  id: number;
  owner_user_id: number;
  slug: string;
  title: string;
  theme: string;
  source_text: string;
  meta_json: Record<string, unknown>;
  is_archived: number;
  created_at: string;
  updated_at: string;
  meta?: Record<string, unknown>; // UI Alias
}

export interface IStandaloneWeapon {
  id: number;
  slug: string;
  name: string;
  description: string;
  is_archived: number;
}

export interface IStandaloneMotive {
  id: number;
  slug: string;
  name: string;
  description: string;
  is_archived: number;
}

export interface IStandaloneLocation {
  id: number;
  slug: string;
  name: string;
  description: string;
  location_id: number;
  address_line1: string;
  address_line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  is_archived: number;
}

// --- Wordsearch ---

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

// --- UI / Helper Types ---

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



