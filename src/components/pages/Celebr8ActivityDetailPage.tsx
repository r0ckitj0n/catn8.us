import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { CELEBR8_HOLIDAYS, Celebr8Activity } from '../../types/celebr8';
import { Celebr8ActivityPrintSheets, PrintSheetKind } from '../celebr8/Celebr8ActivityPrintSheets';
import { Celebr8SubNav } from '../celebr8/Celebr8SubNav';
import {
  formatMinutes,
  formatPlayers,
  formatUsdRange,
  variationText,
} from '../celebr8/celebr8ActivityFormat';
import { PageLayout } from '../layout/PageLayout';
import './Celebr8Page.css';

function activityIdFromPath(): number {
  if (typeof window === 'undefined') return 0;
  const parts = window.location.pathname.replace(/\/+$/, '').split('/');
  const last = parts[parts.length - 1];
  const n = Number(last);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type Draft = {
  id: number;
  name: string;
  preferred_holiday: string;
  category: string;
  ages: string;
  description: string;
  summary: string;
  objective: string;
  how_to_play: string;
  setup_instructions: string;
  teardown: string;
  rules_scoring: string;
  winning_notes: string;
  prizes: string;
  supplies_detail: string;
  estimated_cost_low: string;
  estimated_cost_high: string;
  setup_minutes: string;
  play_minutes: string;
  cleanup_minutes: string;
  min_players: string;
  max_players: string;
  age_range: string;
  kid_friendly: number;
  location_type: string;
  space_needed: string;
  energy_level: string;
  mess_level: string;
  tech_needs: string;
  volunteers_needed: string;
  safety_notes: string;
  variations: string;
  tips: string;
  setup_notes: string;
  source: string;
  is_suggested: number;
  senior_friendly: number;
  seated_play: number;
  mobility_level: string;
  hearing_vision_notes: string;
  senior_role: string;
};

function linesToList(text: string): string[] {
  return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function activityToDraft(a: Celebr8Activity): Draft {
  return {
    id: a.id,
    name: a.name,
    preferred_holiday: a.preferred_holiday || 'Any',
    category: a.category || 'other',
    ages: a.ages || 'all',
    description: a.description || '',
    summary: a.summary || '',
    objective: a.objective || '',
    how_to_play: (a.how_to_play || []).join('\n'),
    setup_instructions: (a.setup_instructions || []).join('\n'),
    teardown: (a.teardown || []).join('\n'),
    rules_scoring: a.rules_scoring || '',
    winning_notes: a.winning_notes || '',
    prizes: a.prizes || '',
    supplies_detail: (a.supplies_detail || []).map((s) => {
      const parts = [s.item, s.qty || '1'];
      if (s.unit_cost_est != null) parts.push(String(s.unit_cost_est));
      if (s.notes) parts.push(s.notes);
      return parts.join(' | ');
    }).join('\n'),
    estimated_cost_low: a.estimated_cost_low != null ? String(a.estimated_cost_low) : '',
    estimated_cost_high: a.estimated_cost_high != null ? String(a.estimated_cost_high) : '',
    setup_minutes: a.setup_minutes != null ? String(a.setup_minutes) : '',
    play_minutes: a.play_minutes != null ? String(a.play_minutes) : '',
    cleanup_minutes: a.cleanup_minutes != null ? String(a.cleanup_minutes) : '',
    min_players: a.min_players != null ? String(a.min_players) : '',
    max_players: a.max_players != null ? String(a.max_players) : '',
    age_range: a.age_range || '',
    kid_friendly: Number(a.kid_friendly || 0),
    location_type: a.location_type || 'both',
    space_needed: a.space_needed || '',
    energy_level: a.energy_level || 'medium',
    mess_level: a.mess_level || 'low',
    tech_needs: a.tech_needs || '',
    volunteers_needed: a.volunteers_needed || '',
    safety_notes: a.safety_notes || '',
    variations: (a.variations || []).map((v) => variationText(v)).join('\n'),
    tips: a.tips || '',
    setup_notes: a.setup_notes || '',
    source: a.source || '',
    is_suggested: Number(a.is_suggested || 0),
    senior_friendly: Number(a.senior_friendly || 0),
    seated_play: Number(a.seated_play || 0),
    mobility_level: a.mobility_level || 'moderate',
    hearing_vision_notes: a.hearing_vision_notes || '',
    senior_role: a.senior_role || '',
  };
}

function parseSuppliesDetail(text: string) {
  return linesToList(text).map((line) => {
    const parts = line.split('|').map((p) => p.trim());
    const item = parts[0] || '';
    const qty = parts[1] || '1';
    const maybeCost = parts[2] ? Number(parts[2]) : null;
    const unit_cost_est = maybeCost != null && Number.isFinite(maybeCost) ? maybeCost : null;
    const notes = unit_cost_est != null ? (parts.slice(3).join(' | ') || '') : (parts.slice(2).join(' | ') || '');
    return { item, qty, unit_cost_est, notes, have: 0 };
  });
}

export function Celebr8ActivityDetailPage({
  viewer,
  onLoginClick,
  onLogout,
  onAccountClick,
  mysteryTitle,
  onToast,
}: AppShellPageProps) {
  const isAuthed = Boolean(viewer?.id);
  const isAdmin = Number(viewer?.is_admin) === 1 || Number(viewer?.is_administrator) === 1
    || String(viewer?.username || '').toLowerCase() === 'admin';
  const activityId = activityIdFromPath();
  const [busy, setBusy] = React.useState(false);
  const [activity, setActivity] = React.useState<Celebr8Activity | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [printMenuOpen, setPrintMenuOpen] = React.useState(false);
  const [printJob, setPrintJob] = React.useState<{ sheet: PrintSheetKind; printableIndex?: number } | null>(null);

  const load = React.useCallback(async () => {
    if (!isAuthed || activityId <= 0) return;
    setBusy(true);
    try {
      const res = await ApiClient.get<{ success: boolean; activity: Celebr8Activity }>(
        `/api/celebr8.php?action=get_activity&activity_id=${activityId}`,
      );
      setActivity(res.activity || null);
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Failed to load activity' });
    } finally {
      setBusy(false);
    }
  }, [activityId, isAuthed, onToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!printJob) return undefined;
    const t = window.setTimeout(() => {
      window.print();
    }, 150);
    const onAfter = () => setPrintJob(null);
    window.addEventListener('afterprint', onAfter);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('afterprint', onAfter);
    };
  }, [printJob]);

  const startEdit = () => {
    if (!activity) return;
    setDraft(activityToDraft(activity));
    setEditing(true);
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; activity: Celebr8Activity }>(
        '/api/celebr8.php?action=upsert_activity',
        {
          id: draft.id,
          name: draft.name,
          preferred_holiday: draft.preferred_holiday,
          category: draft.category,
          ages: draft.ages,
          description: draft.description,
          summary: draft.summary,
          objective: draft.objective,
          how_to_play: linesToList(draft.how_to_play),
          setup_instructions: linesToList(draft.setup_instructions),
          teardown: linesToList(draft.teardown),
          rules_scoring: draft.rules_scoring,
          winning_notes: draft.winning_notes,
          prizes: draft.prizes || null,
          supplies_detail: parseSuppliesDetail(draft.supplies_detail),
          estimated_cost_low: draft.estimated_cost_low === '' ? null : Number(draft.estimated_cost_low),
          estimated_cost_high: draft.estimated_cost_high === '' ? null : Number(draft.estimated_cost_high),
          setup_minutes: draft.setup_minutes === '' ? null : Number(draft.setup_minutes),
          play_minutes: draft.play_minutes === '' ? null : Number(draft.play_minutes),
          cleanup_minutes: draft.cleanup_minutes === '' ? null : Number(draft.cleanup_minutes),
          min_players: draft.min_players === '' ? null : Number(draft.min_players),
          max_players: draft.max_players === '' ? null : Number(draft.max_players),
          age_range: draft.age_range,
          kid_friendly: draft.kid_friendly,
          location_type: draft.location_type,
          space_needed: draft.space_needed,
          energy_level: draft.energy_level,
          mess_level: draft.mess_level,
          tech_needs: draft.tech_needs,
          volunteers_needed: draft.volunteers_needed,
          safety_notes: draft.safety_notes,
          variations: linesToList(draft.variations),
          tips: draft.tips,
          setup_notes: draft.setup_notes,
          source: draft.source,
          is_suggested: draft.is_suggested,
          senior_friendly: draft.senior_friendly,
          seated_play: draft.seated_play,
          mobility_level: draft.mobility_level,
          hearing_vision_notes: draft.hearing_vision_notes,
          senior_role: draft.senior_role,
        },
      );
      setActivity(res.activity);
      setEditing(false);
      onToast?.({ tone: 'success', message: 'Activity updated' });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Save failed' });
    } finally {
      setBusy(false);
    }
  };

  const copyActivity = async () => {
    if (!activity) return;
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; activity: Celebr8Activity }>(
        '/api/celebr8.php?action=copy_activity',
        { activity_id: activity.id },
      );
      onToast?.({ tone: 'success', message: 'Copied — opening the copy' });
      window.location.href = `/celebr8/activities/${res.activity.id}`;
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Copy failed' });
      setBusy(false);
    }
  };

  const printAll = () => {
    if (!activity) return;
    setPrintJob({ sheet: 'packet' });
  };

  if (!isAuthed) {
    return (
      <PageLayout page="celebr8_activity_detail" title="CELEBR8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
        <section className="section celebr8-page">
          <div className="celebr8-hero"><h1>CELEBR8</h1><p>Sign in to view activity details.</p></div>
        </section>
      </PageLayout>
    );
  }

  return (
    <PageLayout page="celebr8_activity_detail" title="CELEBR8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className={`section celebr8-page${printJob ? ' celebr8-printing' : ''}`}>
        <div className="celebr8-no-print">
          <div className="celebr8-hero">
            <h1>CELEBR8</h1>
            <p className="mb-0"><a href="/celebr8/activities">← Activities library</a></p>
          </div>
          <Celebr8SubNav active="activities" />
        </div>

        {!activity && busy ? <p className="text-muted">Loading…</p> : null}
        {!activity && !busy ? <p className="text-muted">Activity not found.</p> : null}

        {activity ? (
          <>
            <div className="celebr8-panel celebr8-no-print">
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                <div>
                  <h2 className="h3 mb-1">{activity.name}</h2>
                  <p className="small text-muted mb-0">
                    {activity.preferred_holiday || 'Any'} · {activity.category} · ages {activity.ages}
                    {Number(activity.is_suggested) === 1 ? ' · suggested' : ''}
                    {Number(activity.senior_friendly) === 1 ? ' · senior-friendly' : ''}
                    {Number(activity.seated_play) === 1 ? ' · seated' : ''}
                    {activity.mobility_level ? ` · mobility ${activity.mobility_level}` : ''}
                  </p>
                </div>
                <div className="celebr8-toolbar">
                  <div className="dropdown">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPrintMenuOpen((v) => !v)}>
                      Print ▾
                    </button>
                    {printMenuOpen ? (
                      <div className="celebr8-print-menu">
                        <button type="button" className="dropdown-item" onClick={() => { setPrintMenuOpen(false); setPrintJob({ sheet: 'setup' }); }}>Setup Instructions</button>
                        <button type="button" className="dropdown-item" onClick={() => { setPrintMenuOpen(false); setPrintJob({ sheet: 'play' }); }}>How to Play / Rules</button>
                        {(activity.printables || []).map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="dropdown-item"
                            onClick={() => { setPrintMenuOpen(false); setPrintJob({ sheet: 'printable', printableIndex: idx }); }}
                          >
                            {p.title}
                          </button>
                        ))}
                        <button type="button" className="dropdown-item" onClick={() => { setPrintMenuOpen(false); printAll(); }}>Print All</button>
                      </div>
                    ) : null}
                  </div>
                  {isAdmin ? (
                    <>
                      <button type="button" className="btn btn-sm btn-primary" onClick={startEdit} disabled={busy}>Edit</button>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void copyActivity()} disabled={busy}>Copy</button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="celebr8-activity-facts">
                <div><span>Cost</span><strong>{formatUsdRange(activity.estimated_cost_low, activity.estimated_cost_high)}</strong></div>
                <div><span>Setup</span><strong>{formatMinutes(activity.setup_minutes)}</strong></div>
                <div><span>Play</span><strong>{formatMinutes(activity.play_minutes)}</strong></div>
                <div><span>Cleanup</span><strong>{formatMinutes(activity.cleanup_minutes)}</strong></div>
                <div><span>Players</span><strong>{formatPlayers(activity.min_players, activity.max_players)}</strong></div>
                <div><span>Kid-friendly</span><strong>{Number(activity.kid_friendly) === 1 ? 'Yes' : 'No'}</strong></div>
                <div><span>Senior-friendly</span><strong>{Number(activity.senior_friendly) === 1 ? 'Yes' : 'No'}</strong></div>
                <div><span>Seated play</span><strong>{Number(activity.seated_play) === 1 ? 'Yes' : 'No'}</strong></div>
                <div><span>Mobility</span><strong>{activity.mobility_level || '—'}</strong></div>
                <div><span>Where</span><strong>{activity.location_type || 'both'}</strong></div>
                <div><span>Energy</span><strong>{activity.energy_level || '—'}</strong></div>
                <div><span>Mess</span><strong>{activity.mess_level || '—'}</strong></div>
                <div><span>Space</span><strong>{activity.space_needed || '—'}</strong></div>
              </div>

              {activity.summary ? <p className="mt-3">{activity.summary}</p> : <p className="mt-3">{activity.description}</p>}
              {activity.objective ? <><h3 className="h6 mt-3">Objective</h3><p>{activity.objective}</p></> : null}
              {activity.senior_role ? (
                <>
                  <h3 className="h6 mt-3">Elders&apos; role</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{activity.senior_role}</p>
                </>
              ) : null}
              {activity.hearing_vision_notes ? (
                <>
                  <h3 className="h6 mt-3">Hearing / vision accessibility</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{activity.hearing_vision_notes}</p>
                </>
              ) : null}

              {(activity.setup_instructions || []).length > 0 ? (
                <>
                  <h3 className="h6 mt-3">Setup instructions</h3>
                  <ol>{activity.setup_instructions!.map((s, i) => <li key={i}>{s}</li>)}</ol>
                </>
              ) : null}

              {(activity.how_to_play || []).length > 0 ? (
                <>
                  <h3 className="h6 mt-3">How to play</h3>
                  <ol>{activity.how_to_play!.map((s, i) => <li key={i}>{s}</li>)}</ol>
                </>
              ) : null}

              {activity.rules_scoring ? (
                <>
                  <h3 className="h6 mt-3">Rules & scoring</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{activity.rules_scoring}</p>
                </>
              ) : null}

              {(activity.winning_notes || activity.prizes) ? (
                <>
                  <h3 className="h6 mt-3">Winning / prizes</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{activity.winning_notes || activity.prizes}</p>
                </>
              ) : null}

              {(activity.supplies_detail || []).length > 0 || (activity.supplies || []).length > 0 ? (
                <>
                  <h3 className="h6 mt-3">Supplies</h3>
                  <div className="celebr8-guest-table-wrap">
                    <table className="table table-sm celebr8-guest-table">
                      <thead>
                        <tr><th>Item</th><th>Qty</th><th>Est. unit</th><th>Notes</th></tr>
                      </thead>
                      <tbody>
                        {(activity.supplies_detail?.length ? activity.supplies_detail : (activity.supplies || []).map((item) => ({
                          item, qty: '1', unit_cost_est: null as number | null, notes: '', have: 0,
                        }))).map((s, i) => (
                          <tr key={i}>
                            <td>{s.item}</td>
                            <td>{s.qty}</td>
                            <td>{s.unit_cost_est != null ? `$${Number(s.unit_cost_est).toFixed(2)}` : '—'}</td>
                            <td className="small">{s.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {(activity.teardown || []).length > 0 ? (
                <>
                  <h3 className="h6 mt-3">Teardown / cleanup</h3>
                  <ol>{activity.teardown!.map((s, i) => <li key={i}>{s}</li>)}</ol>
                </>
              ) : null}

              {activity.tech_needs ? <><h3 className="h6 mt-3">Power / music / tech</h3><p>{activity.tech_needs}</p></> : null}
              {activity.volunteers_needed ? <><h3 className="h6 mt-3">Hosts / volunteers</h3><p>{activity.volunteers_needed}</p></> : null}
              {activity.safety_notes ? <><h3 className="h6 mt-3">Safety</h3><p>{activity.safety_notes}</p></> : null}
              {activity.tips ? <><h3 className="h6 mt-3">Tips</h3><p style={{ whiteSpace: 'pre-wrap' }}>{activity.tips}</p></> : null}

              {(activity.variations || []).length > 0 ? (
                <>
                  <h3 className="h6 mt-3">Variations / theme ideas</h3>
                  <ul>{activity.variations!.map((v, i) => <li key={i}>{variationText(v)}</li>)}</ul>
                </>
              ) : null}

              {(activity.printables || []).length > 0 ? (
                <>
                  <h3 className="h6 mt-3">Printables included</h3>
                  <ul>
                    {activity.printables!.map((p, i) => (
                      <li key={i}>
                        <button type="button" className="btn btn-link btn-sm px-0" onClick={() => setPrintJob({ sheet: 'printable', printableIndex: i })}>
                          {p.title}
                        </button>
                        <span className="small text-muted"> ({p.kind})</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {activity.setup_notes ? (
                <>
                  <h3 className="h6 mt-3">Legacy setup notes</h3>
                  <p className="small text-muted" style={{ whiteSpace: 'pre-wrap' }}>{activity.setup_notes}</p>
                </>
              ) : null}
              {activity.source ? <p className="small text-muted mb-0">Source: {activity.source}</p> : null}
            </div>

            {printJob ? (
              <div className="celebr8-print-only">
                {printJob.sheet === 'packet' ? (
                  <>
                    <Celebr8ActivityPrintSheets activity={activity} sheet="setup" />
                    <div className="celebr8-print-break" />
                    <Celebr8ActivityPrintSheets activity={activity} sheet="play" />
                    {(activity.printables || []).map((_, idx) => (
                      <React.Fragment key={idx}>
                        <div className="celebr8-print-break" />
                        <Celebr8ActivityPrintSheets activity={activity} sheet="printable" printableIndex={idx} />
                      </React.Fragment>
                    ))}
                  </>
                ) : (
                  <Celebr8ActivityPrintSheets
                    activity={activity}
                    sheet={printJob.sheet}
                    printableIndex={printJob.printableIndex || 0}
                  />
                )}
              </div>
            ) : null}
          </>
        ) : null}

        {editing && draft ? (
          <div className="modal show d-block celebr8-no-print" tabIndex={-1} role="dialog" style={{ background: 'rgba(0,0,0,.45)' }}>
            <div className="modal-dialog modal-xl modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Edit activity</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setEditing(false)} />
                </div>
                <div className="modal-body">
                  <div className="row g-2">
                    <div className="col-md-8"><label className="form-label">Name</label><input className="form-control" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                    <div className="col-md-4">
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
                    <div className="col-md-3">
                      <label className="form-label">Location</label>
                      <select className="form-select" value={draft.location_type} onChange={(e) => setDraft({ ...draft, location_type: e.target.value })}>
                        {['indoor', 'outdoor', 'both'].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Kid-friendly</label>
                      <select className="form-select" value={draft.kid_friendly} onChange={(e) => setDraft({ ...draft, kid_friendly: Number(e.target.value) })}>
                        <option value={1}>Yes</option>
                        <option value={0}>No</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Senior-friendly</label>
                      <select className="form-select" value={draft.senior_friendly} onChange={(e) => setDraft({ ...draft, senior_friendly: Number(e.target.value) })}>
                        <option value={1}>Yes</option>
                        <option value={0}>No</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Seated play</label>
                      <select className="form-select" value={draft.seated_play} onChange={(e) => setDraft({ ...draft, seated_play: Number(e.target.value) })}>
                        <option value={1}>Yes</option>
                        <option value={0}>No</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Mobility level</label>
                      <select className="form-select" value={draft.mobility_level} onChange={(e) => setDraft({ ...draft, mobility_level: e.target.value })}>
                        {['none', 'low', 'moderate', 'high'].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mb-2 mt-2"><label className="form-label">Summary</label><textarea className="form-control" rows={2} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></div>
                  <div className="mb-2"><label className="form-label">Elders&apos; role</label><textarea className="form-control" rows={2} value={draft.senior_role} onChange={(e) => setDraft({ ...draft, senior_role: e.target.value })} placeholder="How older guests take part (judges, timekeepers, seated play, etc.)" /></div>
                  <div className="mb-2"><label className="form-label">Hearing / vision notes</label><textarea className="form-control" rows={2} value={draft.hearing_vision_notes} onChange={(e) => setDraft({ ...draft, hearing_vision_notes: e.target.value })} placeholder="Large print, loud-and-clear calling, lighting, table height…" /></div>
                  <div className="mb-2"><label className="form-label">Objective</label><textarea className="form-control" rows={2} value={draft.objective} onChange={(e) => setDraft({ ...draft, objective: e.target.value })} /></div>
                  <div className="mb-2"><label className="form-label">Description</label><textarea className="form-control" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
                  <div className="row g-2">
                    <div className="col-md-4"><label className="form-label">Cost low (USD)</label><input className="form-control" value={draft.estimated_cost_low} onChange={(e) => setDraft({ ...draft, estimated_cost_low: e.target.value })} /></div>
                    <div className="col-md-4"><label className="form-label">Cost high (USD)</label><input className="form-control" value={draft.estimated_cost_high} onChange={(e) => setDraft({ ...draft, estimated_cost_high: e.target.value })} /></div>
                    <div className="col-md-4"><label className="form-label">Age range</label><input className="form-control" value={draft.age_range} onChange={(e) => setDraft({ ...draft, age_range: e.target.value })} /></div>
                    <div className="col-md-4"><label className="form-label">Setup minutes</label><input className="form-control" value={draft.setup_minutes} onChange={(e) => setDraft({ ...draft, setup_minutes: e.target.value })} /></div>
                    <div className="col-md-4"><label className="form-label">Play minutes</label><input className="form-control" value={draft.play_minutes} onChange={(e) => setDraft({ ...draft, play_minutes: e.target.value })} /></div>
                    <div className="col-md-4"><label className="form-label">Cleanup minutes</label><input className="form-control" value={draft.cleanup_minutes} onChange={(e) => setDraft({ ...draft, cleanup_minutes: e.target.value })} /></div>
                    <div className="col-md-4"><label className="form-label">Min players</label><input className="form-control" value={draft.min_players} onChange={(e) => setDraft({ ...draft, min_players: e.target.value })} /></div>
                    <div className="col-md-4"><label className="form-label">Max players</label><input className="form-control" value={draft.max_players} onChange={(e) => setDraft({ ...draft, max_players: e.target.value })} /></div>
                    <div className="col-md-4"><label className="form-label">Space needed</label><input className="form-control" value={draft.space_needed} onChange={(e) => setDraft({ ...draft, space_needed: e.target.value })} /></div>
                    <div className="col-md-4">
                      <label className="form-label">Energy</label>
                      <select className="form-select" value={draft.energy_level} onChange={(e) => setDraft({ ...draft, energy_level: e.target.value })}>
                        {['low', 'medium', 'high'].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Mess</label>
                      <select className="form-select" value={draft.mess_level} onChange={(e) => setDraft({ ...draft, mess_level: e.target.value })}>
                        {['low', 'medium', 'high'].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4"><label className="form-label">Volunteers</label><input className="form-control" value={draft.volunteers_needed} onChange={(e) => setDraft({ ...draft, volunteers_needed: e.target.value })} /></div>
                  </div>
                  <div className="mb-2 mt-2"><label className="form-label">Setup instructions (one step per line)</label><textarea className="form-control" rows={4} value={draft.setup_instructions} onChange={(e) => setDraft({ ...draft, setup_instructions: e.target.value })} /></div>
                  <div className="mb-2"><label className="form-label">How to play (one step per line)</label><textarea className="form-control" rows={4} value={draft.how_to_play} onChange={(e) => setDraft({ ...draft, how_to_play: e.target.value })} /></div>
                  <div className="mb-2"><label className="form-label">Rules & scoring</label><textarea className="form-control" rows={3} value={draft.rules_scoring} onChange={(e) => setDraft({ ...draft, rules_scoring: e.target.value })} /></div>
                  <div className="mb-2"><label className="form-label">Winning / prizes notes</label><textarea className="form-control" rows={2} value={draft.winning_notes} onChange={(e) => setDraft({ ...draft, winning_notes: e.target.value })} /></div>
                  <div className="mb-2"><label className="form-label">Supplies detail (item | qty | unit cost | notes)</label><textarea className="form-control" rows={5} value={draft.supplies_detail} onChange={(e) => setDraft({ ...draft, supplies_detail: e.target.value })} /></div>
                  <div className="mb-2"><label className="form-label">Teardown (one step per line)</label><textarea className="form-control" rows={3} value={draft.teardown} onChange={(e) => setDraft({ ...draft, teardown: e.target.value })} /></div>
                  <div className="mb-2"><label className="form-label">Tech needs</label><textarea className="form-control" rows={2} value={draft.tech_needs} onChange={(e) => setDraft({ ...draft, tech_needs: e.target.value })} /></div>
                  <div className="mb-2"><label className="form-label">Safety notes</label><textarea className="form-control" rows={2} value={draft.safety_notes} onChange={(e) => setDraft({ ...draft, safety_notes: e.target.value })} /></div>
                  <div className="mb-2"><label className="form-label">Variations (one per line)</label><textarea className="form-control" rows={3} value={draft.variations} onChange={(e) => setDraft({ ...draft, variations: e.target.value })} /></div>
                  <div className="mb-2"><label className="form-label">Tips</label><textarea className="form-control" rows={3} value={draft.tips} onChange={(e) => setDraft({ ...draft, tips: e.target.value })} /></div>
                  <div className="mb-2"><label className="form-label">Legacy setup notes</label><textarea className="form-control" rows={2} value={draft.setup_notes} onChange={(e) => setDraft({ ...draft, setup_notes: e.target.value })} /></div>
                  <div className="mb-2"><label className="form-label">Source</label><input className="form-control" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} /></div>
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
