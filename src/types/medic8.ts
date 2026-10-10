export type Medic8Entity =
  | 'people'
  | 'providers'
  | 'medications'
  | 'med_fills'
  | 'appointments'
  | 'conditions'
  | 'allergies'
  | 'labs'
  | 'procedures'
  | 'encounters'
  | 'disability_events'
  | 'insurance'
  | 'documents'
  | 'portal_messages'
  | 'invoices'
  | 'sources'
  | 'shares';

export type Medic8Person = {
  id: number;
  catn8_user_id?: number | null;
  owner_user_id: number;
  display_name: string;
  relation_to_admin?: string | null;
  dob?: string | null;
  sensitivity_default?: string | null;
  is_opted_in?: number;
};

export type Medic8Source = {
  id?: number;
  source_type?: string;
  account?: string | null;
  thread_id?: string | null;
  message_id?: string | null;
  message_date?: string | null;
  file_path?: string | null;
  record_type?: string | null;
  record_id?: string | null;
  note?: string | null;
};

export type Medic8Record = Record<string, unknown> & {
  id?: number;
  person_id?: number;
  source?: Medic8Source | null;
  source_ref_id?: number | null;
};

export type Medic8Dashboard = {
  person: Medic8Person;
  medications_current: Medic8Record[];
  refills_due_14d: Medic8Record[];
  conditions: Medic8Record[];
  allergies: Medic8Record[];
  appointments_upcoming: Medic8Record[];
  providers: Medic8Record[];
  labs_recent: Medic8Record[];
  lab_trends: Record<string, Array<{ taken_at?: string | null; value?: string | null; unit?: string | null; flag?: string | null }>>;
  procedures: Medic8Record[];
  encounters: Medic8Record[];
  insurance: Medic8Record[];
  disability_events: Medic8Record[];
  documents: Medic8Record[];
  portal_messages: Medic8Record[];
  invoices: Medic8Record[];
};

export type Medic8BootstrapResponse = {
  success: boolean;
  people: Medic8Person[];
  is_admin: number;
  entities: string[];
  error?: string;
};

export type Medic8DashboardResponse = {
  success: boolean;
  dashboard: Medic8Dashboard;
  error?: string;
};

export type Medic8EmergencySummary = {
  person: Medic8Person;
  allergies: Medic8Record[];
  conditions: Medic8Record[];
  medications_current: Medic8Record[];
  providers: Medic8Record[];
  insurance: Medic8Record[];
  generated_at: string;
};
