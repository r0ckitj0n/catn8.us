import React from 'react';

import { Celebr8SubNav } from '../celebr8/Celebr8SubNav';
import { PageLayout } from '../layout/PageLayout';
import { ApiClient } from '../../core/ApiClient';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { Celebr8PartyTemplate } from '../../types/celebr8';
import './Celebr8Page.css';

export function Celebr8TemplatesPage({
  viewer,
  onLoginClick,
  onLogout,
  onAccountClick,
  mysteryTitle,
  onToast,
}: AppShellPageProps) {
  const isAuthed = Boolean(viewer?.id);
  const [busy, setBusy] = React.useState(false);
  const [templates, setTemplates] = React.useState<Celebr8PartyTemplate[]>([]);
  const [selectedId, setSelectedId] = React.useState(0);

  const load = React.useCallback(async () => {
    if (!isAuthed) return;
    setBusy(true);
    try {
      const res = await ApiClient.get<{ success: boolean; templates: Celebr8PartyTemplate[] }>(
        '/api/celebr8.php?action=list_templates',
      );
      const list = res.templates || [];
      setTemplates(list);
      setSelectedId((prev) => prev || list[0]?.id || 0);
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Failed to load templates' });
    } finally {
      setBusy(false);
    }
  }, [isAuthed, onToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const selected = templates.find((t) => t.id === selectedId) || null;

  const createEvent = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; event: { id: number; title: string } }>(
        '/api/celebr8.php?action=create_event_from_template',
        { template_id: selected.id },
      );
      onToast?.({ tone: 'success', message: `Created “${res.event.title}” (location left blank)` });
      window.location.href = '/celebr8';
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Failed to create event' });
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthed) {
    return (
      <PageLayout page="celebr8_templates" title="CELEBR8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
        <section className="section celebr8-page">
          <div className="celebr8-hero"><h1>CELEBR8</h1><p>Sign in to browse party templates.</p></div>
        </section>
      </PageLayout>
    );
  }

  return (
    <PageLayout page="celebr8_templates" title="CELEBR8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section celebr8-page">
        <div className="celebr8-hero">
          <h1>CELEBR8</h1>
          <p className="mb-0">Reusable party templates — create events without copying past addresses.</p>
        </div>
        <Celebr8SubNav active="templates" />

        <div className="celebr8-split">
          <div className="celebr8-panel">
            <h2 className="h5">Templates ({templates.length})</h2>
            <ul className="celebr8-template-list">
              {templates.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    className={`celebr8-template-pick${tpl.id === selectedId ? ' is-active' : ''}`}
                    onClick={() => setSelectedId(tpl.id)}
                  >
                    <strong>{tpl.name}</strong>
                    {Number(tpl.is_suggested) === 1 ? <span className="celebr8-flag">suggested</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="celebr8-panel">
            {!selected ? (
              <p className="mb-0 text-muted">{busy ? 'Loading…' : 'Select a template.'}</p>
            ) : (
              <>
                <div className="d-flex flex-wrap gap-2 align-items-start justify-content-between mb-3">
                  <div>
                    <h2 className="h4 mb-1">{selected.name}</h2>
                    {Number(selected.is_suggested) === 1 ? <span className="celebr8-flag">suggested / inferred — editable</span> : null}
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void createEvent()}>
                    Create event from template
                  </button>
                </div>
                {selected.hero_image_url ? (
                  <div className="celebr8-flyer mb-3">
                    <img src={selected.hero_image_url} alt={`${selected.name} hero`} />
                  </div>
                ) : (
                  <p className="celebr8-placeholder">No hero image yet (suggested: upload one).</p>
                )}
                <p>{selected.description}</p>
                <dl className="row mb-3">
                  <dt className="col-sm-3">Theme</dt><dd className="col-sm-9">{selected.theme || '—'}</dd>
                  <dt className="col-sm-3">Usual timing</dt><dd className="col-sm-9">{selected.usual_timing || '—'}</dd>
                  <dt className="col-sm-3">Food</dt><dd className="col-sm-9" style={{ whiteSpace: 'pre-wrap' }}>{selected.food_notes || '—'}</dd>
                  <dt className="col-sm-3">BYOB</dt><dd className="col-sm-9">{selected.byob_notes || '—'}</dd>
                  <dt className="col-sm-3">Past venues</dt>
                  <dd className="col-sm-9" style={{ whiteSpace: 'pre-wrap' }}>
                    {selected.past_venue_notes || '—'}
                    <div className="small text-muted mt-1">Past venues are notes only — never auto-filled as location.</div>
                  </dd>
                </dl>
                {selected.taglines?.length ? (
                  <div className="mb-3">
                    <h3 className="h6">Taglines</h3>
                    <ul>{selected.taglines.map((t) => <li key={t}>{t}</li>)}</ul>
                  </div>
                ) : null}
                {selected.default_activity_names?.length ? (
                  <div className="mb-3">
                    <h3 className="h6">Default activities</h3>
                    <ul>{selected.default_activity_names.map((n) => <li key={n}>{n}</li>)}</ul>
                  </div>
                ) : null}
                {selected.music_playlist?.length ? (
                  <div className="mb-3">
                    <h3 className="h6">Creepy music playlist</h3>
                    <ol className="small">{selected.music_playlist.map((n) => <li key={n}>{n}</li>)}</ol>
                  </div>
                ) : null}
                {selected.gallery?.length ? (
                  <div className="mb-3">
                    <h3 className="h6">Past flyers / gallery</h3>
                    <div className="celebr8-gallery">
                      {selected.gallery.map((g) => (
                        <figure key={g.path || g.url}>
                          {g.url ? <img src={g.url} alt={g.label || selected.name} /> : null}
                          <figcaption>{g.label || g.path}{g.is_suggested ? ' (suggested)' : ''}</figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                ) : null}
                {selected.notes ? (
                  <div>
                    <h3 className="h6">Notes</h3>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{selected.notes}</p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
