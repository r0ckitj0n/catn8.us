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
  briefing?: string;
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
  is_active?: number;
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
  image?: IMysteryImage | string;
}

export interface IScenarioEntity {
  id: number;
  scenario_id: number;
  entity_id: number;
  role: 'suspect' | 'sheriff' | 'csi_detective' | string;
  override_json: any;
  entity_name?: string;
  slug?: string;
  data?: any;
  data_json?: any;
  roles_json?: string | string[];
  master_agent_id?: number;
  agent_id?: number;
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
  job_action?: string;
  job_spec?: Record<string, unknown>;
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
  entity_name?: string;
  speaker?: string;
  content?: string;
  timestamp?: string;
  created_at?: string;
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
