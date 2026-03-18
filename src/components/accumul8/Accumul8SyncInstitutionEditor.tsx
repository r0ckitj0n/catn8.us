import React from 'react';

type SyncInstitutionFormState = {
  provider_name: string;
  institution_id: string;
  institution_name: string;
  teller_enrollment_id: string;
  teller_user_id: string;
  status: string;
};

interface Accumul8SyncInstitutionEditorProps {
  busy: boolean;
  editingConnectionId: number | 'new' | null;
  form: SyncInstitutionFormState;
  onCancel: () => void;
  onChange: React.Dispatch<React.SetStateAction<SyncInstitutionFormState>>;
  onSubmit: () => void;
  title: string;
  statusOptions: Array<{ value: string; label: string }>;
}

export function Accumul8SyncInstitutionEditor({
  busy,
  editingConnectionId,
  form,
  onCancel,
  onChange,
  onSubmit,
  title,
  statusOptions,
}: Accumul8SyncInstitutionEditorProps) {
  return (
    <div className="accumul8-sync-editor card mb-3">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h5 className="card-title mb-0">{title}</h5>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
        <div className="accumul8-sync-editor-grid">
          <label className="accumul8-sync-editor-field">
            <span>Institution Name</span>
            <input
              className="form-control form-control-sm"
              type="text"
              value={form.institution_name}
              onChange={(e) => onChange((current) => ({ ...current, institution_name: e.target.value }))}
              placeholder="Capital One"
              disabled={busy}
            />
          </label>
          <label className="accumul8-sync-editor-field">
            <span>Institution ID</span>
            <input
              className="form-control form-control-sm"
              type="text"
              value={form.institution_id}
              onChange={(e) => onChange((current) => ({ ...current, institution_id: e.target.value }))}
              placeholder="ins_123"
              disabled={busy}
            />
          </label>
          <label className="accumul8-sync-editor-field">
            <span>Enrollment ID</span>
            <input
              className="form-control form-control-sm"
              type="text"
              value={form.teller_enrollment_id}
              onChange={(e) => onChange((current) => ({ ...current, teller_enrollment_id: e.target.value }))}
              placeholder="enr_123"
              disabled={busy}
            />
          </label>
          <label className="accumul8-sync-editor-field">
            <span>Teller User ID</span>
            <input
              className="form-control form-control-sm"
              type="text"
              value={form.teller_user_id}
              onChange={(e) => onChange((current) => ({ ...current, teller_user_id: e.target.value }))}
              placeholder="usr_123"
              disabled={busy}
            />
          </label>
          <label className="accumul8-sync-editor-field">
            <span>Status</span>
            <select
              className="form-select form-select-sm"
              value={form.status}
              onChange={(e) => onChange((current) => ({ ...current, status: e.target.value }))}
              disabled={busy}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="accumul8-sync-editor-field">
            <span>Provider</span>
            <input className="form-control form-control-sm" type="text" value="Teller" disabled />
          </label>
        </div>
        <p className="accumul8-sync-editor-note mb-0">
          Manual entries help you organize/edit connected institutions here, but only Teller Connect stores the access token required for live sync.
        </p>
        <div className="d-flex justify-content-end mt-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSubmit}
            disabled={busy || (!form.institution_name.trim() && !form.institution_id.trim())}
          >
            {editingConnectionId === 'new' ? 'Add Institution' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export type { SyncInstitutionFormState };
