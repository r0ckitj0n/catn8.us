import React from 'react';

interface GroupEditSectionProps {
  busy: boolean;
  groupSlug: string;
  editGroupSlug: string;
  setEditGroupSlug: (v: string) => void;
  editGroupTitle: string;
  setEditGroupTitle: (v: string) => void;
  updateGroup: (e: React.FormEvent) => Promise<void>;
  deleteGroup: () => Promise<void>;
}

export function GroupEditSection({
  busy,
  groupSlug,
  editGroupSlug,
  setEditGroupSlug,
  editGroupTitle,
  setEditGroupTitle,
  updateGroup,
  deleteGroup
}: GroupEditSectionProps) {
  if (!groupSlug) return null;

  return (
    <div className="catn8-card p-3 mb-3">
      <div className="fw-bold">Edit Group</div>
      <form onSubmit={updateGroup} className="row g-2 mt-1">
        <div className="col-md-4">
          <label className="form-label" htmlFor="group-edit-slug">Slug</label>
          <input id="group-edit-slug" className="form-control" value={editGroupSlug} onChange={(e) => setEditGroupSlug(e.target.value)} disabled={busy} />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="group-edit-title">Title</label>
          <input id="group-edit-title" className="form-control" value={editGroupTitle} onChange={(e) => setEditGroupTitle(e.target.value)} disabled={busy} />
        </div>
        <div className="col-md-2 d-flex justify-content-end align-items-end gap-2">
          <button type="button" className="btn btn-outline-danger" onClick={deleteGroup} disabled={busy || editGroupSlug === 'administrators'}>
            Delete
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !editGroupSlug.trim() || !editGroupTitle.trim()}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
