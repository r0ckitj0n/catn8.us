import React from 'react';

interface MotiveDetailsSectionProps {
  isAdmin: boolean;
  motiveNameDraft: string;
  setMotiveNameDraft: (val: string) => void;
  motiveSlugDraft: string;
  setMotiveSlugDraft: (val: string) => void;
  motiveDescriptionDraft: string;
  setMotiveDescriptionDraft: (val: string) => void;
  motiveIsArchivedDraft: boolean;
  setMotiveIsArchivedDraft: (val: boolean) => void;
  busy: boolean;
  motivesBusy: boolean;
  motiveSelectedIsLocked: boolean;
}

export function MotiveDetailsSection({
  isAdmin,
  motiveNameDraft,
  setMotiveNameDraft,
  motiveSlugDraft,
  setMotiveSlugDraft,
  motiveDescriptionDraft,
  setMotiveDescriptionDraft,
  motiveIsArchivedDraft,
  setMotiveIsArchivedDraft,
  busy,
  motivesBusy,
  motiveSelectedIsLocked,
}: MotiveDetailsSectionProps) {
  return (
    <div className="catn8-card p-3 h-100">
      <div className="row g-2">
        <div className="col-12 col-lg-6">
          <label className="form-label" htmlFor="motive-name">Name</label>
          <input 
            id="motive-name" 
            className="form-control" 
            value={motiveNameDraft} 
            onChange={(e) => setMotiveNameDraft(e.target.value)} 
            disabled={busy || motivesBusy || motiveSelectedIsLocked || !isAdmin} 
          />
        </div>
        <div className="col-12 col-lg-6">
          <label className="form-label" htmlFor="motive-slug">Slug</label>
          <input 
            id="motive-slug" 
            className="form-control" 
            value={motiveSlugDraft} 
            onChange={(e) => setMotiveSlugDraft(e.target.value)} 
            disabled={busy || motivesBusy || motiveSelectedIsLocked || !isAdmin} 
          />
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="motive-description">Description</label>
          <textarea 
            id="motive-description" 
            className="form-control" 
            rows={6} 
            value={motiveDescriptionDraft} 
            onChange={(e) => setMotiveDescriptionDraft(e.target.value)} 
            disabled={busy || motivesBusy || motiveSelectedIsLocked || !isAdmin}
          ></textarea>
        </div>

        <div className="col-12">
          <div className="form-check mt-2">
            <input 
              id="motive-is-archived" 
              className="form-check-input" 
              type="checkbox" 
              checked={motiveIsArchivedDraft} 
              onChange={(e) => setMotiveIsArchivedDraft(e.target.checked)} 
              disabled={busy || motivesBusy || motiveSelectedIsLocked || !isAdmin} 
            />
            <label className="form-check-label" htmlFor="motive-is-archived">Archived</label>
          </div>
        </div>
      </div>
    </div>
  );
}
