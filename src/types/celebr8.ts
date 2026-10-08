export type Celebr8RsvpStatus = 'going' | 'not_going' | 'maybe' | 'no_reply';

export type Celebr8MessageStatus = 'queued' | 'claimed' | 'sent' | 'failed';

export interface Celebr8Event {
  id: number;
  slug: string;
  title: string;
  theme: string;
  event_date: string;
  event_time: string;
  location: string;
  food: string;
  schedule: string;
  rsvp_deadline: string;
  notes: string;
  created_at: string;
  updated_at: string;
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
