import React from 'react';

import { ApiClient } from '../core/ApiClient';
import {
  Celebr8Event,
  Celebr8EventResponse,
  Celebr8EventsResponse,
  Celebr8Guest,
  Celebr8GuestsResponse,
  Celebr8MessagesResponse,
  Celebr8QueueTextsResponse,
  Celebr8TextMessage,
  Celebr8Totals,
} from '../types/celebr8';
import { IToast } from '../types/common';

function emptyTotals(): Celebr8Totals {
  return {
    by_status: {
      going: { guest_count: 0, headcount: 0, kids: 0 },
      not_going: { guest_count: 0, headcount: 0, kids: 0 },
      maybe: { guest_count: 0, headcount: 0, kids: 0 },
      no_reply: { guest_count: 0, headcount: 0, kids: 0 },
    },
    total_guests: 0,
    total_headcount: 0,
    total_kids: 0,
    going_headcount: 0,
  };
}

export function useCelebr8(enabled: boolean, onToast?: (toast: IToast) => void) {
  const [busy, setBusy] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [events, setEvents] = React.useState<Celebr8Event[]>([]);
  const [event, setEvent] = React.useState<Celebr8Event | null>(null);
  const [guests, setGuests] = React.useState<Celebr8Guest[]>([]);
  const [messages, setMessages] = React.useState<Celebr8TextMessage[]>([]);
  const [totals, setTotals] = React.useState<Celebr8Totals>(emptyTotals());

  const toast = React.useCallback((tone: IToast['tone'], message: string) => {
    onToast?.({ tone, message });
  }, [onToast]);

  const load = React.useCallback(async (preferredEventId?: number) => {
    if (!enabled) return;
    setBusy(true);
    try {
      const eventsRes = await ApiClient.get<Celebr8EventsResponse>('/api/celebr8.php?action=list_events');
      const nextEvents = eventsRes.events || [];
      setEvents(nextEvents);
      const chosenId = preferredEventId
        || event?.id
        || nextEvents.find((e) => e.slug === 'halloween-party-2026')?.id
        || nextEvents[0]?.id
        || 0;
      if (chosenId <= 0) {
        setEvent(null);
        setGuests([]);
        setMessages([]);
        setTotals(emptyTotals());
        setLoaded(true);
        return;
      }
      const [eventRes, guestsRes, messagesRes] = await Promise.all([
        ApiClient.get<Celebr8EventResponse>(`/api/celebr8.php?action=get_event&event_id=${chosenId}`),
        ApiClient.get<Celebr8GuestsResponse>(`/api/celebr8.php?action=list_guests&event_id=${chosenId}`),
        ApiClient.get<Celebr8MessagesResponse>(`/api/celebr8.php?action=list_messages&event_id=${chosenId}`),
      ]);
      setEvent(eventRes.event);
      setGuests(guestsRes.guests || []);
      setTotals(guestsRes.totals || eventRes.totals || emptyTotals());
      setMessages(messagesRes.messages || []);
      setLoaded(true);
    } catch (error: any) {
      console.error('[Celebr8] load failed', error);
      toast('error', error?.message || 'Failed to load Celebr8');
    } finally {
      setBusy(false);
    }
  }, [enabled, event?.id, toast]);

  React.useEffect(() => {
    if (enabled) {
      void load();
    }
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps -- initial load only

  const updateEvent = React.useCallback(async (payload: Partial<Celebr8Event> & { event_id: number }) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Celebr8EventResponse>('/api/celebr8.php?action=update_event', payload);
      setEvent(res.event);
      toast('success', 'Event details saved');
      return res.event;
    } catch (error: any) {
      toast('error', error?.message || 'Failed to save event');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const saveGuest = React.useCallback(async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const action = payload.id ? 'update_guest' : 'create_guest';
      const res = await ApiClient.post<{ success: boolean; guest: Celebr8Guest; totals: Celebr8Totals }>(
        `/api/celebr8.php?action=${action}`,
        payload,
      );
      setTotals(res.totals || emptyTotals());
      await load(Number(payload.event_id || event?.id || 0) || undefined);
      toast('success', payload.id ? 'Guest updated' : 'Guest added');
      return res.guest;
    } catch (error: any) {
      toast('error', error?.message || 'Failed to save guest');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [event?.id, load, toast]);

  const deleteGuest = React.useCallback(async (eventId: number, guestId: number) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; totals: Celebr8Totals }>(
        '/api/celebr8.php?action=delete_guest',
        { event_id: eventId, guest_id: guestId },
      );
      setTotals(res.totals || emptyTotals());
      await load(eventId);
      toast('success', 'Guest removed');
    } catch (error: any) {
      toast('error', error?.message || 'Failed to remove guest');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [load, toast]);

  const queueTexts = React.useCallback(async (payload: {
    event_id: number;
    body: string;
    guest_ids?: number[];
    all_guests?: boolean;
    rsvp_status?: string;
  }) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Celebr8QueueTextsResponse>('/api/celebr8.php?action=queue_texts', payload);
      await load(payload.event_id);
      toast('success', `Queued ${res.queued_count} text${res.queued_count === 1 ? '' : 's'}`);
      return res;
    } catch (error: any) {
      toast('error', error?.message || 'Failed to queue texts');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [load, toast]);

  return {
    busy,
    loaded,
    events,
    event,
    guests,
    messages,
    totals,
    load,
    setEventId: (id: number) => void load(id),
    updateEvent,
    saveGuest,
    deleteGuest,
    queueTexts,
  };
}
