import React from 'react';

import { IMasterCharacter, IMasterLocation, IMasterWeapon, IMasterMotive } from '../../../types/game';

interface AssetLibraryModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  busy: boolean;
  isAdmin: boolean;
  mysteryId: string | number;
  masterCharacters: IMasterCharacter[];
  masterLocations: IMasterLocation[];
  masterWeapons: IMasterWeapon[];
  masterMotives: IMasterMotive[];
  newMasterCharacter: { name: string };
  setNewMasterCharacter: React.Dispatch<React.SetStateAction<{ name: string }>>;
  newMasterLocation: { name: string };
  setNewMasterLocation: React.Dispatch<React.SetStateAction<{ name: string }>>;
  newMasterWeapon: { name: string };
  setNewMasterWeapon: React.Dispatch<React.SetStateAction<{ name: string }>>;
  newMasterMotive: { name: string };
  setNewMasterMotive: React.Dispatch<React.SetStateAction<{ name: string }>>;
  masterAssetsIncludeArchived: boolean;
  setMasterAssetsIncludeArchived: (val: boolean) => void;
  
  // Actions
  loadMasterCharacters: () => Promise<IMasterCharacter[]>;
  loadMasterLocations: () => Promise<IMasterLocation[]>;
  loadMasterWeapons: () => Promise<IMasterWeapon[]>;
  loadMasterMotives: () => Promise<IMasterMotive[]>;
  upsertMasterCharacter: (e: React.FormEvent) => Promise<void>;
  upsertMasterLocation: (e: React.FormEvent) => Promise<void>;
  upsertMasterWeapon: (e: React.FormEvent) => Promise<void>;
  upsertMasterMotive: (e: React.FormEvent) => Promise<void>;
  archiveMasterAsset: (opts: { type: string; id: string | number; is_archived: number }) => Promise<void>;
  setMasterAssetRegenLock: (opts: { type: string; item: any; is_regen_locked: number }) => Promise<void>;
  openMasterAssetDetails: (opts: { type: string; item: any }) => void;
  requestMasterAssetDelete: (opts: { type: string; item: any }) => void;
  backfillMasterAssetColumnsFromJson: () => Promise<void>;
  cleanupMasterOnlyFieldsForMystery: () => Promise<void>;
  linkAndImportCaseDetailsForMystery: () => Promise<void>;
  
  // Draft management
  getMasterAssetNameDraft: (opts: { type: string; id: string | number; fallback: string }) => string;
  updateMasterAssetNameDraft: (opts: { type: string; id: string | number; value: string }) => void;
  saveMasterAssetInlineName: (opts: { type: string; item: any }) => Promise<void>;
  
  needsCleanup: boolean;
  needsLinkImport: boolean;
  checkMaintenanceNeeded: () => Promise<void>;
  
  // Icons
  trashSvg: React.ReactNode;
  pencilSvg: React.ReactNode;
  lockSvg: React.ReactNode;
  unlockSvg: React.ReactNode;
}

