import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import { useBrandedConfirm } from '../../hooks/useBrandedConfirm';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { Celebr8Event, Celebr8PartyTemplate } from '../../types/celebr8';
import { Celebr8SubNav } from '../celebr8/Celebr8SubNav';
import { PageLayout } from '../layout/PageLayout';
import './Celebr8Page.css';

function coverUrl(event: Celebr8Event): string {
  return event.flyer_image_url || '';
}

function rsvpLine(event: Celebr8Event): string {
  const t = event.totals;
  if (!t) return 'No RSVPs yet';
  return `${t.going} going · ${t.maybe} maybe · ${t.not_going} can't · ${t.no_reply} no reply`;
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
  const { confirm, confirmDialog } = useBrandedConfirm();
  const [busy, setBusy] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [events, setEvents] = React.useState<Celebr8Event[]>([]);
  const [templates, setTemplates] = React.useState<Celebr8PartyTemplate[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [draftTitle, setDraftTitle] = React.useState('');
  const [draftDate, setDraftDate] = React.useState('');
  const [draftTemplate, setDraftTemplate] = React.useState('');

  const load = React.useCallback(async () => {
    if (!isAuthed) return;
    setBusy(true);
    try {
      const [eventsRes, tplRes] = await Promise.all([
        ApiClient.get<{ success: boolean; events: Celebr8Event[] }>('/api/celebr8.php?action=list_events'),
        ApiClient.get<{ success: boolean; templates: Celebr8PartyTemplate[] }>('/api/celebr8.php?action=list_templates'),
      ]);
      setEvents(eventsRes.events || []);
      setTemplates(tplRes.templates || []);
      setLoaded(true);
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Failed to load parties' });
    } finally {
      setBusy(false);
    }
  }, [isAuthed, onToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const upcoming = events.filter((e) => !e.is_past);
  const past = events.filter((e) => e.is_past);

  const createParty = async () => {
    const title = draftTitle.trim();
    if (!title && !draftTemplate) {
      onToast?.({ tone: 'error', message: 'Give the party a name, or pick a template' });
      return;
    }
    setBusy(true);
    try {
      let event: Celebr8Event;
      if (draftTemplate) {
        const res = await ApiClient.post<{ success: boolean; event: Celebr8Event }>(
          '/api/celebr8.php?action=create_event_from_template',
          {
            template_id: Number(draftTemplate),
            title: title || undefined,
            event_date: draftDate || undefined,
          },
        );
        event = res.event;
      } else {
        const res = await ApiClient.post<{ success: boolean; event: Celebr8Event }>(
          '/api/celebr8.php?action=create_event',
          { title, event_date: draftDate },
        );
        event = res.event;
      }
      window.location.href = `/celebr8/party/${event.id}`;
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Could not create party' });
      setBusy(false);
    }
  };

  const duplicateParty = async (event: Celebr8Event) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; event: Celebr8Event }>(
        '/api/celebr8.php?action=duplicate_event',
        { event_id: event.id },
      );
      onToast?.({ tone: 'success', message: 'Party duplicated — guests were not copied' });
      window.location.href = `/celebr8/party/${res.event.id}`;
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Duplicate failed' });
      setBusy(false);
    }
  };

  const deleteParty = async (event: Celebr8Event) => {
    const ok = await confirm({
      title: 'Delete this party?',
      message: `Delete “${event.title}”? Guests, RSVPs, and queued texts for it will be removed. Activities in the shared library stay.`,
      confirmLabel: 'Delete party',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/celebr8.php?action=delete_event', { event_id: event.id });
      onToast?.({ tone: 'success', message: 'Party deleted' });
      await load();
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Delete failed' });
    } finally {
      setBusy(false);
    }
  };

  const renderCard = (event: Celebr8Event) => (
    <article key={event.id} className="celebr8-party-card">
      <a className="celebr8-party-card-cover" href={`/celebr8/party/${event.id}`}>
        {coverUrl(event) ? (
          <img src={coverUrl(event)} alt="" />
        ) : (
          <div className="celebr8-party-card-placeholder" aria-hidden="true" />
        )}
      </a>
      <div className="celebr8-party-card-body">
        <a href={`/celebr8/party/${event.id}`}>
          <h3>{event.title}</h3>
        </a>
        {event.tagline ? <p className="celebr8-tagline">{event.tagline}</p> : null}
        <p className="celebr8-party-card-meta">{event.event_date || 'Date TBD'}</p>
        <p className="celebr8-party-card-rsvp">{rsvpLine(event)}</p>
        {isAdmin ? (
          <div className="celebr8-party-card-actions">
            <a className="btn btn-sm btn-outline-secondary" href={`/celebr8/party/${event.id}`}>Open</a>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => void duplicateParty(event)}>Duplicate</button>
            <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => void deleteParty(event)}>Delete</button>
          </div>
        ) : (
          <a className="btn btn-sm btn-outline-secondary" href={`/celebr8/party/${event.id}`}>Open</a>
        )}
      </div>
    </article>
  );

  if (!isAuthed) {
    return (
      <PageLayout page="celebr8" title="CELEBR8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
        <section className="section celebr8-page">
          <div className="container">
            <div className="celebr8-hero">
              <h1>CELEBR8</h1>
              <p>Party planning is for signed-in family only.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={onLoginClick}>Log in</button>
          </div>
        </section>
      </PageLayout>
    );
  }

  return (
    <PageLayout page="celebr8" title="CELEBR8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section celebr8-page">
        <div className="container">
          <div className="celebr8-hero celebr8-hero-home">
            <div>
              <h1>My Parties</h1>
              <p className="mb-0">Upcoming and past get-togethers — tap a card to open it.</p>
            </div>
            {isAdmin ? (
              <button type="button" className="btn btn-primary celebr8-new-party-btn" onClick={() => setCreating(true)}>
                + New Party
              </button>
            ) : null}
          </div>
          <Celebr8SubNav active="parties" />

          {!loaded ? (
            <div className="celebr8-panel">Loading parties…</div>
          ) : (
            <>
              <h2 className="celebr8-section-label">Upcoming</h2>
              {upcoming.length === 0 ? (
                <p className="text-muted">No upcoming parties yet.</p>
              ) : (
                <div className="celebr8-party-grid">{upcoming.map(renderCard)}</div>
              )}
              <h2 className="celebr8-section-label">Past</h2>
              {past.length === 0 ? (
                <p className="text-muted">No past parties yet.</p>
              ) : (
                <div className="celebr8-party-grid">{past.map(renderCard)}</div>
              )}
            </>
          )}
        </div>
      </section>

      {creating ? (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.45)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5">New party</h2>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setCreating(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label" htmlFor="c8-new-title">Name</label>
                  <input id="c8-new-title" className="form-control" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Halloween Bash" />
                </div>
                <div className="mb-2">
                  <label className="form-label" htmlFor="c8-new-date">Date</label>
                  <input id="c8-new-date" className="form-control" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} placeholder="Friday, Oct 30, 2026" />
                </div>
                <div className="mb-0">
                  <label className="form-label" htmlFor="c8-new-tpl">Start from a template (optional)</label>
                  <select id="c8-new-tpl" className="form-select" value={draftTemplate} onChange={(e) => setDraftTemplate(e.target.value)}>
                    <option value="">Blank party</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}{t.is_suggested ? ' (suggested)' : ''}</option>
                    ))}
                  </select>
                  <p className="small text-muted mt-2 mb-0">Templates pre-fill details and suggest activities from the shared library. Location stays blank.</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setCreating(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createParty()}>Create party</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDialog}
    </PageLayout>
  );
}
