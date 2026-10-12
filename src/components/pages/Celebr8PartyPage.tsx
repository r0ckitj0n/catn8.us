import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import { useCelebr8 } from '../../hooks/useCelebr8';
import { useBrandedConfirm } from '../../hooks/useBrandedConfirm';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import {
  CELEBR8_HOLIDAYS,
  Celebr8Activity,
  Celebr8EventActivity,
  Celebr8Guest,
  Celebr8GuestGroup,
  Celebr8RsvpStatus,
} from '../../types/celebr8';
import { Celebr8AskPanel } from '../celebr8/Celebr8AskPanel';
import { Celebr8SubNav } from '../celebr8/Celebr8SubNav';
import { PageLayout } from '../layout/PageLayout';
import './Celebr8Page.css';

const RSVP_OPTIONS: Array<{ value: Celebr8RsvpStatus; label: string }> = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_going', label: "Can't go" },
  { value: 'no_reply', label: 'No reply' },
];

function partyIdFromPath(): number {
  if (typeof window === 'undefined') return 0;
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const last = parts[parts.length - 1];
  const fromPath = Number(last);
  if (Number.isFinite(fromPath) && fromPath > 0) return fromPath;
  return Number(new URLSearchParams(window.location.search).get('id') || 0) || 0;
}

type GuestDraft = {
  id?: number;
  name: string;
  phone: string;
  email: string;
  rsvp_status: Celebr8RsvpStatus;
  party_size: number;
  kids_count: number;
  invited_via: string;
  relation_label: string;
  bringing_chili: number;
  bringing: string;
  phone_unverified: number;
  notes: string;
};

function blankGuest(): GuestDraft {
  return {
    name: '', phone: '', email: '', rsvp_status: 'no_reply', party_size: 1, kids_count: 0,
    invited_via: '', relation_label: '', bringing_chili: 0, bringing: '', phone_unverified: 0, notes: '',
  };
}

function guestToDraft(guest: Celebr8Guest): GuestDraft {
  return {
    id: guest.id,
    name: guest.name,
    phone: guest.phone,
    email: guest.email,
    rsvp_status: (guest.rsvp_status as Celebr8RsvpStatus) || 'no_reply',
    party_size: guest.party_size || 1,
    kids_count: guest.kids_count || 0,
    invited_via: guest.invited_via || '',
    relation_label: guest.relation_label || '',
    bringing_chili: Number(guest.bringing_chili || 0),
    bringing: guest.bringing || '',
    phone_unverified: Number(guest.phone_unverified || 0),
    notes: guest.notes || '',
  };
}

