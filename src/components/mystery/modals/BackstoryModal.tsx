import React from 'react';

interface BackstoryModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  busy: boolean;
  isAdmin: boolean;
  backstoryId: string;
  backstoryDetails: any;
  backstoryTitleDraft: string;
  setBackstoryTitleDraft: (val: string) => void;
  backstorySlugDraft: string;
  setBackstorySlugDraft: (val: string) => void;
  backstoryLocationMasterIdDraft: string;
  setBackstoryLocationMasterIdDraft: (val: string) => void;
  backstoryFullTextDraft: string;
  setBackstoryFullTextDraft: (val: string) => void;
  backstoryFullUpdatedAt: string;
  backstoryTextDraft: string;
  setBackstoryTextDraft: (val: string) => void;
  backstoryMetaDraft: string;
  setBackstoryMetaDraft: (val: string) => void;
  masterLocations: any[];
  mysteryId: string | number;
  
  // Actions
  loadBackstoryDetails: (id: string | number) => Promise<void>;
  loadBackstoryFullStory: (id: string | number) => Promise<string | undefined>;
  saveBackstoryDetails: () => Promise<void>;
  saveBackstoryFullStory: () => Promise<void>;
  toggleBackstoryArchived: (id: string | number) => Promise<void>;
  generateBackstoryWithAi: () => Promise<void>;
}

export function BackstoryModal({
  modalRef,
  busy,
  isAdmin,
  backstoryId,
  backstoryDetails,
  backstoryTitleDraft,
  setBackstoryTitleDraft,
  backstorySlugDraft,
  setBackstorySlugDraft,
  backstoryLocationMasterIdDraft,
  setBackstoryLocationMasterIdDraft,
  backstoryFullTextDraft,
  setBackstoryFullTextDraft,
  backstoryFullUpdatedAt,
  backstoryTextDraft,
  setBackstoryTextDraft,
  backstoryMetaDraft,
  setBackstoryMetaDraft,
  masterLocations,
  mysteryId,
  loadBackstoryDetails,
  loadBackstoryFullStory,
  saveBackstoryDetails,
  saveBackstoryFullStory,
  toggleBackstoryArchived,
  generateBackstoryWithAi,
}: BackstoryModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl catn8-modal-wide">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Backstory</div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  void loadBackstoryDetails(backstoryId);
                  void loadBackstoryFullStory(backstoryId);
                }}
                disabled={busy || !backstoryId}
              >
                Refresh
              </button>
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            {!backstoryId ? (
              <div className="text-muted">Select a Backstory in the Dossier first.</div>
            ) : (
              <div className="catn8-card p-3">
                <div className="d-flex align-items-start justify-content-between gap-2">
                  <div>
                    <div className="fw-bold">Edit Backstory</div>
                    <div className="form-text">Backstory id: {String(backstoryId)}</div>
                  </div>
                  <div className="d-flex gap-2">
                    {isAdmin && (
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void toggleBackstoryArchived(backstoryId)} disabled={busy || !backstoryId}>
                        {Number(backstoryDetails?.is_archived || 0) === 1 ? 'Unarchive' : 'Archive'}
                      </button>
                    )}
                    {isAdmin && (
                      <button type="button" className="btn btn-sm btn-primary" onClick={saveBackstoryDetails} disabled={busy || !backstoryId || !String(backstoryTitleDraft || '').trim()}>
                        Save Briefing
                      </button>
                    )}
                    {isAdmin && (
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={saveBackstoryFullStory} disabled={busy || !backstoryId}>
                        Save Full Backstory
                      </button>
                    )}
                  </div>
                </div>

                <div className="row g-3 mt-1">
                  <div className="col-12">
                    <label className="form-label" htmlFor="mystery-backstory-edit-title">Title</label>
                    <input
                      id="mystery-backstory-edit-title"
                      className="form-control"
                      value={backstoryTitleDraft}
                      onChange={(e) => setBackstoryTitleDraft(e.target.value)}
                      disabled={busy || !backstoryId || !isAdmin}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label" htmlFor="mystery-backstory-edit-slug">Slug</label>
                    <input
                      id="mystery-backstory-edit-slug"
                      className="form-control"
                      value={backstorySlugDraft}
                      onChange={(e) => setBackstorySlugDraft(e.target.value)}
                      disabled={busy || !backstoryId || !isAdmin}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label" htmlFor="mystery-backstory-edit-location">Location</label>
                    <select
                      id="mystery-backstory-edit-location"
                      className="form-select"
                      value={backstoryLocationMasterIdDraft}
                      onChange={(e) => setBackstoryLocationMasterIdDraft(e.target.value)}
                      disabled={busy || !backstoryId || !isAdmin}
                    >
                      <option value="">Select a location…</option>
                      {(Array.isArray(masterLocations) ? masterLocations : [])
                        .filter((l: any) => Number(l?.is_archived || 0) !== 1)
                        .map((l: any) => (
                          <option key={'backstory-edit-loc-' + String(l?.id || '')} value={String(l?.id || '')}>
                            {String(l?.name || ('Location #' + String(l?.id || '')))}
                          </option>
                        ))}
                    </select>
                    {!isAdmin ? (
                      <div className="form-text">Location selection requires admin access.</div>
                    ) : null}
                  </div>

                  <div className="col-12">
                    <label className="form-label" htmlFor="mystery-backstory-edit-full-text">Full Backstory</label>
                    <textarea
                      id="mystery-backstory-edit-full-text"
                      className="form-control"
                      value={backstoryFullTextDraft}
                      onChange={(e) => setBackstoryFullTextDraft(e.target.value)}
                      disabled={busy || !backstoryId || !isAdmin}
                      rows={12}
                    />
                    {backstoryFullUpdatedAt ? (
                      <div className="form-text">Updated: {String(backstoryFullUpdatedAt)}</div>
                    ) : (
                      <div className="form-text">Not written yet.</div>
                    )}

                    {isAdmin && (
                      <div className="d-flex justify-content-end mt-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={generateBackstoryWithAi}
                          disabled={busy || !backstoryId || !mysteryId}
                          title="Uses a random Seed Story and the current case setup to generate a new backstory"
                        >
                          Generate Backstory
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label" htmlFor="mystery-backstory-edit-text">Backstory Summary</label>
                    <textarea
                      id="mystery-backstory-edit-text"
                      className="form-control"
                      value={backstoryTextDraft}
                      onChange={(e) => setBackstoryTextDraft(e.target.value)}
                      disabled={busy || !backstoryId || !isAdmin}
                      rows={8}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label" htmlFor="mystery-backstory-edit-meta">Meta (JSON)</label>
                    <textarea
                      id="mystery-backstory-edit-meta"
                      className="form-control"
                      value={backstoryMetaDraft}
                      onChange={(e) => setBackstoryMetaDraft(e.target.value)}
                      disabled={busy || !backstoryId || !isAdmin}
                      rows={8}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
