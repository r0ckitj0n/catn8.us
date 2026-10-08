import React from 'react';

import { useCelebr8 } from '../../hooks/useCelebr8';
import { useBrandedConfirm } from '../../hooks/useBrandedConfirm';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { Celebr8Guest, Celebr8RsvpStatus } from '../../types/celebr8';
import { PageLayout } from '../layout/PageLayout';
import './Celebr8Page.css';

const RSVP_OPTIONS: Array<{ value: Celebr8RsvpStatus; label: string }> = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_going', label: 'Not going' },
  { value: 'no_reply', label: 'No reply' },
];

function looksLikePlaceholder(value: string): boolean {
  return /\[PLACEHOLDER/i.test(value || '');
}

function FieldValue({ value }: { value: string }) {
  if (!value) return <span className="text-muted">—</span>;
  if (looksLikePlaceholder(value)) {
    return <span className="celebr8-placeholder">{value}</span>;
  }
  return <span>{value}</span>;
}

type GuestDraft = {
  id?: number;
  name: string;
  phone: string;
  email: string;
  rsvp_status: Celebr8RsvpStatus;
  party_size: number;
  kids_count: number;
  notes: string;
};

function blankGuest(): GuestDraft {
  return {
    name: '',
    phone: '',
    email: '',
    rsvp_status: 'no_reply',
    party_size: 1,
    kids_count: 0,
    notes: '',
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
    notes: guest.notes || '',
  };
}

export function Celebr8Page({
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
  const {
    busy,
    loaded,
    events,
    event,
    guests,
    messages,
    totals,
    setEventId,
    updateEvent,
    saveGuest,
    deleteGuest,
    queueTexts,
  } = useCelebr8(isAuthed, onToast);
  const { confirm, confirmDialog } = useBrandedConfirm();

  const [editingDetails, setEditingDetails] = React.useState(false);
  const [detailsDraft, setDetailsDraft] = React.useState<Record<string, string>>({});
  const [guestDraft, setGuestDraft] = React.useState<GuestDraft | null>(null);
  const [selectedGuestIds, setSelectedGuestIds] = React.useState<number[]>([]);
  const [textBody, setTextBody] = React.useState('');
  const [textFilter, setTextFilter] = React.useState('');
  const [guestFilter, setGuestFilter] = React.useState('');

  React.useEffect(() => {
    if (!event) return;
    setDetailsDraft({
      title: event.title,
      theme: event.theme,
      event_date: event.event_date,
      event_time: event.event_time,
      location: event.location,
      food: event.food || '',
      schedule: event.schedule || '',
      rsvp_deadline: event.rsvp_deadline,
      notes: event.notes || '',
    });
  }, [event]);

  const filteredGuests = React.useMemo(() => {
    const q = guestFilter.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter((g) => {
      const hay = `${g.name} ${g.phone} ${g.email} ${g.notes} ${g.rsvp_status}`.toLowerCase();
      return hay.includes(q);
    });
  }, [guestFilter, guests]);

  if (!isAuthed) {
    return (
      <PageLayout page="celebr8" title="CELEBR8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
        <section className="section celebr8-page">
          <div className="container">
            <div className="celebr8-hero">
              <h1>CELEBR8</h1>
              <p>Party planning is for signed-in family only. Log in to continue.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={onLoginClick}>Log in</button>
          </div>
        </section>
      </PageLayout>
    );
  }

  const toggleGuest = (id: number) => {
    setSelectedGuestIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectFiltered = () => {
    setSelectedGuestIds(filteredGuests.map((g) => g.id));
  };

  const onSaveDetails = async () => {
    if (!event) return;
    await updateEvent({ event_id: event.id, ...detailsDraft });
    setEditingDetails(false);
  };

  const onSaveGuest = async () => {
    if (!event || !guestDraft) return;
    await saveGuest({
      event_id: event.id,
      ...guestDraft,
    });
    setGuestDraft(null);
  };

  const onDeleteGuest = async (guest: Celebr8Guest) => {
    if (!event) return;
    const ok = await confirm({
      title: 'Remove guest?',
      message: `Remove ${guest.name} from this event?`,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    await deleteGuest(event.id, guest.id);
    setSelectedGuestIds((prev) => prev.filter((id) => id !== guest.id));
  };

  const onQueueTexts = async (mode: 'selected' | 'all') => {
    if (!event) return;
    const body = textBody.trim();
    if (!body) {
      onToast?.({ tone: 'error', message: 'Write a message first' });
      return;
    }
    if (mode === 'selected' && selectedGuestIds.length === 0) {
      onToast?.({ tone: 'error', message: 'Select at least one guest' });
      return;
    }
    const label = mode === 'all'
      ? (textFilter ? `everyone with RSVP "${textFilter}"` : 'everyone')
      : `${selectedGuestIds.length} selected guest(s)`;
    const ok = await confirm({
      title: 'Queue iMessage texts?',
      message: `Queue this message for ${label}? The Mac relay will send from Jon's iMessage.`,
      confirmLabel: 'Queue texts',
    });
    if (!ok) return;
    await queueTexts({
      event_id: event.id,
      body,
      all_guests: mode === 'all',
      guest_ids: mode === 'selected' ? selectedGuestIds : undefined,
      rsvp_status: textFilter || undefined,
    });
  };

  return (
    <PageLayout page="celebr8" title="CELEBR8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section celebr8-page">
        <div className="container">
          <div className="celebr8-hero">
            <h1>CELEBR8</h1>
            <p>Plan the party, track RSVPs, and queue texts that send from Jon&apos;s Mac via iMessage.</p>
          </div>

          {!loaded ? (
            <div className="celebr8-panel">Loading Celebr8…</div>
          ) : (
            <>
              <div className="celebr8-toolbar">
                <label className="visually-hidden" htmlFor="celebr8-event-select">Event</label>
                <select
                  id="celebr8-event-select"
                  className="form-select"
                  value={event?.id || ''}
                  onChange={(e) => setEventId(Number(e.target.value))}
                  disabled={busy || events.length === 0}
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.title}</option>
                  ))}
                </select>
                {busy ? <span className="text-muted small">Working…</span> : null}
              </div>

              {event ? (
                <>
                  <div className="celebr8-panel">
                    <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                      <h2 className="mb-0">{event.title}</h2>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setEditingDetails((v) => !v)}
                        >
                          {editingDetails ? 'Cancel edit' : 'Edit details'}
                        </button>
                      ) : null}
                    </div>

                    {!editingDetails ? (
                      <dl className="row mb-0 mt-3">
                        <dt className="col-sm-3">Date</dt><dd className="col-sm-9"><FieldValue value={event.event_date} /></dd>
                        <dt className="col-sm-3">Time</dt><dd className="col-sm-9"><FieldValue value={event.event_time} /></dd>
                        <dt className="col-sm-3">Location</dt><dd className="col-sm-9"><FieldValue value={event.location} /></dd>
                        <dt className="col-sm-3">Theme</dt><dd className="col-sm-9"><FieldValue value={event.theme} /></dd>
                        <dt className="col-sm-3">Food</dt><dd className="col-sm-9"><FieldValue value={event.food || ''} /></dd>
                        <dt className="col-sm-3">Schedule</dt><dd className="col-sm-9"><FieldValue value={event.schedule || ''} /></dd>
                        <dt className="col-sm-3">RSVP deadline</dt><dd className="col-sm-9"><FieldValue value={event.rsvp_deadline} /></dd>
                        <dt className="col-sm-3">Notes</dt><dd className="col-sm-9"><FieldValue value={event.notes || ''} /></dd>
                      </dl>
                    ) : (
                      <div className="row g-2 mt-2">
                        {(['title', 'event_date', 'event_time', 'location', 'theme', 'rsvp_deadline'] as const).map((key) => (
                          <div className="col-md-6" key={key}>
                            <label className="form-label text-capitalize" htmlFor={`celebr8-${key}`}>{key.replace('_', ' ')}</label>
                            <input
                              id={`celebr8-${key}`}
                              className="form-control"
                              value={detailsDraft[key] || ''}
                              onChange={(e) => setDetailsDraft((d) => ({ ...d, [key]: e.target.value }))}
                            />
                          </div>
                        ))}
                        {(['food', 'schedule', 'notes'] as const).map((key) => (
                          <div className="col-12" key={key}>
                            <label className="form-label text-capitalize" htmlFor={`celebr8-${key}`}>{key}</label>
                            <textarea
                              id={`celebr8-${key}`}
                              className="form-control"
                              rows={3}
                              value={detailsDraft[key] || ''}
                              onChange={(e) => setDetailsDraft((d) => ({ ...d, [key]: e.target.value }))}
                            />
                          </div>
                        ))}
                        <div className="col-12">
                          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void onSaveDetails()}>
                            Save event details
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="celebr8-panel">
                    <h2>Head count</h2>
                    <div className="celebr8-totals">
                      <div className="celebr8-total-chip"><strong>{totals.going_headcount}</strong><span>Going seats</span></div>
                      <div className="celebr8-total-chip"><strong>{totals.by_status?.going?.guest_count || 0}</strong><span>Going guests</span></div>
                      <div className="celebr8-total-chip"><strong>{totals.by_status?.maybe?.guest_count || 0}</strong><span>Maybe</span></div>
                      <div className="celebr8-total-chip"><strong>{totals.by_status?.not_going?.guest_count || 0}</strong><span>Not going</span></div>
                      <div className="celebr8-total-chip"><strong>{totals.by_status?.no_reply?.guest_count || 0}</strong><span>No reply</span></div>
                      <div className="celebr8-total-chip"><strong>{totals.total_kids}</strong><span>Kids total</span></div>
                    </div>
                  </div>

                  <div className="celebr8-panel">
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                      <h2 className="mb-0">Guest list</h2>
                      {isAdmin ? (
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => setGuestDraft(blankGuest())}>
                          Add guest
                        </button>
                      ) : null}
                    </div>
                    <div className="celebr8-toolbar">
                      <input
                        className="form-control"
                        placeholder="Filter guests"
                        value={guestFilter}
                        onChange={(e) => setGuestFilter(e.target.value)}
                      />
                      {isAdmin ? (
                        <>
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={selectFiltered}>Select filtered</button>
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedGuestIds([])}>Clear selection</button>
                        </>
                      ) : null}
                    </div>
                    <div className="celebr8-guest-table-wrap">
                      <table className="table table-sm align-middle celebr8-guest-table">
                        <thead>
                          <tr>
                            {isAdmin ? <th scope="col"></th> : null}
                            <th scope="col">Name</th>
                            <th scope="col">Phone</th>
                            <th scope="col">Email</th>
                            <th scope="col">RSVP</th>
                            <th scope="col">Party</th>
                            <th scope="col">Kids</th>
                            <th scope="col">Updated</th>
                            <th scope="col">Notes</th>
                            {isAdmin ? <th scope="col">Actions</th> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredGuests.length === 0 ? (
                            <tr><td colSpan={isAdmin ? 10 : 8} className="text-muted">No guests yet.</td></tr>
                          ) : filteredGuests.map((guest) => (
                            <tr key={guest.id}>
                              {isAdmin ? (
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selectedGuestIds.includes(guest.id)}
                                    onChange={() => toggleGuest(guest.id)}
                                    aria-label={`Select ${guest.name}`}
                                  />
                                </td>
                              ) : null}
                              <td>{guest.name}</td>
                              <td>{guest.phone || '—'}</td>
                              <td>{guest.email || '—'}</td>
                              <td className={`celebr8-status-${guest.rsvp_status}`}>{guest.rsvp_status}</td>
                              <td>{guest.party_size}</td>
                              <td>{guest.kids_count}</td>
                              <td>
                                <div className="small">{guest.rsvp_updated_at || '—'}</div>
                                <div className="small text-muted">{guest.rsvp_updated_by || ''}</div>
                              </td>
                              <td className="celebr8-notes-cell">{guest.notes || ''}</td>
                              {isAdmin ? (
                                <td>
                                  <button type="button" className="btn btn-sm btn-outline-secondary me-1" onClick={() => setGuestDraft(guestToDraft(guest))}>Edit</button>
                                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void onDeleteGuest(guest)}>Remove</button>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {isAdmin ? (
                    <div className="celebr8-panel">
                      <h2>Text guests (iMessage outbox)</h2>
                      <p className="small text-muted">
                        Messages are queued here, then a Mac relay sends them with <code>imsg</code> from Jon&apos;s Messages account.
                      </p>
                      <textarea
                        className="form-control mb-2"
                        rows={4}
                        placeholder="Message body"
                        value={textBody}
                        onChange={(e) => setTextBody(e.target.value)}
                      />
                      <div className="celebr8-toolbar">
                        <select className="form-select" value={textFilter} onChange={(e) => setTextFilter(e.target.value)}>
                          <option value="">All RSVP statuses</option>
                          {RSVP_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void onQueueTexts('selected')}>
                          Queue selected ({selectedGuestIds.length})
                        </button>
                        <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={() => void onQueueTexts('all')}>
                          Queue filtered / everyone
                        </button>
                      </div>

                      <h3 className="h6 mt-3">Recent outbox</h3>
                      <div className="celebr8-guest-table-wrap">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th scope="col">ID</th>
                              <th scope="col">To</th>
                              <th scope="col">Status</th>
                              <th scope="col">Created</th>
                              <th scope="col">Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {messages.length === 0 ? (
                              <tr><td colSpan={5} className="text-muted">No messages queued yet.</td></tr>
                            ) : messages.slice(0, 40).map((msg) => (
                              <tr key={msg.id}>
                                <td>{msg.id}</td>
                                <td>{msg.to_address}</td>
                                <td className={`celebr8-message-status-${msg.status}`}>{msg.status}</td>
                                <td className="small">{msg.created_at}</td>
                                <td className="small text-danger">{msg.error_text || ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="celebr8-panel">No events found.</div>
              )}
            </>
          )}
        </div>
      </section>

      {guestDraft && event ? (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.45)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5">{guestDraft.id ? 'Edit guest' : 'Add guest'}</h2>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setGuestDraft(null)} />
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label" htmlFor="celebr8-guest-name">Name</label>
                  <input id="celebr8-guest-name" className="form-control" value={guestDraft.name} onChange={(e) => setGuestDraft({ ...guestDraft, name: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="form-label" htmlFor="celebr8-guest-phone">Phone</label>
                  <input id="celebr8-guest-phone" className="form-control" value={guestDraft.phone} onChange={(e) => setGuestDraft({ ...guestDraft, phone: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="form-label" htmlFor="celebr8-guest-email">Email</label>
                  <input id="celebr8-guest-email" className="form-control" value={guestDraft.email} onChange={(e) => setGuestDraft({ ...guestDraft, email: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="form-label" htmlFor="celebr8-guest-rsvp">RSVP</label>
                  <select id="celebr8-guest-rsvp" className="form-select" value={guestDraft.rsvp_status} onChange={(e) => setGuestDraft({ ...guestDraft, rsvp_status: e.target.value as Celebr8RsvpStatus })}>
                    {RSVP_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="row g-2">
                  <div className="col-6">
                    <label className="form-label" htmlFor="celebr8-guest-party">Party size</label>
                    <input id="celebr8-guest-party" type="number" min={1} className="form-control" value={guestDraft.party_size} onChange={(e) => setGuestDraft({ ...guestDraft, party_size: Number(e.target.value) || 1 })} />
                  </div>
                  <div className="col-6">
                    <label className="form-label" htmlFor="celebr8-guest-kids">Kids</label>
                    <input id="celebr8-guest-kids" type="number" min={0} className="form-control" value={guestDraft.kids_count} onChange={(e) => setGuestDraft({ ...guestDraft, kids_count: Number(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="form-label" htmlFor="celebr8-guest-notes">Notes</label>
                  <textarea id="celebr8-guest-notes" className="form-control" rows={3} value={guestDraft.notes} onChange={(e) => setGuestDraft({ ...guestDraft, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setGuestDraft(null)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={busy || !guestDraft.name.trim()} onClick={() => void onSaveGuest()}>Save guest</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDialog}
    </PageLayout>
  );
}
