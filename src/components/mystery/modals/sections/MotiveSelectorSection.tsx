import React from 'react';

interface MotiveSelectorSectionProps {
  motives: any[];
  motiveSelectedId: string;
  motiveSelectedIsLocked: boolean;
  motivesBusy: boolean;
  busy: boolean;
  isAdmin: boolean;
  selectMotiveById: (id: string, list: any[]) => void;
  setMotiveIsArchivedDraft: (val: boolean) => void;
  deleteMotiveAction: () => Promise<void>;
}

export function MotiveSelectorSection({
  motives,
  motiveSelectedId,
  motiveSelectedIsLocked,
  motivesBusy,
  busy,
  isAdmin,
  selectMotiveById,
  setMotiveIsArchivedDraft,
  deleteMotiveAction,
}: MotiveSelectorSectionProps) {
  return (
    <div className="catn8-card p-3 h-100">
      <label className="form-label" htmlFor="motives-select">Motive</label>
      <select
        id="motives-select"
        className="form-select"
        value={motiveSelectedId}
        onChange={(e) => {
          const id = e.target.value;
          selectMotiveById(id, motives);
        }}
        disabled={busy || motivesBusy}
      >
        <option value="">(New motive)</option>
        {motives.map((m: any) => {
          const id = String(m?.id || '');
          const name = String(m?.name || '') || '(Unnamed)';
          const locked = Number(m?.is_locked || 0) === 1;
          const archived = Number(m?.is_archived || 0) === 1;
          const label = `${name}${archived ? ' (archived)' : ''}${locked ? ' (locked)' : ''}`;
          return (
            <option key={id} value={id}>{label}</option>
          );
        })}
      </select>

      {motiveSelectedIsLocked ? (
        <div className="alert alert-warning mt-3 mb-0">
          This motive is in an active case and cannot be edited or deleted.
        </div>
      ) : null}

      <div className="d-flex gap-2 mt-3">
        <button 
          type="button" 
          className="btn btn-sm btn-outline-secondary" 
          onClick={() => setMotiveIsArchivedDraft(true)} 
          disabled={busy || motivesBusy || !isAdmin || motiveSelectedIsLocked}
        >
          Archive
        </button>
        <button 
          type="button" 
          className="btn btn-sm btn-outline-danger" 
          onClick={deleteMotiveAction} 
          disabled={busy || motivesBusy || !isAdmin || motiveSelectedIsLocked || !motiveSelectedId}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
