export type Celebr8RsvpStatus = 'going' | 'not_going' | 'maybe' | 'no_reply';

export type Celebr8RsvpNoteSource = 'text' | 'site' | 'manual';

export type Celebr8MessageStatus = 'queued' | 'claimed' | 'sent' | 'failed';

export type Celebr8InviteSendStatus = 'none' | 'sent' | 'failed';

export interface Celebr8RsvpNote {
  id: number;
  guest_id: number;
  event_id: number;
  party_id?: number;
  status: Celebr8RsvpStatus | string;
  note: string;
  quote: string | null;
  received_at: string;
  source: Celebr8RsvpNoteSource | string;
  message_guid: string | null;
  created_at: string;
}

export interface Celebr8Event {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  theme: string;
  event_date: string;
  event_time: string;
  arrival_time_kids: string;
  arrival_time_adults: string;
  location: string;
  food: string;
  schedule: string;
  rsvp_deadline: string;
  invite_text: string;
  flyer_image_url: string;
  cover_photo_id?: number | null;
  flyer_brief?: string;
  flyer_style_notes?: string;
  notes: string;
  template_id?: number | null;
  starts_on?: string | null;
  is_past?: boolean;
  totals?: {
    going: number;
    maybe: number;
    not_going: number;
    no_reply: number;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface Celebr8TemplateGalleryItem {
  path: string;
  url: string;
  label: string;
  is_suggested: number;
}

export interface Celebr8PartyTemplate {
  id: number;
  slug: string;
  name: string;
  description: string;
  theme: string;
  taglines: string[];
  usual_timing: string;
  food_notes: string;
  byob_notes: string;
  music_playlist: string[];
  hero_image_path: string;
  hero_image_url: string;
  gallery: Celebr8TemplateGalleryItem[];
  past_venue_notes: string;
  default_activity_names: string[];
  is_suggested: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Celebr8ActivitySupplyDetail {
  item: string;
  qty: string;
  unit_cost_est: number | null;
  notes: string;
  have: number;
}

export interface Celebr8ActivityPrintable {
  title: string;
  kind: string;
  content: string;
}

export interface Celebr8Activity {
  id: number;
  name: string;
  preferred_holiday: string;
  party_types: string[];
  category: string;
  description: string;
  ages: string;
  supplies: string[];
  prizes: string | null;
  setup_notes: string;
  source: string;
  is_suggested: number;
  copied_from_activity_id: number | null;
  summary?: string;
  objective?: string;
  how_to_play?: string[];
  setup_instructions?: string[];
  teardown?: string[];
  rules_scoring?: string;
  winning_notes?: string;
  supplies_detail?: Celebr8ActivitySupplyDetail[];
  estimated_cost_low?: number | null;
  estimated_cost_high?: number | null;
  setup_minutes?: number | null;
  play_minutes?: number | null;
  cleanup_minutes?: number | null;
  min_players?: number | null;
  max_players?: number | null;
  age_range?: string;
  kid_friendly?: number;
  location_type?: string;
  space_needed?: string;
  energy_level?: string;
  mess_level?: string;
  tech_needs?: string;
  volunteers_needed?: string;
  safety_notes?: string;
  variations?: Array<string | { title?: string; text?: string }>;
  tips?: string;
  printables?: Celebr8ActivityPrintable[];
  details_filled_at?: string | null;
  details_source?: string;
  senior_friendly?: number;
  seated_play?: number;
  mobility_level?: 'none' | 'low' | 'moderate' | 'high' | string;
  hearing_vision_notes?: string;
  senior_role?: string;
  has_details?: boolean;
  created_at: string;
  updated_at: string;
}

export const CELEBR8_HOLIDAYS = ['Any', 'Halloween', "New Year's Eve", 'Labor Day', 'Birthday', 'Game Night'] as const;

export interface Celebr8EventActivity {
  id: number;
  event_id: number;
  activity_id: number;
  time_slot: string;
  run_by: string;
  prizes: string | null;
  supplies_checklist: Array<{ item: string; done: number }>;
  sort_order: number;
  notes: string;
  activity: Celebr8Activity;
}

export interface Celebr8Guest {
  id: number;
  event_id: number;
  name: string;
  phone: string;
  email: string;
  rsvp_status: Celebr8RsvpStatus | string;
  party_size: number;
  kids_count: number;
  invited_via: string;
  relation_label: string;
  bringing_chili: number;
  bringing: string;
  costume_name?: string;
  checked_in_at?: string | null;
  tabul8_identity_id?: number | null;
  /** 1 when added mid-party (Tabul8 admin or kiosk walk-in). */
  walk_in?: number;
  walk_in_at?: string | null;
  walk_in_board_id?: number | null;
  /** Alias of walk_in for agent/docs clarity. */
  added_at_party?: number;
  phone_unverified: number;
  invite_send_status: Celebr8InviteSendStatus | string;
  invite_send_error: string | null;
  notes: string;
  rsvp_updated_at: string | null;
  rsvp_updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface Celebr8Totals {
  by_status: Record<string, { guest_count: number; headcount: number; kids: number }>;
  total_guests: number;
  total_headcount: number;
  total_kids: number;
  going_headcount: number;
}

export interface Celebr8TextMessage {
  id: number;
  event_id: number;
  guest_id: number | null;
  request_id?: number | null;
  to_address: string;
  body: string;
  status: Celebr8MessageStatus | string;
  claimed_at: string | null;
  claimed_by: string;
  sent_at: string | null;
  failed_at: string | null;
  error_text: string | null;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
}

export type Celebr8RequestStatus =
  | 'pending'
  | 'notified'
  | 'working'
  | 'needs_jon'
  | 'done'
  | 'failed';

export type Celebr8AudienceType = 'none' | 'guests' | 'rsvp' | 'group';

export type Celebr8RequestType = 'text' | 'flyer' | 'rsvp';

export interface Celebr8RsvpInboundMessage {
  guest_id: number;
  phone: string;
  message_guid: string;
  rowid: number;
  date: string;
  text: string;
  is_reaction: boolean;
}

export interface Celebr8Request {
  id: number;
  party_id: number | null;
  party_title?: string;
  request_type?: Celebr8RequestType | string;
  type?: Celebr8RequestType | string;
  request_text: string;
  payload?: Celebr8RsvpInboundMessage[] | unknown[] | null;
  preview?: string;
  show_before_sending: number;
  audience_type: Celebr8AudienceType | string;
  audience_guest_ids: number[];
  audience_rsvp_status: string;
  audience_group_id: number | null;
  status: Celebr8RequestStatus | string;
  created_by_user_id: number | null;
  notify_count: number;
  notified_at: string | null;
  claimed_at: string | null;
  claimed_by: string;
  created_at: string;
  updated_at: string;
}

export interface Celebr8Flyer {
  id: number | null;
  party_id: number;
  version: number;
  is_current: boolean;
  filename: string;
  width: number;
  height: number;
  content_hash: string;
  byte_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
  external_url?: string | null;
  source: 'private' | 'legacy' | 'legacy_archive' | string;
  url?: string;
  original_url?: string;
  url_expires_at?: string | null;
}

export interface Celebr8RequestMessage {
  id: number;
  request_id: number;
  author_role: 'jon' | 'celebr8r' | 'system' | string;
  body: string;
  created_by_user_id: number | null;
  created_at: string;
}

export interface Celebr8GuestGroup {
  id: number;
  event_id: number;
  name: string;
  notes: string;
  guest_ids: number[];
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface Celebr8Album {
  id: number;
  party_id: number;
  title: string;
  cover_photo_id?: number | null;
  cover_url?: string | null;
  photo_count: number;
  created_at: string;
  updated_at: string;
}

export interface Celebr8Photo {
  id: number;
  album_id: number;
  party_id: number;
  filename: string;
  caption: string;
  capture_time: string | null;
  uploaded_at: string;
  source_uuid: string | null;
  width: number;
  height: number;
  content_hash: string;
  byte_size: number;
  mime_type: string;
  uploaded_by: string;
  sort_order: number;
  is_cover?: boolean;
  created_at: string;
  updated_at: string;
  thumb_url?: string;
  url?: string;
  original_url?: string;
  url_expires_at?: string;
}

export interface Celebr8EventsResponse {
  success: boolean;
  events: Celebr8Event[];
  error?: string;
}

export interface Celebr8EventResponse {
  success: boolean;
  event: Celebr8Event;
  totals?: Celebr8Totals;
  error?: string;
}

export interface Celebr8GuestsResponse {
  success: boolean;
  guests: Celebr8Guest[];
  totals: Celebr8Totals;
  error?: string;
}

export interface Celebr8MessagesResponse {
  success: boolean;
  messages: Celebr8TextMessage[];
  error?: string;
}

export interface Celebr8QueueTextsResponse {
  success: boolean;
  queued: Celebr8TextMessage[];
  skipped: Array<{ guest_id: number; name: string; reason: string }>;
  queued_count: number;
  error?: string;
}
