import React from 'react';

import { AssetLibraryColumn } from './asset-library/AssetLibraryColumn';
import { AssetLibraryModalProps } from './asset-library/types';

export function AssetLibraryModal(props: AssetLibraryModalProps) {
  const {
    modalRef, isAdmin, busy, masterAssetsIncludeArchived, setMasterAssetsIncludeArchived,
    needsCleanup, needsLinkImport, cleanupMasterOnlyFieldsForMystery, linkAndImportCaseDetailsForMystery, checkMaintenanceNeeded,
    masterCharacters, loadMasterCharacters, newMasterCharacter, setNewMasterCharacter, upsertMasterCharacter,
    masterLocations, loadMasterLocations, newMasterLocation, setNewMasterLocation, upsertMasterLocation,
    masterWeapons, loadMasterWeapons, newMasterWeapon, setNewMasterWeapon, upsertMasterWeapon,
    masterMotives, loadMasterMotives, newMasterMotive, setNewMasterMotive, upsertMasterMotive,
  } = props;

  React.useEffect(() => {
    const element = modalRef.current;
    if (!element) return;
    const onShow = () => {
      loadMasterCharacters();
      loadMasterLocations();
      loadMasterWeapons();
      loadMasterMotives();
      if (isAdmin) checkMaintenanceNeeded();
    };
    element.addEventListener('shown.bs.modal', onShow);
    return () => element.removeEventListener('shown.bs.modal', onShow);
  }, [modalRef, loadMasterCharacters, loadMasterLocations, loadMasterWeapons, loadMasterMotives, checkMaintenanceNeeded, isAdmin]);

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl catn8-modal-wide">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Asset Library (Master Rosters)</div>
            <div className="d-flex align-items-center gap-3">
              {isAdmin && needsCleanup ? <button type="button" className="btn btn-sm btn-outline-danger" onClick={async () => { await cleanupMasterOnlyFieldsForMystery(); checkMaintenanceNeeded(); }} disabled={busy}>Cleanup Case JSON</button> : null}
              {isAdmin && needsLinkImport ? <button type="button" className="btn btn-sm btn-outline-secondary" onClick={async () => { await linkAndImportCaseDetailsForMystery(); checkMaintenanceNeeded(); }} disabled={busy}>Link + Import Case Details</button> : null}
              <label className="form-check form-switch m-0">
                <input className="form-check-input" type="checkbox" checked={masterAssetsIncludeArchived} onChange={(e) => setMasterAssetsIncludeArchived(e.target.checked)} disabled={busy || !isAdmin} />
                <span className="form-check-label">Show archived</span>
              </label>
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body catn8-asset-library">
            {!isAdmin ? <div className="alert alert-info">Only admins can manage the global master rosters.</div> : null}
            <div className="row g-2">
              <AssetLibraryColumn title="Master Characters" type="character" items={masterCharacters} loader={loadMasterCharacters} newVal={newMasterCharacter} setNewVal={setNewMasterCharacter} upserter={upsertMasterCharacter} placeholder="Chief Hank Mercer" {...props} />
              <AssetLibraryColumn title="Master Locations" type="location" items={masterLocations} loader={loadMasterLocations} newVal={newMasterLocation} setNewVal={setNewMasterLocation} upserter={upsertMasterLocation} placeholder="Great Room" {...props} />
              <AssetLibraryColumn title="Master Weapons" type="weapon" items={masterWeapons} loader={loadMasterWeapons} newVal={newMasterWeapon} setNewVal={setNewMasterWeapon} upserter={upsertMasterWeapon} placeholder="Fireplace Poker" {...props} />
              <AssetLibraryColumn title="Master Motives" type="motive" items={masterMotives} loader={loadMasterMotives} newVal={newMasterMotive} setNewVal={setNewMasterMotive} upserter={upsertMasterMotive} placeholder="Revenge" {...props} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
