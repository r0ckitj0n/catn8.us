import React from 'react';

import { NavBar } from '../layout/NavBar';
import { useMedic8 } from '../../hooks/useMedic8';
import type { Medic8Entity, Medic8Record } from '../../types/medic8';
import type { SharedLayoutProps } from '../../entries/appConfig';
import './Medic8Page.css';

type ToastFn = (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;

type Props = SharedLayoutProps & {
  onToast?: ToastFn;
};

function sourceLabel(record: Medic8Record): string {
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
  primary,
  secondary,
  onDelete,
  onReveal,
  canEdit,
}: {
  title: string;
  records: Medic8Record[];
  primary: (r: Medic8Record) => string;
  secondary?: (r: Medic8Record) => string;
  onDelete?: (id: number) => void;
  onReveal?: (id: number) => void;
  canEdit: boolean;
}) {
  return (
    <section className="medic8-section">
      <h2>{title}</h2>
      {records.length === 0 ? (
        <div className="medic8-empty">None on file.</div>
      ) : (
        <ul className="medic8-list">
          {records.map((record) => (
            <li className="medic8-item" key={String(record.id)}>
              <strong>{primary(record)}</strong>
              {secondary ? <span className="medic8-meta">{secondary(record)}</span> : null}
              <span className="medic8-source">{sourceLabel(record)}</span>
              {(canEdit && (onDelete || onReveal) && record.id) ? (
                <div className="medic8-actions">
                  {onReveal ? (
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onReveal(Number(record.id))}>
                      Reveal
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(Number(record.id))}>
                      Delete
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Medic8Page({ viewer, isAdmin, onLoginClick, onLogout, onAccountClick, mysteryTitle, onToast }: Props) {
  const medic8 = useMedic8();
  const [section, setSection] = React.useState<'dashboard' | 'print'>('dashboard');
  const [medForm, setMedForm] = React.useState({ name: '', strength: '', dose_per_admin: '', frequency: '', status: 'current' });
  const [printSummary, setPrintSummary] = React.useState<Awaited<ReturnType<typeof medic8.loadEmergencySummary>> | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    void medic8.bootstrap().catch(() => undefined);
  }, [medic8.bootstrap]);

  React.useEffect(() => {
    if (medic8.personId) {
      void medic8.loadDashboard(medic8.personId).catch(() => undefined);
    }
  }, [medic8.personId, medic8.loadDashboard]);

  const canEdit = Boolean(isAdmin || Number(viewer?.is_admin || 0) === 1 || Number(viewer?.is_administrator || 0) === 1 || Number(viewer?.is_medic8_user || 0) === 1);
  const dashboard = medic8.dashboard;

  const toast = (tone: 'success' | 'error' | 'info' | 'warning', message: string) => {
    onToast?.({ tone, message });
  };

  const handleDelete = async (entity: Medic8Entity, id: number) => {
    try {
      await medic8.remove(entity, id);
      toast('success', 'Deleted');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleReveal = async (entity: Medic8Entity, id: number) => {
    try {
      const record = await medic8.revealSensitive(entity, id);
      const member = String(record.member_id || record.ssn || record.medicare_number || record.case_number || 'revealed');
      toast('info', `Revealed (audited): ${member}`);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Reveal failed');
    }
  };

  const handleAddMed = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!medic8.personId || !medForm.name.trim()) {
      return;
    }
    try {
      await medic8.upsert('medications', {
        person_id: medic8.personId,
        ...medForm,
        source_type: 'manual',
        record_type: 'medications',
      });
      setMedForm({ name: '', strength: '', dose_per_admin: '', frequency: '', status: 'current' });
      toast('success', 'Medication saved');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handlePrint = async () => {
    if (!medic8.personId) {
      return;
    }
    try {
      const summary = await medic8.loadEmergencySummary(medic8.personId);
      setPrintSummary(summary);
      setSection('print');
      window.setTimeout(() => window.print(), 50);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Print prep failed');
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !medic8.personId) {
      return;
    }
    try {
      await medic8.uploadDocument(medic8.personId, file, file.name);
      toast('success', 'Document uploaded');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="medic8-page">
      <NavBar
        active="medic8"
        viewer={viewer}
        isAdmin={isAdmin}
        onLoginClick={onLoginClick}
        onLogout={onLogout}
        onAccountClick={onAccountClick}
      />
      <div className="medic8-shell">
        <header className="medic8-hero">
          <div>
            <h1>MEDIC8</h1>
            <p>Private health hub for opted-in people. Every fact keeps its source citation.</p>
            {mysteryTitle ? <p className="medic8-meta">{mysteryTitle}</p> : null}
          </div>
          <div className="medic8-toolbar medic8-no-print">
            <label>
              Person
              <select
                className="form-select form-select-sm"
                value={medic8.personId ?? ''}
                onChange={(e) => medic8.setPersonId(Number(e.target.value) || null)}
              >
                {medic8.people.map((person) => (
                  <option key={person.id} value={person.id}>{person.display_name}</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => medic8.personId && void medic8.loadDashboard(medic8.personId)}>
              Refresh
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => void handlePrint()}>
              Print emergency / med list
            </button>
          </div>
        </header>

        {medic8.error ? <div className="alert alert-danger">{medic8.error}</div> : null}
        {medic8.loading && !dashboard ? <div className="medic8-empty">Loading…</div> : null}

        {section === 'print' && printSummary ? (
          <div className="medic8-print-only">
            <h2>Emergency summary — {printSummary.person.display_name}</h2>
            <p>Generated {printSummary.generated_at}</p>
            <h3>Allergies</h3>
            <ul>{printSummary.allergies.map((a) => <li key={String(a.id)}>{String(a.allergen)} — {String(a.reaction || '')}</li>)}</ul>
            <h3>Conditions</h3>
            <ul>{printSummary.conditions.map((c) => <li key={String(c.id)}>{String(c.name)}</li>)}</ul>
            <h3>Current medications</h3>
            <ul>
              {printSummary.medications_current.map((m) => (
                <li key={String(m.id)}>
                  {String(m.name)} {String(m.strength || '')} — {String(m.dose_per_admin || '')} {String(m.frequency || '')}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {dashboard ? (
          <>
            {dashboard.refills_due_14d.length > 0 ? (
              <section className="medic8-section" style={{ marginBottom: '1rem' }}>
                <h2 className="medic8-warn-text">Refills due in 14 days</h2>
                <ul className="medic8-list">
                  {dashboard.refills_due_14d.map((med) => (
                    <li className="medic8-item" key={String(med.id)}>
                      <strong>{String(med.name)} {String(med.strength || '')}</strong>
                      <span className="medic8-meta">Next due {String(med.next_refill_due || '—')} · left {String(med.refills_left ?? '—')}</span>
                      <span className="medic8-source">{sourceLabel(med)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="medic8-grid">
              <RecordList
                title="Current medications"
                records={dashboard.medications_current}
                canEdit={canEdit}
                primary={(r) => `${String(r.name)} ${String(r.strength || '')}`.trim()}
                secondary={(r) => `${String(r.dose_per_admin || '')} ${String(r.frequency || '')} · refill ${String(r.next_refill_due || '—')}`}
                onDelete={(id) => void handleDelete('medications', id)}
              />
              <RecordList
                title="Conditions"
                records={dashboard.conditions}
                canEdit={canEdit}
                primary={(r) => String(r.name)}
                secondary={(r) => `${String(r.status || '')} ${r.onset_date ? `· onset ${String(r.onset_date)}` : ''}`}
                onDelete={(id) => void handleDelete('conditions', id)}
              />
              <RecordList
                title="Allergies"
                records={dashboard.allergies}
                canEdit={canEdit}
                primary={(r) => String(r.allergen)}
                secondary={(r) => String(r.reaction || '')}
                onDelete={(id) => void handleDelete('allergies', id)}
              />
              <RecordList
                title="Upcoming appointments"
                records={dashboard.appointments_upcoming}
                canEdit={canEdit}
                primary={(r) => String(r.purpose || 'Appointment')}
                secondary={(r) => `${String(r.starts_at || '')} · ${String(r.location || '')}`}
                onDelete={(id) => void handleDelete('appointments', id)}
              />
              <RecordList
                title="Providers"
                records={dashboard.providers}
                canEdit={canEdit}
                primary={(r) => String(r.name)}
                secondary={(r) => {
                  const phone = r.phone ? `tel:${String(r.phone)}` : '';
                  return `${String(r.specialty || '')}${r.phone ? ` · ${String(r.phone)}` : ''}${r.portal_url ? ` · ${String(r.portal_url)}` : ''}${phone ? '' : ''}`;
                }}
                onDelete={(id) => void handleDelete('providers', id)}
              />
              <RecordList
                title="Recent labs"
                records={dashboard.labs_recent}
                canEdit={canEdit}
                primary={(r) => `${String(r.test)}: ${String(r.value || '')} ${String(r.unit || '')}`}
                secondary={(r) => `${String(r.taken_at || '')}${r.flag ? ` · ${String(r.flag)}` : ''}`}
                onDelete={(id) => void handleDelete('labs', id)}
              />
              <RecordList
                title="Procedures"
                records={dashboard.procedures}
                canEdit={canEdit}
                primary={(r) => String(r.name)}
                secondary={(r) => `${String(r.performed_at || '')} · ${String(r.impression || '')}`}
                onDelete={(id) => void handleDelete('procedures', id)}
              />
              <RecordList
                title="Encounters"
                records={dashboard.encounters}
                canEdit={canEdit}
                primary={(r) => String(r.encounter_type || 'Encounter')}
                secondary={(r) => `${String(r.occurred_at || '')} · ${String(r.summary || '')}`}
                onDelete={(id) => void handleDelete('encounters', id)}
              />
              <RecordList
                title="Insurance"
                records={dashboard.insurance}
                canEdit={canEdit}
                primary={(r) => `${String(r.plan_name)} (${String(r.carrier || '')})`}
                secondary={(r) => `Member ${String(r.member_id_masked || '••••')} · Group ${String(r.group_no_masked || '••••')}`}
                onDelete={(id) => void handleDelete('insurance', id)}
                onReveal={medic8.isAdmin ? (id) => void handleReveal('insurance', id) : undefined}
              />
              <RecordList
                title="Disability timeline"
                records={dashboard.disability_events}
                canEdit={canEdit}
                primary={(r) => `${String(r.program || '')} · ${String(r.event_type || '')}`}
                secondary={(r) => `${String(r.event_date || '')} · ${String(r.description || '')}`}
                onDelete={(id) => void handleDelete('disability_events', id)}
              />
              <RecordList
                title="Documents"
                records={dashboard.documents}
                canEdit={canEdit}
                primary={(r) => String(r.title)}
                secondary={(r) => `${String(r.doc_type || '')}${r.media_url ? ` · ${String(r.media_url)}` : ''}`}
                onDelete={(id) => void handleDelete('documents', id)}
              />
            </div>

            {Object.keys(dashboard.lab_trends || {}).length > 0 ? (
              <section className="medic8-section" style={{ marginTop: '1rem' }}>
                <h2>Lab trends</h2>
                <ul className="medic8-list">
                  {Object.entries(dashboard.lab_trends).map(([test, points]) => (
                    <li className="medic8-item" key={test}>
                      <strong>{test}</strong>
                      <span className="medic8-meta">
                        {points.map((p) => `${p.taken_at || '?'}: ${p.value || '—'}${p.unit ? ` ${p.unit}` : ''}`).join(' → ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {canEdit ? (
              <section className="medic8-section medic8-no-print" style={{ marginTop: '1rem' }}>
                <h2>Quick add medication</h2>
                <form className="medic8-form-grid" onSubmit={(e) => void handleAddMed(e)}>
                  <input placeholder="Name" value={medForm.name} onChange={(e) => setMedForm((s) => ({ ...s, name: e.target.value }))} required />
                  <input placeholder="Strength" value={medForm.strength} onChange={(e) => setMedForm((s) => ({ ...s, strength: e.target.value }))} />
                  <input placeholder="Dose" value={medForm.dose_per_admin} onChange={(e) => setMedForm((s) => ({ ...s, dose_per_admin: e.target.value }))} />
                  <input placeholder="Frequency" value={medForm.frequency} onChange={(e) => setMedForm((s) => ({ ...s, frequency: e.target.value }))} />
                  <button type="submit" className="btn btn-primary btn-sm">Save medication</button>
                </form>
                <div className="medic8-actions" style={{ marginTop: '1rem' }}>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                    Upload document
                  </button>
                  <input ref={fileRef} type="file" hidden onChange={(e) => void handleUpload(e)} />
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
