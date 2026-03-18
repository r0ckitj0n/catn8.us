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
  is_case_locked?: number;
  image?: IMysteryImage | string;
  locks?: string[];
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
  data?: any;
  roles_json?: any;
  description?: string;
  items?: any[];
  location_id?: number | string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country?: string;
}

export interface IMasterLocation {
  id: number;
  mystery_id: number;
  slug: string;
  name: string;
  description: string;
  location_id: string;
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
  is_case_locked?: number;
  image?: IMysteryImage | string;
  is_locked?: number;
  data?: any;
  items?: any[];
  roles_json?: any;
}

export interface IMasterWeapon {
  id: number;
  mystery_id: number;
  slug: string;
  name: string;
  description: string;
  fingerprints?: string[];
  is_archived: number;
  is_case_locked?: number;
  image?: IMysteryImage | string;
  is_locked?: number;
  data?: any;
  items?: any[];
  roles_json?: any;
}

export interface IMasterMotive {
  id: number;
  mystery_id: number;
  slug: string;
  name: string;
  description: string;
  is_archived: number;
  is_case_locked?: number;
  image?: IMysteryImage | string;
  is_locked?: number;
  data?: any;
  items?: any[];
  roles_json?: any;
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
  notes: any[];
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
  meta?: Record<string, unknown>;
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