export function Celebr8PartyPage({
  viewer,
  onLoginClick,
  onLogout,
  onAccountClick,
  mysteryTitle,
  onToast,
}: AppShellPageProps) {
  const isAuthed = Boolean(viewer?.id);
  const isAdmin = (
    Number(viewer?.is_admin || 0) === 1
    || Number(viewer?.is_administrator || 0) === 1
    || String(viewer?.username || '').toLowerCase() === 'admin'
  );
  const eventId = partyIdFromPath();
  const {
    busy, loaded, event, guests, messages, totals, load, updateEvent, saveGuest, deleteGuest, queueTexts,
  } = useCelebr8(isAuthed, onToast, eventId);
  const { confirm, confirmDialog } = useBrandedConfirm();

  const [eventActivities, setEventActivities] = React.useState<Celebr8EventActivity[]>([]);
  const [library, setLibrary] = React.useState<Celebr8Activity[]>([]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerQ, setPickerQ] = React.useState('');
  const [pickerHoliday, setPickerHoliday] = React.useState('');
  const [pickerCategory, setPickerCategory] = React.useState('');
  const [editingParty, setEditingParty] = React.useState(false);
  const [detailsDraft, setDetailsDraft] = React.useState<Record<string, string>>({});
  const [guestDraft, setGuestDraft] = React.useState<GuestDraft | null>(null);
  const [textBody, setTextBody] = React.useState('');
  const [textOpen, setTextOpen] = React.useState(false);
  const [exactGuestId, setExactGuestId] = React.useState<number | ''>('');
  const [groups, setGroups] = React.useState<Celebr8GuestGroup[]>([]);
  const [groupDraft, setGroupDraft] = React.useState<{ id?: number; name: string; guest_ids: number[] } | null>(null);
  const [guestGroupIds, setGuestGroupIds] = React.useState<number[]>([]);
  const [eaEdit, setEaEdit] = React.useState<Celebr8EventActivity | null>(null);
  const [copiedEdit, setCopiedEdit] = React.useState<Celebr8Activity | null>(null);

  React.useEffect(() => {
    if (eventId > 0) void load(eventId);
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshActivities = React.useCallback(async (id: number) => {
    const res = await ApiClient.get<{ success: boolean; activities: Celebr8EventActivity[] }>(
      `/api/celebr8.php?action=list_event_activities&event_id=${id}`,
    );
    setEventActivities(res.activities || []);
  }, []);

  const refreshGroups = React.useCallback(async (id: number) => {
    const res = await ApiClient.get<{ success: boolean; groups: Celebr8GuestGroup[] }>(
      `/api/celebr8.php?action=list_guest_groups&event_id=${id}`,
    );
    setGroups(res.groups || []);
  }, []);

  React.useEffect(() => {
    if (event?.id) {
      void refreshActivities(event.id);
      void refreshGroups(event.id);
    }
  }, [event?.id, refreshActivities, refreshGroups]);

  React.useEffect(() => {
    if (!event) return;
    setDetailsDraft({
      title: event.title,
      tagline: event.tagline || '',
      event_date: event.event_date,
      event_time: event.event_time,
      arrival_time_kids: event.arrival_time_kids || '',
      arrival_time_adults: event.arrival_time_adults || '',
      location: event.location,
      notes: event.notes || '',
      food: event.food || '',
      invite_text: event.invite_text || '',
      flyer_image_url: event.flyer_image_url || '',
    });
    if (event.invite_text && !textBody) setTextBody(event.invite_text);
  }, [event]); // eslint-disable-line react-hooks/exhaustive-deps

  const openPicker = async () => {
    const res = await ApiClient.get<{ success: boolean; activities: Celebr8Activity[] }>(
      '/api/celebr8.php?action=list_activities',
    );
    setLibrary(res.activities || []);
    setPickerOpen(true);
  };

  const attachedIds = new Set(eventActivities.map((ea) => ea.activity_id));
  const pickerList = library.filter((a) => {
    if (attachedIds.has(a.id)) return false;
    if (pickerHoliday && a.preferred_holiday !== pickerHoliday) return false;
    if (pickerCategory && a.category !== pickerCategory) return false;
    const q = pickerQ.trim().toLowerCase();
    if (!q) return true;
    return `${a.name} ${a.description} ${a.preferred_holiday}`.toLowerCase().includes(q);
  });

  const attach = async (activityId: number) => {
    if (!event) return;
    await ApiClient.post('/api/celebr8.php?action=attach_event_activity', {
      event_id: event.id,
      activity_id: activityId,
      sort_order: eventActivities.length,
    });
    await refreshActivities(event.id);
    onToast?.({ tone: 'success', message: 'Activity added' });
  };

  const copyInParty = async (ea: Celebr8EventActivity) => {
    if (!event) return;
    const res = await ApiClient.post<{ success: boolean; activity: Celebr8Activity; event_activity: Celebr8EventActivity }>(
      '/api/celebr8.php?action=copy_event_activity',
      { event_id: event.id, event_activity_id: ea.id },
    );
    await refreshActivities(event.id);
    setCopiedEdit(res.activity);
    onToast?.({ tone: 'success', message: 'Copied into the library and this party' });
  };

  if (!isAuthed) {
    return (
      <PageLayout page="celebr8_party" title="CELEBR8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
        <section className="section celebr8-page">
          <div className="container">
            <div className="celebr8-hero"><h1>CELEBR8</h1><p>Sign in to view this party.</p></div>
            <button type="button" className="btn btn-primary" onClick={onLoginClick}>Log in</button>
          </div>
        </section>
      </PageLayout>
    );
  }

  return (
    <PageLayout page="celebr8_party" title="CELEBR8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section celebr8-page">
        <div className="container celebr8-party-layout">
          <Celebr8SubNav active="parties" />
          {!loaded || !event ? (
            <div className="celebr8-panel">{loaded ? 'Party not found.' : 'Loading party…'}</div>
          ) : (
            <>
              <div className="celebr8-party-cover">
                {event.flyer_image_url ? <img src={event.flyer_image_url} alt="" /> : <div className="celebr8-party-card-placeholder" />}
              </div>
              <header className="celebr8-party-header">
                <div>
                  <h1>{event.title}</h1>
                  {event.tagline ? <p className="celebr8-tagline">{event.tagline}</p> : null}
                </div>
                {isAdmin ? (
                  <div className="celebr8-toolbar">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditingParty(true)}>Edit</button>
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setTextOpen(true)}>Send exact text</button>
                  </div>
                ) : null}
              </header>

              <div className="celebr8-party-facts">
                <div><span>When</span><strong>{event.event_date || 'TBD'}</strong>
                  {event.arrival_time_kids || event.arrival_time_adults || event.event_time ? (
                    <em>{[event.arrival_time_kids, event.arrival_time_adults, !event.arrival_time_kids && !event.arrival_time_adults ? event.event_time : ''].filter(Boolean).join(' · ')}</em>
                  ) : null}
                </div>
                <div><span>Where</span><strong>{event.location || 'TBD'}</strong></div>
              </div>

              {(event.notes || event.food) ? (
                <div className="celebr8-panel">
                  {event.notes ? <p style={{ whiteSpace: 'pre-wrap' }}>{event.notes}</p> : null}
                  {event.food ? <><h2 className="h6">Food</h2><p style={{ whiteSpace: 'pre-wrap' }}>{event.food}</p></> : null}
                </div>
              ) : null}

              <div className="celebr8-rsvp-row">
                <div><strong>{totals.by_status?.going?.guest_count || 0}</strong><span>Going</span></div>
                <div><strong>{totals.by_status?.maybe?.guest_count || 0}</strong><span>Maybe</span></div>
                <div><strong>{totals.by_status?.not_going?.guest_count || 0}</strong><span>Can&apos;t go</span></div>
                <div><strong>{totals.by_status?.no_reply?.guest_count || 0}</strong><span>No reply</span></div>
              </div>

              <Celebr8AskPanel
                isAdmin={isAdmin}
                partyId={event.id}
                guests={guests}
                groups={groups}
                onToast={onToast}
              />

              <div className="celebr8-panel">
                <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                  <h2 className="h5 mb-0">Guests</h2>
                  {isAdmin ? (
                    <div className="celebr8-toolbar">
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setGroupDraft({ name: '', guest_ids: [] })}>Groups</button>
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => { setGuestDraft(blankGuest()); setGuestGroupIds([]); }}>Add guest</button>
                    </div>
                  ) : null}
                </div>
                {groups.length > 0 ? (
                  <p className="small text-muted mb-2">
                    Groups: {groups.map((g) => `${g.name} (${g.member_count})`).join(' · ')}
                  </p>
                ) : null}
                <ul className="celebr8-guest-chips">
                  {guests.length === 0 ? <li className="text-muted">No guests yet.</li> : guests.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        className={`celebr8-guest-chip celebr8-status-${g.rsvp_status}`}
                        onClick={() => {
                          if (!isAdmin) return;
                          setGuestDraft(guestToDraft(g));
                          setGuestGroupIds(groups.filter((gr) => gr.guest_ids.includes(g.id)).map((gr) => gr.id));
                        }}
                      >
                        {g.name}
                        <small>{g.rsvp_status.replace('_', ' ')}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="celebr8-panel">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h2 className="h5 mb-0">Activities</h2>
                  {isAdmin ? <button type="button" className="btn btn-sm btn-primary" onClick={() => void openPicker()}>Add activities</button> : null}
                </div>
                {eventActivities.length === 0 ? (
                  <p className="text-muted mb-0">None yet — pick from the shared library. Any activity can go in any party.</p>
                ) : (
                  <ul className="celebr8-event-activities">
                    {eventActivities.map((ea) => (
                      <li key={ea.id}>
                        <strong>{ea.activity?.name}</strong>
                        {ea.activity?.preferred_holiday ? <span className="celebr8-flag ms-1">{ea.activity.preferred_holiday}</span> : null}
                        {ea.time_slot ? <span className="celebr8-flag ms-1">{ea.time_slot}</span> : null}
                        <div className="small text-muted">{ea.activity?.description}</div>
                        {ea.run_by ? <div className="small">Run by: {ea.run_by}</div> : null}
                        {ea.prizes ? <div className="small">Prizes: {ea.prizes}</div> : null}
                        {ea.supplies_checklist?.length ? (
                          <ul className="small mb-1">
                            {ea.supplies_checklist.map((s, i) => <li key={i}>{Number(s.done) === 1 ? '✓' : '○'} {s.item}</li>)}
                          </ul>
                        ) : null}
                        {isAdmin ? (
                          <div className="celebr8-toolbar mt-1">
                            <button type="button" className="btn btn-link btn-sm px-0" onClick={() => setEaEdit(ea)}>Details</button>
                            <button type="button" className="btn btn-link btn-sm" onClick={() => void copyInParty(ea)}>Copy &amp; edit</button>
                            <button
                              type="button"
                              className="btn btn-link btn-sm text-danger"
                              onClick={() => {
                                void (async () => {
                                  await ApiClient.post('/api/celebr8.php?action=detach_event_activity', {
                                    event_id: event.id, event_activity_id: ea.id,
                                  });
                                  await refreshActivities(event.id);
                                })();
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {pickerOpen ? (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.45)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5">Add activities</h2>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setPickerOpen(false)} />
              </div>
              <div className="modal-body">
                <p className="small text-muted">The whole library is available. Preferred holiday is only a filter.</p>
                <div className="celebr8-toolbar mb-2">
                  <input className="form-control" placeholder="Search" value={pickerQ} onChange={(e) => setPickerQ(e.target.value)} />
                  <select className="form-select" value={pickerHoliday} onChange={(e) => setPickerHoliday(e.target.value)}>
                    <option value="">All holidays</option>
                    {CELEBR8_HOLIDAYS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select className="form-select" value={pickerCategory} onChange={(e) => setPickerCategory(e.target.value)}>
                    <option value="">All categories</option>
                    {['contest', 'music', 'food', 'game', 'kids', 'other'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <ul className="celebr8-picker-list">
                  {pickerList.map((a) => (
                    <li key={a.id}>
                      <div>
                        <strong>{a.name}</strong>
                        <span className="celebr8-flag ms-1">{a.preferred_holiday || 'Any'}</span>
                        <div className="small text-muted">{a.description}</div>
                      </div>
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => void attach(a.id)}>Add</button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingParty && event ? (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.45)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5">Edit party</h2>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setEditingParty(false)} />
              </div>
              <div className="modal-body">
                {(['title', 'tagline', 'event_date', 'arrival_time_kids', 'arrival_time_adults', 'event_time', 'location', 'flyer_image_url'] as const).map((key) => (
                  <div className="mb-2" key={key}>
                    <label className="form-label text-capitalize">{key.replaceAll('_', ' ')}</label>
                    <input className="form-control" value={detailsDraft[key] || ''} onChange={(e) => setDetailsDraft((d) => ({ ...d, [key]: e.target.value }))} />
                  </div>
                ))}
                <div className="mb-2">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={3} value={detailsDraft.notes || ''} onChange={(e) => setDetailsDraft((d) => ({ ...d, notes: e.target.value }))} />
                </div>
                <div className="mb-0">
                  <label className="form-label">Food</label>
                  <textarea className="form-control" rows={2} value={detailsDraft.food || ''} onChange={(e) => setDetailsDraft((d) => ({ ...d, food: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setEditingParty(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void updateEvent({ event_id: event.id, ...detailsDraft }).then(() => setEditingParty(false))}>Save</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {eaEdit && event ? (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.45)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5">{eaEdit.activity?.name}</h2>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setEaEdit(null)} />
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label">Time slot</label>
                  <input className="form-control" value={eaEdit.time_slot} onChange={(e) => setEaEdit({ ...eaEdit, time_slot: e.target.value })} placeholder="6 PM little bats" />
                </div>
                <div className="mb-2">
                  <label className="form-label">Who runs it</label>
                  <input className="form-control" value={eaEdit.run_by} onChange={(e) => setEaEdit({ ...eaEdit, run_by: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="form-label">Prizes</label>
                  <input className="form-control" value={eaEdit.prizes || ''} onChange={(e) => setEaEdit({ ...eaEdit, prizes: e.target.value })} />
                </div>
                <div className="mb-0">
                  <label className="form-label">Supplies</label>
                  {(eaEdit.supplies_checklist || []).map((s, i) => (
                    <label key={i} className="form-check d-block">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={Number(s.done) === 1}
                        onChange={(e) => {
                          const next = [...(eaEdit.supplies_checklist || [])];
                          next[i] = { ...s, done: e.target.checked ? 1 : 0 };
                          setEaEdit({ ...eaEdit, supplies_checklist: next });
                        }}
                      />
                      <span className="form-check-label">{s.item}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setEaEdit(null)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    void (async () => {
                      await ApiClient.post('/api/celebr8.php?action=update_event_activity', {
                        event_id: event.id,
                        event_activity_id: eaEdit.id,
                        time_slot: eaEdit.time_slot,
                        run_by: eaEdit.run_by,
                        prizes: eaEdit.prizes,
                        supplies_checklist: eaEdit.supplies_checklist,
                        notes: eaEdit.notes,
                        sort_order: eaEdit.sort_order,
                      });
                      await refreshActivities(event.id);
                      setEaEdit(null);
                    })();
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {copiedEdit ? (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.45)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5">Edit copy</h2>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setCopiedEdit(null)} />
              </div>
              <div className="modal-body">
                <p className="small text-muted">Copied from activity #{copiedEdit.copied_from_activity_id}. Re-theme it however you like.</p>
                <div className="mb-2">
                  <label className="form-label">Name</label>
                  <input className="form-control" value={copiedEdit.name} onChange={(e) => setCopiedEdit({ ...copiedEdit, name: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="form-label">Preferred holiday</label>
                  <select className="form-select" value={copiedEdit.preferred_holiday} onChange={(e) => setCopiedEdit({ ...copiedEdit, preferred_holiday: e.target.value })}>
                    {CELEBR8_HOLIDAYS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="mb-0">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={3} value={copiedEdit.description} onChange={(e) => setCopiedEdit({ ...copiedEdit, description: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setCopiedEdit(null)}>Later</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    void (async () => {
                      await ApiClient.post('/api/celebr8.php?action=upsert_activity', copiedEdit);
                      if (event) await refreshActivities(event.id);
                      setCopiedEdit(null);
                      onToast?.({ tone: 'success', message: 'Copy saved' });
                    })();
                  }}
                >
                  Save copy
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {textOpen && event ? (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.45)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5">Send exact text</h2>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setTextOpen(false)} />
              </div>
              <div className="modal-body">
                <p className="small text-muted">Secondary escape hatch. Prefer Ask Celebr8r for most messaging.</p>
                <textarea className="form-control mb-2" rows={4} value={textBody} onChange={(e) => setTextBody(e.target.value)} />
                <label className="form-label">One guest</label>
                <select className="form-select" value={exactGuestId} onChange={(e) => setExactGuestId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Pick guest…</option>
                  {guests.map((g) => <option key={g.id} value={g.id}>{g.name}{g.phone ? '' : ' (no phone)'}</option>)}
                </select>
                <p className="small text-muted mt-2 mb-0">{messages.length} messages in outbox</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setTextOpen(false)}>Close</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !textBody.trim() || !exactGuestId}
                  onClick={() => {
                    void (async () => {
                      const guest = guests.find((g) => g.id === exactGuestId);
                      if (!guest) return;
                      const ok = await confirm({
                        title: 'Queue exact text?',
                        message: `Send this exact body to ${guest.name}?`,
                        confirmLabel: 'Queue text',
                      });
                      if (!ok) return;
                      await queueTexts({
                        event_id: event.id,
                        body: textBody.trim(),
                        guest_ids: [guest.id],
                      });
                      setTextOpen(false);
                    })();
                  }}
                >
                  Queue text
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {guestDraft && event ? (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.45)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5">{guestDraft.id ? 'Edit guest' : 'Add guest'}</h2>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setGuestDraft(null)} />
              </div>
              <div className="modal-body">
                <div className="mb-2"><label className="form-label">Name</label><input className="form-control" value={guestDraft.name} onChange={(e) => setGuestDraft({ ...guestDraft, name: e.target.value })} /></div>
                <div className="mb-2"><label className="form-label">Phone</label><input className="form-control" value={guestDraft.phone} onChange={(e) => setGuestDraft({ ...guestDraft, phone: e.target.value })} /></div>
                <div className="mb-2">
                  <label className="form-label">RSVP</label>
                  <select className="form-select" value={guestDraft.rsvp_status} onChange={(e) => setGuestDraft({ ...guestDraft, rsvp_status: e.target.value as Celebr8RsvpStatus })}>
                    {RSVP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="mb-2"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={guestDraft.notes} onChange={(e) => setGuestDraft({ ...guestDraft, notes: e.target.value })} /></div>
                {guestDraft.id && groups.length > 0 ? (
                  <div className="mb-0">
                    <label className="form-label">Groups</label>
                    <ul className="small mb-0">
                      {groups.map((g) => (
                        <li key={g.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={guestGroupIds.includes(g.id)}
                              onChange={() => setGuestGroupIds((prev) => (
                                prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                              ))}
                            />
                            {' '}{g.name}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <div className="modal-footer">
                {guestDraft.id ? (
                  <button type="button" className="btn btn-outline-danger me-auto" onClick={() => {
                    void (async () => {
                      const g = guests.find((x) => x.id === guestDraft.id);
                      if (!g) return;
                      const ok = await confirm({ title: 'Remove guest?', message: `Remove ${g.name}?`, confirmLabel: 'Remove' });
                      if (!ok) return;
                      await deleteGuest(event.id, g.id);
                      setGuestDraft(null);
                    })();
                  }}
                  >
                    Remove
                  </button>
                ) : null}
                <button type="button" className="btn btn-outline-secondary" onClick={() => setGuestDraft(null)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !guestDraft.name.trim()}
                  onClick={() => {
                    void (async () => {
                      const guest = await saveGuest({ event_id: event.id, ...guestDraft });
                      if (guest?.id && groups.length > 0) {
                        await Promise.all(groups.map((g) => {
                          const members = new Set(g.guest_ids);
                          if (guestGroupIds.includes(g.id)) members.add(guest.id);
                          else members.delete(guest.id);
                          return ApiClient.post('/api/celebr8.php?action=upsert_guest_group', {
                            event_id: event.id,
                            id: g.id,
                            name: g.name,
                            guest_ids: Array.from(members),
                          });
                        }));
                        await refreshGroups(event.id);
                      }
                      setGuestDraft(null);
                    })();
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {groupDraft && event ? (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.45)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5">Guest groups</h2>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setGroupDraft(null)} />
              </div>
              <div className="modal-body">
                <p className="small text-muted">Name a subset (Ingram family, Neighbors, Kids&apos; parents) for Celebr8r targeting.</p>
                {groups.length > 0 ? (
                  <ul className="small mb-3">
                    {groups.map((g) => (
                      <li key={g.id} className="d-flex justify-content-between gap-2 mb-1">
                        <button
                          type="button"
                          className="btn btn-link btn-sm px-0"
                          onClick={() => setGroupDraft({ id: g.id, name: g.name, guest_ids: [...g.guest_ids] })}
                        >
                          {g.name} ({g.member_count})
                        </button>
                        <button
                          type="button"
                          className="btn btn-link btn-sm text-danger"
                          onClick={() => {
                            void (async () => {
                              const ok = await confirm({ title: 'Delete group?', message: `Delete “${g.name}”?`, confirmLabel: 'Delete' });
                              if (!ok) return;
                              await ApiClient.post('/api/celebr8.php?action=delete_guest_group', { event_id: event.id, group_id: g.id });
                              await refreshGroups(event.id);
                            })();
                          }}
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mb-2">
                  <label className="form-label">{groupDraft.id ? 'Edit group name' : 'New group name'}</label>
                  <input className="form-control" value={groupDraft.name} onChange={(e) => setGroupDraft({ ...groupDraft, name: e.target.value })} placeholder="Ingram family" />
                </div>
                <ul className="small mb-0" style={{ maxHeight: 180, overflow: 'auto' }}>
                  {guests.map((g) => (
                    <li key={g.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={groupDraft.guest_ids.includes(g.id)}
                          onChange={() => setGroupDraft({
                            ...groupDraft,
                            guest_ids: groupDraft.guest_ids.includes(g.id)
                              ? groupDraft.guest_ids.filter((id) => id !== g.id)
                              : [...groupDraft.guest_ids, g.id],
                          })}
                        />
                        {' '}{g.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setGroupDraft(null)}>Close</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !groupDraft.name.trim()}
                  onClick={() => {
                    void (async () => {
                      await ApiClient.post('/api/celebr8.php?action=upsert_guest_group', {
                        event_id: event.id,
                        id: groupDraft.id,
                        name: groupDraft.name.trim(),
                        guest_ids: groupDraft.guest_ids,
                      });
                      await refreshGroups(event.id);
                      setGroupDraft({ name: '', guest_ids: [] });
                      onToast?.({ tone: 'success', message: 'Group saved' });
                    })();
                  }}
                >
                  Save group
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDialog}
    </PageLayout>
  );
}
