export interface Tabul8Board {
  id: number;
  party_id: number;
  vote_token: string;
  voting_open: number;
  phone_voting_open: number;
  show_bars: number;
  reveal_winners: number;
  results?: Tabul8Results | null;
  results_saved_at?: string | null;
  kiosk_vote_path: string;
  vote_url_path: string;
  created_at: string;
  updated_at: string;
}

export interface Tabul8Category {
  id: number;
  board_id: number;
  party_id: number;
  name: string;
  /** costume | chili | dish | custom */
  contest_type?: string;
  type?: string;
  sort_order: number;
  voting_open: number;
  voted?: number;
  total_votes?: number | null;
  leader_entry_id?: number | null;
  entries?: Tabul8Entry[];
  created_at?: string;
  updated_at?: string;
}

/** Alias — contests replace the older "categories" concept. */
export type Tabul8Contest = Tabul8Category;

export interface Tabul8Entry {
  id: number;
  board_id: number;
  party_id: number;
  category_id: number;
  contest_id?: number;
  label: string;
  /** person (costume) | thing (chili/dish with owner) */
  entry_kind?: string;
  description: string;
  photo_id?: number | null;
  photo_url?: string | null;
  photo_thumb_url?: string | null;
  guest_id?: number | null;
  owner_guest_id?: number | null;
  sort_order: number;
  label_request_id?: number | null;
  vote_count?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Tabul8Vote {
  id: number;
  board_id: number;
  party_id: number;
  category_id: number;
  entry_id: number;
  embedding_id?: number | null;
  /** Reserved for a future persistent identity table. */
  identity_id?: number | null;
  device_token: string;
  guest_id?: number | null;
  is_void: number;
  created_at: string;
}

export interface Tabul8Results {
  saved_at: string;
  categories: Array<{
    category_id: number;
    name: string;
    total_votes: number;
    winner: {
      entry_id: number;
      label: string;
      description: string;
      photo_id?: number | null;
      votes: number;
    } | null;
    entries: Array<{
      entry_id: number;
      label: string;
      description: string;
      photo_id?: number | null;
      votes: number;
    }>;
  }>;
}

export interface Tabul8BoardParticipant {
  id: number;
  board_id: number;
  party_id: number;
  guest_id: number;
  is_active: number;
  name: string;
  phone: string;
  email: string;
  rsvp_status: string;
  walk_in: number;
  walk_in_at?: string | null;
  walk_in_board_id?: number | null;
  costume_name?: string;
  checked_in_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const TABUL8_FACE_NOTICE = 'We use a quick face check so everyone votes once.';
