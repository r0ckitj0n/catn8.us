import React from 'react';

import { Celebr8SubNav } from '../celebr8/Celebr8SubNav';
import { PageLayout } from '../layout/PageLayout';
import { ApiClient } from '../../core/ApiClient';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { CELEBR8_HOLIDAYS, Celebr8Activity } from '../../types/celebr8';
import './Celebr8Page.css';

const EMPTY_DRAFT = {
  id: 0,
  name: '',
  preferred_holiday: 'Any',
  party_types: '' as string,
  category: 'other',
  description: '',
  ages: 'all',
  supplies: '',
  prizes: '',
  setup_notes: '',
  source: '',
  is_suggested: 0,
};

export function Celebr8ActivitiesPage({
  viewer,
  onLoginClick,
  onLogout,
  onAccountClick,
  mysteryTitle,
  onToast,
}: AppShellPageProps) {
  const isAuthed = Boolean(viewer?.id);
  const isAdmin = Number(viewer?.is_admin) === 1 || Number(viewer?.is_administrator) === 1;
  const [busy, setBusy] = React.useState(false);
  const [activities, setActivities] = React.useState<Celebr8Activity[]>([]);
  const [holiday, setHoliday] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [ages, setAges] = React.useState('');
  const [q, setQ] = React.useState('');
  const [draft, setDraft] = React.useState(EMPTY_DRAFT);
  const [editing, setEditing] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!isAuthed) return;
    setBusy(true);
    try {
      const params = new URLSearchParams({ action: 'list_activities' });
      if (holiday) params.set('preferred_holiday', holiday);
      if (category) params.set('category', category);
      if (ages) params.set('ages', ages);
      const res = await ApiClient.get<{ success: boolean; activities: Celebr8Activity[] }>(
        `/api/celebr8.php?${params.toString()}`,
      );
      setActivities(res.activities || []);
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Failed to load activities' });
    } finally {
      setBusy(false);
    }
  }, [ages, category, holiday, isAuthed, onToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return activities;
    return activities.filter((a) => {
      const hay = `${a.name} ${a.description} ${a.category} ${a.source} ${a.preferred_holiday} ${(a.party_types || []).join(' ')}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [activities, q]);

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setEditing(true);
  };

  const openEdit = (a: Celebr8Activity) => {
    setDraft({
      id: a.id,
      name: a.name,
      preferred_holiday: a.preferred_holiday || 'Any',
      party_types: (a.party_types || []).join(', '),
      category: a.category || 'other',
      description: a.description || '',
      ages: a.ages || 'all',
      supplies: (a.supplies || []).join('\n'),
      prizes: a.prizes || '',
      setup_notes: a.setup_notes || '',
      source: a.source || '',
      is_suggested: Number(a.is_suggested || 0),
    });
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      await ApiClient.post('/api/celebr8.php?action=upsert_activity', {
        id: draft.id || undefined,
        name: draft.name,
        preferred_holiday: draft.preferred_holiday,
        party_types: draft.party_types.split(',').map((s) => s.trim()).filter(Boolean),
        category: draft.category,
        description: draft.description,
        ages: draft.ages,
        supplies: draft.supplies.split('\n').map((s) => s.trim()).filter(Boolean),
        prizes: draft.prizes || null,
        setup_notes: draft.setup_notes,
        source: draft.source,
        is_suggested: draft.is_suggested,
      });
      onToast?.({ tone: 'success', message: draft.id ? 'Activity updated' : 'Activity created' });
      setEditing(false);
      await load();
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Save failed' });
    } finally {
      setBusy(false);
    }
  };

  const copyActivity = async (a: Celebr8Activity) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; activity: Celebr8Activity }>(
        '/api/celebr8.php?action=copy_activity',
        { activity_id: a.id },
      );
      onToast?.({ tone: 'success', message: 'Copied — re-theme this copy' });
      openEdit(res.activity);
      await load();
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Copy failed' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Celebr8Activity) => {
    if (!window.confirm(`Delete activity “${a.name}”?`)) return;
    setBusy(true);
    try {
      await ApiClient.post('/api/celebr8.php?action=delete_activity', { activity_id: a.id });
      onToast?.({ tone: 'success', message: 'Activity deleted' });
      await load();
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Delete failed' });
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthed) {
    return (
      <PageLayout page="celebr8_activities" title="CELEBR8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
        <section className="section celebr8-page">
          <div className="celebr8-hero"><h1>CELEBR8</h1><p>Sign in to browse the activities library.</p></div>
        </section>
      </PageLayout>
    );
  }

  return (
    <PageLayout page="celebr8_activities" title="CELEBR8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section celebr8-page">
        <div className="celebr8-hero">
          <h1>CELEBR8</h1>
          <p className="mb-0">Shared activity library — available to every party. Preferred holiday is only a label.</p>
        </div>
        <Celebr8SubNav active="activities" />

        <div className="celebr8-panel">
          <div className="celebr8-toolbar">
            <input className="form-control" style={{ maxWidth: 220 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="form-select" style={{ maxWidth: 180 }} value={holiday} onChange={(e) => setHoliday(e.target.value)}>
              <option value="">All holidays</option>
              {CELEBR8_HOLIDAYS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <select className="form-select" style={{ maxWidth: 140 }} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {['contest', 'music', 'food', 'game', 'kids', 'other'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="form-select" style={{ maxWidth: 120 }} value={ages} onChange={(e) => setAges(e.target.value)}>
              <option value="">All ages</option>
              <option value="all">all</option>
              <option value="kids">kids</option>
              <option value="adults">adults</option>
            </select>
            {isAdmin ? (
              <button type="button" className="btn btn-sm btn-primary" onClick={openCreate} disabled={busy}>Add activity</button>
            ) : null}
            <span className="small text-muted ms-auto">{filtered.length} shown</span>
          </div>

          <div className="celebr8-guest-table-wrap">
            <table className="table table-sm align-middle celebr8-guest-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Holiday</th>
                  <th>Category</th>
                  <th>Ages</th>
                  <th>Source</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.name}</strong>
                      {Number(a.is_suggested) === 1 ? <span className="celebr8-flag ms-1">suggested</span> : null}
                      <div className="small text-muted">{a.description}</div>
                    </td>
                    <td className="small">{a.preferred_holiday || 'Any'}{a.copied_from_activity_id ? <div className="text-muted">copy of #{a.copied_from_activity_id}</div> : null}</td>
                    <td>{a.category}</td>
                    <td>{a.ages}</td>
                    <td className="small celebr8-notes-cell">{a.source}</td>
                    <td className="text-nowrap">
                      {isAdmin ? (
                        <>
                          <button type="button" className="btn btn-link btn-sm" onClick={() => openEdit(a)}>Edit</button>
                          <button type="button" className="btn btn-link btn-sm" onClick={() => void copyActivity(a)}>Copy</button>
                          <button type="button" className="btn btn-link btn-sm text-danger" onClick={() => void remove(a)}>Delete</button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {editing ? (
          <div className="modal show d-block" tabIndex={-1} role="dialog" style={{ background: 'rgba(0,0,0,.45)' }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{draft.id ? 'Edit activity' : 'New activity'}</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setEditing(false)} />
                </div>
                <div className="modal-body">
                  <div className="mb-2">
                    <label className="form-label">Name</label>
                    <input className="form-control" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </div>
                  <div className="row g-2">
                    <div className="col-md-6">
                      <label className="form-label">Preferred holiday</label>
                      <select className="form-select" value={draft.preferred_holiday} onChange={(e) => setDraft({ ...draft, preferred_holiday: e.target.value })}>
                        {CELEBR8_HOLIDAYS.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Category</label>
                      <select className="form-select" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                        {['contest', 'music', 'food', 'game', 'kids', 'other'].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Ages</label>
                      <select className="form-select" value={draft.ages} onChange={(e) => setDraft({ ...draft, ages: e.target.value })}>
                        {['all', 'kids', 'adults'].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mb-2 mt-2">
                    <label className="form-label">Description</label>
                    <textarea className="form-control" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Supplies (one per line)</label>
                    <textarea className="form-control" rows={4} value={draft.supplies} onChange={(e) => setDraft({ ...draft, supplies: e.target.value })} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Prizes</label>
                    <input className="form-control" value={draft.prizes} onChange={(e) => setDraft({ ...draft, prizes: e.target.value })} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Setup notes</label>
                    <textarea className="form-control" rows={2} value={draft.setup_notes} onChange={(e) => setDraft({ ...draft, setup_notes: e.target.value })} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Source</label>
                    <input className="form-control" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
                  </div>
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="act-suggested" checked={draft.is_suggested === 1} onChange={(e) => setDraft({ ...draft, is_suggested: e.target.checked ? 1 : 0 })} />
                    <label className="form-check-label" htmlFor="act-suggested">Suggested / inferred</label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                  <button type="button" className="btn btn-primary" disabled={busy || !draft.name.trim()} onClick={() => void save()}>Save</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </PageLayout>
  );
}
