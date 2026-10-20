export type Rel8edPerson = {
  id: number;
  name_display?: string;
  name_given?: string | null;
  name_surname?: string | null;
  sex?: string | null;
  birth_date_raw?: string | null;
  birth_place?: string | null;
  death_date_raw?: string | null;
  death_place?: string | null;
  is_living?: number;
  is_private?: number;
  has_sources?: number;
  sourced_badge?: 'sourced' | 'unsourced';
  events?: Rel8edEvent[];
  citations?: Rel8edCitation[];
  notes?: Rel8edNote[];
  media?: Rel8edMedia[];
  names?: Array<Record<string, unknown>>;
  child_of_families?: Array<Record<string, unknown>>;
  spouse_families?: Array<Record<string, unknown>>;
  attributes?: Array<Record<string, unknown>>;
};

export type Rel8edEvent = {
  id?: number;
  tag?: string;
  type_label?: string | null;
  date_raw?: string | null;
  place?: string | null;
  description?: string | null;
  has_sources?: number;
};

export type Rel8edCitation = {
  id?: number;
  page?: string | null;
  quality?: string | null;
  source_title?: string | null;
  note?: string | null;
};

export type Rel8edNote = {
  id?: number;
  title?: string | null;
  body?: string;
  is_story?: number;
  person_id?: number | null;
  name_display?: string | null;
};

export type Rel8edMedia = {
  id: number;
  title?: string | null;
  file_name?: string | null;
  mime?: string | null;
  media_type?: string | null;
  media_url?: string;
  person_id?: number | null;
  name_display?: string | null;
  size_bytes?: number;
};

export type Rel8edPedigreeNode = {
  id: number;
  name: string;
  birth?: string | null;
  death?: string | null;
  sex?: string | null;
  ahnentafel?: number;
  generation?: number;
  has_sources?: number;
  father?: Rel8edPedigreeNode | null;
  mother?: Rel8edPedigreeNode | null;
};

export type Rel8edDnaRegion = {
  id?: number;
  parent_region_id?: number | null;
  region_name: string;
  percent: number;
  sort_order?: number;
};

export type Rel8edDashboard = {
  is_admin?: number;
  can_view_living?: number;
  tree?: { id?: number; title?: string; root_person_id?: number | null };
  counts?: {
    people?: number;
    families?: number;
    sources?: number;
    media?: number;
    quality_flags?: number;
  };
  on_this_day?: Rel8edPerson[];
  recent_people?: Rel8edPerson[];
  surname_preview?: Array<{ surname: string; person_count: number }>;
};

export type Rel8edImportPreview = {
  import_id: number;
  sha256?: string;
  counts?: Record<string, number>;
  diff?: {
    people_added?: number;
    people_removed?: number;
    people_changed?: number;
    families_added?: number;
    families_removed?: number;
    summary?: Record<string, unknown>;
  };
};

export type Rel8edPlace = {
  id: number;
  place_name: string;
  event_count: number;
  lat?: number | null;
  lng?: number | null;
  geocode_status?: string;
};
