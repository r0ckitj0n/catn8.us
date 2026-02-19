import React from 'react';

interface MysteryPickerAdminSectionProps {
  busy: boolean;
  mysteryPickerAdminOpen: boolean;
  setMysteryPickerAdminOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mysteryAdminCreateTitle: string;
  setMysteryAdminCreateTitle: (val: string) => void;
  mysteryAdminCreateSlug: string;
  setMysteryAdminCreateSlug: (val: string) => void;
  mysteryAdminEditTitle: string;
  setMysteryAdminEditTitle: (val: string) => void;
  mysteryAdminEditSlug: string;
  setMysteryAdminEditSlug: (val: string) => void;
  mysteryAdminEditArchived: boolean;
  setMysteryAdminEditArchived: (val: boolean) => void;
  mysteryAdminDeleteArmed: boolean;
  setMysteryAdminDeleteArmed: React.Dispatch<React.SetStateAction<boolean>>;
  createMysteryFromPicker: () => Promise<void>;
  importDefaultMystery: () => Promise<void>;
  refreshMysteryPickerList: () => Promise<void>;
  saveMysteryFromPicker: () => Promise<void>;
  deleteMysteryFromPicker: () => Promise<void>;
  mysteryPickerSelectedId: string;
  setMysteryPickerSelectedId: (val: string) => void;
  mysteryPickerList: any[];
}

export function MysteryPickerAdminSection({
  busy, mysteryPickerAdminOpen, setMysteryPickerAdminOpen,
  mysteryAdminCreateTitle, setMysteryAdminCreateTitle,
  mysteryAdminCreateSlug, setMysteryAdminCreateSlug,
  mysteryAdminEditTitle, setMysteryAdminEditTitle,
  mysteryAdminEditSlug, setMysteryAdminEditSlug,
  mysteryAdminEditArchived, setMysteryAdminEditArchived,
  mysteryAdminDeleteArmed, setMysteryAdminDeleteArmed,
  createMysteryFromPicker, importDefaultMystery, refreshMysteryPickerList,
  saveMysteryFromPicker, deleteMysteryFromPicker, mysteryPickerSelectedId,
  setMysteryPickerSelectedId, mysteryPickerList
}: MysteryPickerAdminSectionProps) {
  return (
    <div className="catn8-card p-3 mt-3">
      <div
        className="fw-bold"
        role="button"
        tabIndex={0}
        aria-expanded={mysteryPickerAdminOpen}
        onClick={() => setMysteryPickerAdminOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setMysteryPickerAdminOpen((v) => !v);
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        Admin — Manage Mysteries
      </div>

      {mysteryPickerAdminOpen && (
        <>
          <div className="form-text">Select an existing mystery to manage or choose "New Mystery" to create one.</div>
          
          <div className="mt-3">
            <label className="form-label fw-bold" htmlFor="catn8-mystery-admin-selector">Select Mystery</label>
            <select
              id="catn8-mystery-admin-selector"
              className="form-select bg-dark text-light border-secondary"
              value={mysteryPickerSelectedId}
              onChange={(e) => setMysteryPickerSelectedId(e.target.value)}
              disabled={busy}
            >
              <option value="">+ New Mystery</option>
              {mysteryPickerList.map((m: any) => (
                <option key={String(m.id)} value={String(m.id)}>
                  {m.title} {Number(m.is_archived) === 1 ? '(Archived)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="catn8-card p-3 mt-3 bg-noir-darker border-noir-gold-subtle">
            <div className="row g-3">
              <div className="col-12 col-lg-6">
                <label className="form-label fw-bold" htmlFor="catn8-mystery-admin-title">Title</label>
                <input
                  id="catn8-mystery-admin-title"
                  className="form-control"
                  value={mysteryPickerSelectedId ? mysteryAdminEditTitle : mysteryAdminCreateTitle}
                  onChange={(e) => mysteryPickerSelectedId ? setMysteryAdminEditTitle(e.target.value) : setMysteryAdminCreateTitle(e.target.value)}
                  disabled={busy}
                  placeholder="Enter mystery title..."
                />
              </div>
              <div className="col-12 col-lg-6">
                <label className="form-label fw-bold" htmlFor="catn8-mystery-admin-slug">Slug (URL Key)</label>
                <input
                  id="catn8-mystery-admin-slug"
                  className="form-control"
                  value={mysteryPickerSelectedId ? mysteryAdminEditSlug : mysteryAdminCreateSlug}
                  onChange={(e) => mysteryPickerSelectedId ? setMysteryAdminEditSlug(e.target.value) : setMysteryAdminCreateSlug(e.target.value)}
                  disabled={busy}
                  placeholder="optional-slug-here"
                />
              </div>
            </div>

            {mysteryPickerSelectedId && (
              <div className="form-check mt-3">
                <input
                  id="catn8-mystery-admin-archived"
                  className="form-check-input"
                  type="checkbox"
                  checked={mysteryAdminEditArchived}
                  onChange={(e) => setMysteryAdminEditArchived(Boolean(e.target.checked))}
                  disabled={busy}
                />
                <label className="form-check-label" htmlFor="catn8-mystery-admin-archived">
                  Archived (Hidden from non-admins)
                </label>
              </div>
            )}

            <div className="d-flex flex-wrap align-items-center gap-2 mt-4">
              {!mysteryPickerSelectedId ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void createMysteryFromPicker()}
                  disabled={busy || !mysteryAdminCreateTitle.trim()}
                >
                  <i className="bi bi-plus-circle me-2"></i>
                  Create Mystery
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void saveMysteryFromPicker()}
                    disabled={busy || !mysteryAdminEditTitle.trim()}
                  >
                    <i className="bi bi-save me-2"></i>
                    Save Changes
                  </button>

                  <div className="ms-auto d-flex gap-2">
                    <button
                      type="button"
                      className={mysteryAdminDeleteArmed ? 'btn btn-danger' : 'btn btn-outline-danger'}
                      onClick={() => setMysteryAdminDeleteArmed((v) => !v)}
                      disabled={busy}
                    >
                      {mysteryAdminDeleteArmed ? 'Armed' : 'Arm Delete'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => void deleteMysteryFromPicker()}
                      disabled={busy || !mysteryAdminEditArchived || !mysteryAdminDeleteArmed}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="d-flex gap-2 mt-3 opacity-75">
            <button type="button" className="btn btn-sm btn-outline-success" onClick={() => void importDefaultMystery()} disabled={busy}>
              <i className="bi bi-download me-1"></i>
              Import Defaults
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void refreshMysteryPickerList()} disabled={busy}>
              <i className="bi bi-arrow-clockwise me-1"></i>
              Refresh List
            </button>
          </div>
        </>
      )}
    </div>
  );
}
