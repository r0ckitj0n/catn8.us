import React from 'react';
import { IMasterCharacter } from '../../../types/game';

interface CharacterLibraryModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  busy: boolean;
  isAdmin: boolean;
  mysteryId: string | number;
  masterCharacters: IMasterCharacter[];
  newMasterCharacter: { name: string };
  setNewMasterCharacter: React.Dispatch<React.SetStateAction<{ name: string }>>;
  masterAssetsIncludeArchived: boolean;
  setMasterAssetsIncludeArchived: (val: boolean) => void;
  
  // Actions
  loadMasterCharacters: () => Promise<IMasterCharacter[]>;
  upsertMasterCharacter: (e: React.FormEvent) => Promise<void>;
  archiveMasterAsset: (opts: { type: string; id: string | number; is_archived: number }) => Promise<void>;
  setMasterAssetRegenLock: (opts: { type: string; item: any; is_regen_locked: number }) => Promise<void>;
  openMasterAssetDetails: (opts: { type: string; item: any }) => void;
  requestMasterAssetDelete: (opts: { type: string; item: any }) => void;
  
  // Draft management
  getMasterAssetNameDraft: (opts: { type: string; id: string | number; fallback: string }) => string;
  updateMasterAssetNameDraft: (opts: { type: string; id: string | number; value: string }) => void;
  saveMasterAssetInlineName: (opts: { type: string; item: any }) => Promise<void>;
  
  // Icons
  trashSvg: React.ReactNode;
  pencilSvg: React.ReactNode;
  lockSvg: React.ReactNode;
  unlockSvg: React.ReactNode;
}

export function CharacterLibraryModal({
  modalRef,
  busy,
  isAdmin,
  mysteryId,
  masterCharacters,
  newMasterCharacter,
  setNewMasterCharacter,
  masterAssetsIncludeArchived,
  setMasterAssetsIncludeArchived,
  loadMasterCharacters,
  upsertMasterCharacter,
  archiveMasterAsset,
  setMasterAssetRegenLock,
  openMasterAssetDetails,
  requestMasterAssetDelete,
  getMasterAssetNameDraft,
  updateMasterAssetNameDraft,
  saveMasterAssetInlineName,
  trashSvg,
  pencilSvg,
  lockSvg,
  unlockSvg,
}: CharacterLibraryModalProps) {
  React.useEffect(() => {
    const el = modalRef.current;
    if (!el) return;

    const onShow = () => {
      loadMasterCharacters();
    };

    el.addEventListener('shown.bs.modal', onShow);
    return () => el.removeEventListener('shown.bs.modal', onShow);
  }, [modalRef, loadMasterCharacters]);

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl catn8-modal-wide">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Character Library (Master Roster)</div>
            <div className="d-flex align-items-center gap-3">
              <label className="form-check form-switch m-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={masterAssetsIncludeArchived}
                  onChange={(e) => setMasterAssetsIncludeArchived(e.target.checked)}
                  disabled={busy || !isAdmin}
                />
                <span className="form-check-label">Show archived</span>
              </label>
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body catn8-asset-library">
            {!isAdmin && (
              <div className="alert alert-info">Only admins can manage the global master roster.</div>
            )}

            <div className="catn8-card catn8-mystery-roster-card p-3">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                  <h5 className="mb-0">Master Characters</h5>
                  <div className="form-text">Shared character roster across all cases.</div>
                </div>
                {isAdmin && (
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loadMasterCharacters} disabled={busy}>
                    Refresh List
                  </button>
                )}
              </div>

              {isAdmin && (
                <form className="row g-2 mb-4" onSubmit={upsertMasterCharacter}>
                  <div className="col-md-9">
                    <input
                      className="form-control"
                      value={newMasterCharacter.name}
                      onChange={(e) => setNewMasterCharacter({ name: e.target.value })}
                      disabled={busy}
                      placeholder="e.g. Chief Hank Mercer"
                    />
                  </div>
                  <div className="col-md-3">
                    <button type="submit" className="btn btn-primary w-100" disabled={busy}>
                      Add Character
                    </button>
                  </div>
                </form>
              )}

              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '40%' }}>Name</th>
                      <th style={{ width: '30%' }}>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterCharacters.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            className="form-control form-control-sm"
                            value={getMasterAssetNameDraft({ type: 'character', id: item.id, fallback: item.name })}
                            onChange={(e) => updateMasterAssetNameDraft({ type: 'character', id: item.id, value: e.target.value })}
                            onBlur={() => saveMasterAssetInlineName({ type: 'character', item })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.blur();
                              }
                            }}
                            disabled={busy || !isAdmin}
                          />
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            {Number(item.is_archived || 0) ? (
                              <span className="badge bg-secondary">Archived</span>
                            ) : (
                              <span className="badge bg-success">Active</span>
                            )}
                            {Number(item.is_case_locked || 0) && (
                              <span className="badge bg-danger" title="Referenced by an ongoing case">Case Locked</span>
                            )}
                            {Number(item.is_regen_locked || 0) && !Number(item.is_case_locked || 0) && (
                              <span className="badge bg-warning text-dark">Regen Locked</span>
                            )}
                          </div>
                        </td>
                        <td className="text-end">
                          <div className="btn-group btn-group-sm">
                            {isAdmin && (
                              <>
                                {masterAssetsIncludeArchived && Number(item.is_archived || 0) ? (
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger"
                                    onClick={() => requestMasterAssetDelete({ type: 'character', item })}
                                    disabled={busy}
                                    title="Delete permanently"
                                  >
                                    {trashSvg}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => openMasterAssetDetails({ type: 'character', item })}
                                    disabled={busy}
                                    title="Edit details"
                                  >
                                    {pencilSvg}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className={Number(item.is_case_locked || 0)
                                    ? 'btn btn-outline-danger'
                                    : (Number(item.is_regen_locked || 0) ? 'btn btn-outline-warning' : 'btn btn-outline-secondary')}
                                  onClick={() => {
                                    if (Number(item.is_case_locked || 0)) return;
                                    setMasterAssetRegenLock({ type: 'character', item, is_regen_locked: Number(item.is_regen_locked || 0) ? 0 : 1 });
                                  }}
                                  disabled={busy || Boolean(Number(item.is_case_locked || 0))}
                                  title={Number(item.is_case_locked || 0)
                                    ? 'Locked: referenced by an ongoing case'
                                    : (Number(item.is_regen_locked || 0) ? 'Locked from regeneration (click to unlock)' : 'Unlocked (click to lock)')}
                                >
                                  {Number(item.is_case_locked || 0) ? <span className="text-danger">{lockSvg}</span> : (Number(item.is_regen_locked || 0) ? lockSvg : unlockSvg)}
                                </button>
                                <button
                                  type="button"
                                  className={Number(item.is_archived || 0) ? 'btn btn-outline-success' : 'btn btn-outline-danger'}
                                  onClick={() => archiveMasterAsset({ type: 'character', id: item.id, is_archived: Number(item.is_archived || 0) ? 0 : 1 })}
                                  disabled={busy}
                                >
                                  {Number(item.is_archived || 0) ? 'Restore' : 'Archive'}
                                </button>
                              </>
                            )}
                            {!isAdmin && (
                              <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => openMasterAssetDetails({ type: 'character', item })}
                                disabled={busy}
                                title="View details"
                              >
                                <i className="bi bi-eye"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!masterCharacters.length && (
                      <tr>
                        <td colSpan={3} className="text-center py-4 text-muted">
                          {isAdmin ? 'No characters in the master roster yet.' : 'Character roster is currently unavailable.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
