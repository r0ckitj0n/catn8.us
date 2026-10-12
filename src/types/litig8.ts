export type Litig8Entity =
  | 'matters'
  | 'events'
  | 'deadlines'
  | 'contacts'
  | 'matter_contacts'
  | 'documents'
  | 'sources'
  | 'categories';

export type Litig8Record = Record<string, unknown> & {
  id?: number;
  title?: string;
  name?: string;
  status?: string;
  category_slug?: string;
  matter_id?: number;
  due_at?: string;
  event_date?: string;
  is_overdue?: boolean;
  contact_type?: string;
  media_url?: string;
  documents?: Array<{
    id: number;
    title?: string;
    doc_type?: string;
    media_url?: string;
    link_role?: string;
    link_note?: string;
  }>;
  links?: Array<Record<string, unknown>>;
  source?: {
    source_type?: string;
    account?: string;
    record_type?: string;
    record_id?: string;
    message_date?: string;
    file_path?: string;
  };
};

export type Litig8Dashboard = {
  upcoming_deadlines: Litig8Record[];
  open_matters_by_category: Record<string, number>;
  recent_events: Litig8Record[];
  matters_total: number;
  events_total: number;
  deadlines_total: number;
  contacts_total: number;
  documents_total: number;
  categories: Litig8Record[];
};

export type Litig8BootstrapResponse = {
  success: boolean;
  is_admin?: number;
  entities?: string[];
  categories?: Litig8Record[];
  error?: string;
};

export type Litig8DashboardResponse = {
  success: boolean;
  dashboard?: Litig8Dashboard;
  error?: string;
};
