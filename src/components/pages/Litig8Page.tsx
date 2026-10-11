import React from 'react';

import { NavBar } from '../layout/NavBar';
import { useLitig8 } from '../../hooks/useLitig8';
import type { Litig8Entity, Litig8Record } from '../../types/litig8';
import type { SharedLayoutProps } from '../../entries/appConfig';
import './Litig8Page.css';

type ToastFn = (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;

type Props = SharedLayoutProps & {
  onToast?: ToastFn;
};

type Tab = 'dashboard' | 'matters' | 'deadlines' | 'contacts' | 'documents';

function sourceLabel(record: Litig8Record): string {
  const source = record.source;
  if (!source) {
    return 'Source: manual / unknown';
  }
  const bits = [
    source.source_type,
    source.account,
    source.record_type,
    source.record_id,
    source.message_date,
    source.file_path,
  ].filter(Boolean);
  return `Source: ${bits.join(' · ')}`;
}

function RecordList({
  title,
  records,
  total,
  primary,
  secondary,
  onSelect,
  onDelete,
  canEdit,
  overdueKey,
}: {
  title: string;
  records: Litig8Record[];
  total?: number;
  primary: (r: Litig8Record) => string;
  secondary?: (r: Litig8Record) => string;
  onSelect?: (r: Litig8Record) => void;
  onDelete?: (id: number) => void;
  canEdit: boolean;
  overdueKey?: boolean;
}) {
  return (
    <section className="litig8-section">
      <h2>
        {title}
        {typeof total === 'number' ? <span className="litig8-count">{total} total</span> : null}
      </h2>
      {records.length === 0 ? (
        <div className="litig8-empty">None on file.</div>
      ) : (
        <ul className="litig8-list">
          {records.map((record) => (
            <li
              className={'litig8-item' + (overdueKey && record.is_overdue ? ' overdue' : '')}
              key={String(record.id)}
            >
              <strong>
                {onSelect ? (
                  <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => onSelect(record)}>
                    {primary(record)}
                  </button>
                ) : (
                  primary(record)
                )}
              </strong>
              {secondary ? <span className="litig8-meta">{secondary(record)}</span> : null}
              <span className="litig8-source">{sourceLabel(record)}</span>
              {canEdit && onDelete && record.id ? (
                <div className="litig8-actions">
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(Number(record.id))}>
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Litig8Page({ viewer, isAdmin, onLoginClick, onLogout, onAccountClick, onToast }: Props) {
  const litig8 = useLitig8();
  const [tab, setTab] = React.useState<Tab>('dashboard');
  const [matterForm, setMatterForm] = React.useState({
    title: '',
    category: 'disputes',
    status: 'open',
    summary: '',
  });
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    void (async () => {
      try {
        await litig8.bootstrap();
        await litig8.loadDashboard();
        await litig8.refreshLists();
      } catch {
        // error surfaced via hook
      }
    })();
  }, [litig8.bootstrap, litig8.loadDashboard, litig8.refreshLists]);

  const canEdit = Boolean(
    isAdmin
    || Number(viewer?.is_admin || 0) === 1
    || Number(viewer?.is_administrator || 0) === 1
    || Number(viewer?.is_litig8_user || 0) === 1,
  );
  const dashboard = litig8.dashboard;

  const toast = (tone: 'success' | 'error' | 'info' | 'warning', message: string) => {
    onToast?.({ tone, message });
  };

  const handleDelete = async (entity: Litig8Entity, id: number) => {
    try {
      await litig8.remove(entity, id);
      toast('success', 'Deleted');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleAddMatter = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!matterForm.title.trim()) {
      return;
    }
    try {
      await litig8.upsert('matters', {
        title: matterForm.title.trim(),
        category: matterForm.category,
        status: matterForm.status,
        summary: matterForm.summary,
        source_type: 'manual',
        record_type: 'matters',
      });
      setMatterForm({ title: '', category: matterForm.category, status: 'open', summary: '' });
      toast('success', 'Matter saved');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      await litig8.uploadDocument(file, file.name);
      toast('success', 'Document uploaded');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      event.target.value = '';
    }
  };

  const categoryOptions = litig8.categories.length > 0
    ? litig8.categories
    : [
        { slug: 'disputes', label: 'Disputes' },
        { slug: 'contracts', label: 'Contracts' },
        { slug: 'property-deeds', label: 'Property / deeds' },
        { slug: 'cabin-permits-zoning', label: 'Cabin permits / zoning' },
        { slug: 'estate', label: 'Estate' },
        { slug: 'tax', label: 'Tax' },
        { slug: 'business-filings', label: 'Business filings' },
        { slug: 'insurance-claims', label: 'Insurance claims' },
        { slug: 'disability-legal', label: 'Disability legal' },
        { slug: 'citations', label: 'Citations' },
      ];

  const selectedMatter = litig8.matters.find((m) => Number(m.id) === litig8.selectedMatterId) || null;

  return (
    <div className="litig8-page">
      <NavBar
        active="litig8"
        viewer={viewer}
        isAdmin={isAdmin}
        onLoginClick={onLoginClick}
        onLogout={onLogout}
        onAccountClick={onAccountClick}
      />
      <div className="litig8-shell">
        <header className="litig8-hero">
          <div>
            <h1>LITIG8</h1>
            <p>Private record of legal matters, deadlines, contacts, and documents.</p>
          </div>
          <div className="litig8-actions">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void litig8.loadDashboard()}>
              Refresh
            </button>
          </div>
        </header>

        {litig8.error ? <div className="alert alert-danger">{litig8.error}</div> : null}

        <div className="litig8-tabs">
          {([
            ['dashboard', 'Dashboard'],
            ['matters', 'Matters'],
            ['deadlines', 'Deadlines'],
            ['contacts', 'Contacts'],
            ['documents', 'Documents'],
          ] as Array<[Tab, string]>).map(([key, label]) => (
            <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {litig8.loading && !dashboard ? <div className="litig8-empty">Loading…</div> : null}

        {tab === 'dashboard' && dashboard ? (
          <>
            <div className="litig8-totals">
              <span><strong>{dashboard.matters_total}</strong> matters</span>
              <span><strong>{dashboard.deadlines_total}</strong> deadlines</span>
              <span><strong>{dashboard.events_total}</strong> events</span>
              <span><strong>{dashboard.contacts_total}</strong> contacts</span>
              <span><strong>{dashboard.documents_total}</strong> documents</span>
            </div>
            <div className="litig8-grid">
              <RecordList
                title="Upcoming / overdue deadlines"
                records={dashboard.upcoming_deadlines}
                overdueKey
                canEdit={false}
                primary={(r) => String(r.title || 'Deadline')}
                secondary={(r) => `${r.is_overdue ? 'OVERDUE · ' : ''}Due ${String(r.due_at || '—')}${r.matter_id ? ` · matter #${r.matter_id}` : ''}`}
              />
              <section className="litig8-section">
                <h2>Open matters by category</h2>
                {Object.keys(dashboard.open_matters_by_category).length === 0 ? (
                  <div className="litig8-empty">None open.</div>
                ) : (
                  <ul className="litig8-list">
                    {Object.entries(dashboard.open_matters_by_category).map(([slug, count]) => (
                      <li className="litig8-item" key={slug}>
                        <strong>{slug || '(uncategorized)'}</strong>
                        <span className="litig8-meta">{count} open</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <RecordList
                title="Recent events"
                records={dashboard.recent_events}
                canEdit={false}
                primary={(r) => String(r.title || 'Event')}
                secondary={(r) => `${String(r.event_date || '—')}${r.matter_id ? ` · matter #${r.matter_id}` : ''}`}
              />
            </div>
          </>
        ) : null}

        {tab === 'matters' ? (
          <div className="litig8-grid">
            <RecordList
              title="Matters"
              records={litig8.matters}
              total={dashboard?.matters_total}
              canEdit={canEdit}
              onDelete={(id) => void handleDelete('matters', id)}
              onSelect={(r) => void litig8.loadMatterDetail(Number(r.id))}
              primary={(r) => String(r.title || `Matter ${r.id}`)}
              secondary={(r) => `${String(r.category_slug || '—')} · ${String(r.status || '—')}`}
            />
            <section className="litig8-section">
              <h2>{selectedMatter ? `Timeline · ${String(selectedMatter.title)}` : 'Matter detail'}</h2>
              {!selectedMatter ? (
                <div className="litig8-empty">Select a matter to see timeline and deadlines.</div>
              ) : (
                <>
                  <p className="litig8-meta">{String(selectedMatter.summary || 'No summary.')}</p>
                  <RecordList
                    title="Events"
                    records={litig8.matterEvents}
                    canEdit={canEdit}
                    onDelete={(id) => void handleDelete('events', id)}
                    primary={(r) => String(r.title || 'Event')}
                    secondary={(r) => String(r.event_date || '—')}
                  />
                  <RecordList
                    title="Deadlines"
                    records={litig8.matterDeadlines}
                    canEdit={canEdit}
                    overdueKey
                    onDelete={(id) => void handleDelete('deadlines', id)}
                    primary={(r) => String(r.title || 'Deadline')}
                    secondary={(r) => `${r.is_overdue ? 'OVERDUE · ' : ''}Due ${String(r.due_at || '—')}`}
                  />
                </>
              )}
              {canEdit ? (
                <form className="litig8-form-grid" onSubmit={(e) => void handleAddMatter(e)}>
                  <input
                    placeholder="Matter title"
                    value={matterForm.title}
                    onChange={(e) => setMatterForm((s) => ({ ...s, title: e.target.value }))}
                    required
                  />
                  <select
                    value={matterForm.category}
                    onChange={(e) => setMatterForm((s) => ({ ...s, category: e.target.value }))}
                  >
                    {categoryOptions.map((cat) => (
                      <option key={String(cat.slug)} value={String(cat.slug)}>
                        {String(cat.label || cat.slug)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={matterForm.status}
                    onChange={(e) => setMatterForm((s) => ({ ...s, status: e.target.value }))}
                  >
                    <option value="open">open</option>
                    <option value="pending">pending</option>
                    <option value="closed">closed</option>
                  </select>
                  <textarea
                    placeholder="Summary"
                    value={matterForm.summary}
                    onChange={(e) => setMatterForm((s) => ({ ...s, summary: e.target.value }))}
                    rows={3}
                  />
                  <button type="submit" className="btn btn-sm btn-primary">Add matter</button>
                </form>
              ) : null}
            </section>
          </div>
        ) : null}

        {tab === 'deadlines' ? (
          <RecordList
            title="All deadlines"
            records={dashboard?.upcoming_deadlines || []}
            total={dashboard?.deadlines_total}
            canEdit={canEdit}
            overdueKey
            onDelete={(id) => void handleDelete('deadlines', id)}
            primary={(r) => String(r.title || 'Deadline')}
            secondary={(r) => `${r.is_overdue ? 'OVERDUE · ' : ''}Due ${String(r.due_at || '—')}${r.matter_id ? ` · matter #${r.matter_id}` : ''}`}
          />
        ) : null}

        {tab === 'contacts' ? (
          <RecordList
            title="Contacts"
            records={litig8.contacts}
            total={dashboard?.contacts_total}
            canEdit={canEdit}
            onDelete={(id) => void handleDelete('contacts', id)}
            primary={(r) => String(r.name || `Contact ${r.id}`)}
            secondary={(r) => `${String(r.contact_type || '—')}${r.organization ? ` · ${String(r.organization)}` : ''}`}
          />
        ) : null}

        {tab === 'documents' ? (
          <section className="litig8-section">
            <h2>
              Document vault
              {typeof dashboard?.documents_total === 'number' ? (
                <span className="litig8-count">{dashboard.documents_total} total</span>
              ) : null}
            </h2>
            {litig8.documents.length === 0 ? (
              <div className="litig8-empty">None on file.</div>
            ) : (
              <ul className="litig8-list">
                {litig8.documents.map((doc) => (
                  <li className="litig8-item" key={String(doc.id)}>
                    <strong>
                      {doc.media_url ? (
                        <a href={String(doc.media_url)} target="_blank" rel="noreferrer">{String(doc.title || doc.id)}</a>
                      ) : (
                        String(doc.title || doc.id)
                      )}
                    </strong>
                    <span className="litig8-meta">{String(doc.doc_type || 'document')}</span>
                    <span className="litig8-source">{sourceLabel(doc)}</span>
                    {canEdit ? (
                      <div className="litig8-actions">
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void handleDelete('documents', Number(doc.id))}>
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canEdit ? (
              <div className="litig8-actions" style={{ marginTop: '0.75rem' }}>
                <input ref={fileRef} type="file" onChange={(e) => void handleUpload(e)} />
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
