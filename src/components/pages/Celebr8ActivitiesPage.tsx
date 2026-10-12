import React from 'react';

import { Celebr8SubNav } from '../celebr8/Celebr8SubNav';
import { PageLayout } from '../layout/PageLayout';
import { ApiClient } from '../../core/ApiClient';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { CELEBR8_HOLIDAYS, Celebr8Activity } from '../../types/celebr8';
import {
  activityHref,
  costSortValue,
  formatMinutes,
  formatPlayers,
  formatUsdRange,
} from '../celebr8/celebr8ActivityFormat';
import './Celebr8Page.css';

type SortKey =
  | 'name'
  | 'holiday'
  | 'category'
  | 'cost'
  | 'setup'
  | 'play'
  | 'players'
  | 'ages'
  | 'kid'
  | 'senior'
  | 'seated'
  | 'mobility'
  | 'location'
  | 'mess'
  | 'energy';

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
  const [location, setLocation] = React.useState('');
  const [kidOnly, setKidOnly] = React.useState(false);
  const [seniorOnly, setSeniorOnly] = React.useState(false);
  const [seatedOnly, setSeatedOnly] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [view, setView] = React.useState<'cards' | 'compare'>('cards');
  const [sortKey, setSortKey] = React.useState<SortKey>('name');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

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
    let rows = activities.filter((a) => {
      if (location) {
        const loc = a.location_type || 'both';
        if (location === 'both') {
          if (loc !== 'both') return false;
        } else if (loc !== location && loc !== 'both') {
          return false;
        }
      }
      if (kidOnly && Number(a.kid_friendly || 0) !== 1 && a.ages !== 'kids') return false;
      if (seniorOnly && Number(a.senior_friendly || 0) !== 1) return false;
      if (seatedOnly && Number(a.seated_play || 0) !== 1) return false;
      if (!needle) return true;
      const hay = `${a.name} ${a.description} ${a.summary || ''} ${a.senior_role || ''} ${a.category} ${a.source} ${a.preferred_holiday} ${(a.party_types || []).join(' ')}`.toLowerCase();
      return hay.includes(needle);
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const cmp = (x: string | number, y: string | number) => {
        if (x < y) return -1 * dir;
        if (x > y) return 1 * dir;
        return 0;
      };
      switch (sortKey) {
        case 'holiday': return cmp(a.preferred_holiday || '', b.preferred_holiday || '');
        case 'category': return cmp(a.category || '', b.category || '');
        case 'cost': return cmp(costSortValue(a), costSortValue(b));
        case 'setup': return cmp(a.setup_minutes ?? 9999, b.setup_minutes ?? 9999);
        case 'play': return cmp(a.play_minutes ?? 9999, b.play_minutes ?? 9999);
        case 'players': return cmp(a.min_players ?? 0, b.min_players ?? 0);
        case 'ages': return cmp(a.ages || '', b.ages || '');
        case 'kid': return cmp(Number(a.kid_friendly || 0), Number(b.kid_friendly || 0));
        case 'senior': return cmp(Number(a.senior_friendly || 0), Number(b.senior_friendly || 0));
        case 'seated': return cmp(Number(a.seated_play || 0), Number(b.seated_play || 0));
        case 'mobility': return cmp(a.mobility_level || '', b.mobility_level || '');
        case 'location': return cmp(a.location_type || '', b.location_type || '');
        case 'mess': return cmp(a.mess_level || '', b.mess_level || '');
        case 'energy': return cmp(a.energy_level || '', b.energy_level || '');
        default: return cmp(a.name.toLowerCase(), b.name.toLowerCase());
      }
    });
    return rows;
  }, [activities, ages, kidOnly, location, q, seatedOnly, seniorOnly, sortDir, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const exportCsv = () => {
    const headers = [
      'Name', 'Holiday', 'Category', 'Ages', 'Kid-friendly', 'Senior-friendly', 'Seated', 'Mobility',
      'Location', 'Cost low', 'Cost high',
      'Setup min', 'Play min', 'Cleanup min', 'Min players', 'Max players', 'Energy', 'Mess', 'Space', 'Senior role',
    ];
    const lines = [headers.join(',')];
    for (const a of filtered) {
      const cells = [
        a.name, a.preferred_holiday, a.category, a.ages,
        Number(a.kid_friendly) === 1 ? 'yes' : 'no',
        Number(a.senior_friendly) === 1 ? 'yes' : 'no',
        Number(a.seated_play) === 1 ? 'yes' : 'no',
        a.mobility_level || '',
        a.location_type || '',
        a.estimated_cost_low ?? '', a.estimated_cost_high ?? '',
        a.setup_minutes ?? '', a.play_minutes ?? '', a.cleanup_minutes ?? '',
        a.min_players ?? '', a.max_players ?? '',
        a.energy_level || '', a.mess_level || '', a.space_needed || '',
        a.senior_role || '',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'celebr8-activities-comparison.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyActivity = async (a: Celebr8Activity) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<{ success: boolean; activity: Celebr8Activity }>(
        '/api/celebr8.php?action=copy_activity',
        { activity_id: a.id },
      );
      onToast?.({ tone: 'success', message: 'Copied' });
      window.location.href = activityHref(res.activity.id);
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || 'Copy failed' });
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
        <div className="celebr8-hero celebr8-no-print">
          <h1>CELEBR8</h1>
          <p className="mb-0">Shared activity library — click any activity for full details, printables, and costs. Costs are 2026 USD estimates.</p>
        </div>
        <div className="celebr8-no-print"><Celebr8SubNav active="activities" /></div>

        <div className="celebr8-panel">
          <div className="celebr8-toolbar celebr8-no-print">
            <input className="form-control" style={{ maxWidth: 200 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="form-select" style={{ maxWidth: 160 }} value={holiday} onChange={(e) => setHoliday(e.target.value)}>
              <option value="">All holidays</option>
              {CELEBR8_HOLIDAYS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <select className="form-select" style={{ maxWidth: 130 }} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {['contest', 'music', 'food', 'game', 'kids', 'other'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="form-select" style={{ maxWidth: 110 }} value={ages} onChange={(e) => setAges(e.target.value)}>
              <option value="">All ages</option>
              <option value="all">all</option>
              <option value="kids">kids</option>
              <option value="adults">adults</option>
            </select>
            <select className="form-select" style={{ maxWidth: 120 }} value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">Indoor/outdoor</option>
              <option value="indoor">indoor</option>
              <option value="outdoor">outdoor</option>
              <option value="both">both</option>
            </select>
            <label className="small mb-0">
              <input type="checkbox" checked={kidOnly} onChange={(e) => setKidOnly(e.target.checked)} /> Kid-friendly
            </label>
            <button
              type="button"
              className={`btn btn-sm ${seniorOnly ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setSeniorOnly((v) => !v)}
            >
              Senior-friendly
            </button>
            <button
              type="button"
              className={`btn btn-sm ${seatedOnly ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setSeatedOnly((v) => !v)}
            >
              Seated
            </button>
            <button type="button" className={`btn btn-sm ${view === 'cards' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setView('cards')}>Cards</button>
            <button type="button" className={`btn btn-sm ${view === 'compare' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setView('compare')}>Compare table</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={exportCsv}>Export CSV</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => window.print()}>Print table</button>
            {isAdmin ? (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    const name = window.prompt('New activity name?');
                    if (!name || !name.trim()) return;
                    setBusy(true);
                    try {
                      const res = await ApiClient.post<{ success: boolean; activity: Celebr8Activity }>(
                        '/api/celebr8.php?action=upsert_activity',
                        { name: name.trim(), category: 'other', ages: 'all', preferred_holiday: 'Any' },
                      );
                      window.location.href = activityHref(res.activity.id);
                    } catch (error: any) {
                      onToast?.({ tone: 'error', message: error?.message || 'Create failed' });
                      setBusy(false);
                    }
                  })();
                }}
              >
                Add activity
              </button>
            ) : null}
            <span className="small text-muted ms-auto">{filtered.length} shown{busy ? '…' : ''}</span>
          </div>

          {view === 'cards' ? (
            <ul className="celebr8-activity-card-list">
              {filtered.map((a) => (
                <li key={a.id}>
                  <a className="celebr8-activity-card" href={activityHref(a.id)}>
                    <strong>{a.name}</strong>
                    {Number(a.is_suggested) === 1 ? <span className="celebr8-flag ms-1">suggested</span> : null}
                    <span className="small d-block text-muted">{a.preferred_holiday || 'Any'} · {a.category} · {a.ages}</span>
                    <span className="small d-block">{a.summary || a.description}</span>
                    <span className="small d-block mt-1">
                      {formatUsdRange(a.estimated_cost_low, a.estimated_cost_high)}
                      {' · '}setup {formatMinutes(a.setup_minutes)}
                      {' · '}play {formatMinutes(a.play_minutes)}
                      {' · '}{a.location_type || 'both'}
                      {' · '}{Number(a.kid_friendly) === 1 ? 'kid-friendly' : 'adults ok'}
                      {Number(a.senior_friendly) === 1 ? ' · senior-friendly' : ''}
                      {Number(a.seated_play) === 1 ? ' · seated' : ''}
                    </span>
                  </a>
                  {isAdmin ? (
                    <div className="celebr8-toolbar mt-1 celebr8-no-print">
                      <a className="btn btn-link btn-sm px-0" href={`${activityHref(a.id)}`}>Open</a>
                      <button type="button" className="btn btn-link btn-sm" onClick={() => void copyActivity(a)}>Copy</button>
                      <button type="button" className="btn btn-link btn-sm text-danger" onClick={() => void remove(a)}>Delete</button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="celebr8-guest-table-wrap celebr8-compare-print">
              <table className="table table-sm align-middle celebr8-guest-table celebr8-compare-table">
                <thead>
                  <tr>
                    {([
                      ['name', 'Name'],
                      ['holiday', 'Holiday'],
                      ['category', 'Category'],
                      ['cost', 'Cost'],
                      ['setup', 'Setup'],
                      ['play', 'Play'],
                      ['players', 'Players'],
                      ['ages', 'Ages'],
                      ['kid', 'Kids'],
                      ['senior', 'Senior'],
                      ['seated', 'Seated'],
                      ['mobility', 'Mobility'],
                      ['location', 'In/Out'],
                      ['energy', 'Energy'],
                      ['mess', 'Mess'],
                    ] as Array<[SortKey, string]>).map(([key, label]) => (
                      <th key={key}>
                        <button type="button" className="btn btn-link btn-sm px-0 celebr8-no-print" onClick={() => toggleSort(key)}>
                          {label}{sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </button>
                        <span className="celebr8-print-only">{label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <a href={activityHref(a.id)}><strong>{a.name}</strong></a>
                        {Number(a.is_suggested) === 1 ? <span className="celebr8-flag ms-1">suggested</span> : null}
                      </td>
                      <td className="small">{a.preferred_holiday || 'Any'}</td>
                      <td>{a.category}</td>
                      <td className="small">{formatUsdRange(a.estimated_cost_low, a.estimated_cost_high)}</td>
                      <td>{formatMinutes(a.setup_minutes)}</td>
                      <td>{formatMinutes(a.play_minutes)}</td>
                      <td>{formatPlayers(a.min_players, a.max_players)}</td>
                      <td>{a.ages}{a.age_range ? ` (${a.age_range})` : ''}</td>
                      <td>{Number(a.kid_friendly) === 1 ? 'Yes' : 'No'}</td>
                      <td>{Number(a.senior_friendly) === 1 ? 'Yes' : 'No'}</td>
                      <td>{Number(a.seated_play) === 1 ? 'Yes' : 'No'}</td>
                      <td>{a.mobility_level || '—'}</td>
                      <td>{a.location_type || '—'}</td>
                      <td>{a.energy_level || '—'}</td>
                      <td>{a.mess_level || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </PageLayout>
  );
}