export function AssetLibraryModal({
  modalRef,
  busy,
  isAdmin,
  mysteryId,
  masterCharacters,
  masterLocations,
  masterWeapons,
  masterMotives,
  newMasterCharacter,
  setNewMasterCharacter,
  newMasterLocation,
  setNewMasterLocation,
  newMasterWeapon,
  setNewMasterWeapon,
  newMasterMotive,
  setNewMasterMotive,
  masterAssetsIncludeArchived,
  setMasterAssetsIncludeArchived,
  loadMasterCharacters,
  loadMasterLocations,
  loadMasterWeapons,
  loadMasterMotives,
  upsertMasterCharacter,
  upsertMasterLocation,
  upsertMasterWeapon,
  upsertMasterMotive,
  archiveMasterAsset,
  setMasterAssetRegenLock,
  openMasterAssetDetails,
  requestMasterAssetDelete,
  backfillMasterAssetColumnsFromJson,
  cleanupMasterOnlyFieldsForMystery,
  linkAndImportCaseDetailsForMystery,
  getMasterAssetNameDraft,
  updateMasterAssetNameDraft,
  saveMasterAssetInlineName,
  needsCleanup,
  needsLinkImport,
  checkMaintenanceNeeded,
  trashSvg,
  pencilSvg,
  lockSvg,
  unlockSvg,
}: AssetLibraryModalProps) {
  React.useEffect(() => {
    const el = modalRef.current;
    if (!el) return;

    const onShow = () => {
      // Auto-refresh all columns and check maintenance needs when modal opens
      loadMasterCharacters();
      loadMasterLocations();
      loadMasterWeapons();
      loadMasterMotives();
      if (isAdmin) {
        checkMaintenanceNeeded();
      }
    };

    el.addEventListener('shown.bs.modal', onShow);
    return () => el.removeEventListener('shown.bs.modal', onShow);
  }, [modalRef, loadMasterCharacters, loadMasterLocations, loadMasterWeapons, loadMasterMotives]);

  const renderColumn = (
    title: string,
    type: string,
    items: any[],
    loader: () => Promise<any[]>,
    newVal: { name: string },
    setNewVal: React.Dispatch<React.SetStateAction<{ name: string }>>,
    upserter: (e: React.FormEvent) => Promise<void>,
    placeholder: string
  ) => (
    <div className="col-12 col-md-6 col-xl-3">
      <div className="catn8-card catn8-mystery-roster-card p-2 h-100">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <div>
            <div className="fw-bold">{title}</div>
            <div className="form-text">Shared roster across all cases.</div>
          </div>
          {isAdmin && (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loader} disabled={busy}>
              Refresh
            </button>
          )}
        </div>

        {isAdmin && (
          <form className="row g-2 mt-3" onSubmit={upserter}>
            <div className="col-8">
              <input
                className="form-control"
                value={newVal.name}
                onChange={(e) => setNewVal({ name: e.target.value })}
                disabled={busy}
                placeholder={placeholder}
              />
            </div>
            <div className="col-4">
              <button type="submit" className="btn btn-primary w-100" disabled={busy}>
                Add
              </button>
            </div>
          </form>
        )}

        <div className="table-responsive mt-3">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      className="form-control form-control-sm"
                      value={getMasterAssetNameDraft({ type, id: item.id, fallback: item.name })}
                      onChange={(e) => updateMasterAssetNameDraft({ type, id: item.id, value: e.target.value })}
                      onBlur={() => saveMasterAssetInlineName({ type, item })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      disabled={busy || !isAdmin}
                    />
                    {Number(item.is_archived || 0) ? <div className="form-text">Archived</div> : null}
                  </td>
                  <td className="text-end">
                    <div className="btn-group btn-group-sm" role="group">
                      {isAdmin && (
                        <>
                          {masterAssetsIncludeArchived && Number(item.is_archived || 0) ? (
                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              onClick={() => requestMasterAssetDelete({ type, item })}
                              disabled={busy}
                              title="Delete permanently"
                            >
                              {trashSvg}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={() => openMasterAssetDetails({ type, item })}
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
                              setMasterAssetRegenLock({ type, item, is_regen_locked: Number(item.is_regen_locked || 0) ? 0 : 1 });
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
                            onClick={() => archiveMasterAsset({ type, id: item.id, is_archived: Number(item.is_archived || 0) ? 0 : 1 })}
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
                          onClick={() => openMasterAssetDetails({ type, item })}
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
              {!items.length && (
                <tr>
                  <td colSpan={2} className="text-muted">{isAdmin ? `No master ${type}s yet.` : 'Not available.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl catn8-modal-wide">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Asset Library (Master Rosters)</div>
            <div className="d-flex align-items-center gap-3">
              {isAdmin && (
                <>
                  {needsCleanup && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={async () => {
                        await cleanupMasterOnlyFieldsForMystery();
                        checkMaintenanceNeeded();
                      }}
                      disabled={busy}
                      title="Remove master-only fields from ALL case character JSON"
                    >
                      Cleanup Case JSON
                    </button>
                  )}
                  {needsLinkImport && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={async () => {
                        await linkAndImportCaseDetailsForMystery();
                        checkMaintenanceNeeded();
                      }}
                      disabled={busy}
                      title="Link case characters to master assets"
                    >
                      Link + Import Case Details
                    </button>
                  )}
                </>
              )}
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
              <div className="alert alert-info">Only admins can manage the global master rosters.</div>
            )}

            <div className="row g-2">
              {renderColumn('Master Characters', 'character', masterCharacters, loadMasterCharacters, newMasterCharacter, setNewMasterCharacter, upsertMasterCharacter, 'Chief Hank Mercer')}
              {renderColumn('Master Locations', 'location', masterLocations, loadMasterLocations, newMasterLocation, setNewMasterLocation, upsertMasterLocation, 'Great Room')}
              {renderColumn('Master Weapons', 'weapon', masterWeapons, loadMasterWeapons, newMasterWeapon, setNewMasterWeapon, upsertMasterWeapon, 'Fireplace Poker')}
              {renderColumn('Master Motives', 'motive', masterMotives, loadMasterMotives, newMasterMotive, setNewMasterMotive, upsertMasterMotive, 'Revenge')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

