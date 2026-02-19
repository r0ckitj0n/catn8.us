import React from 'react';
import { IToast } from '../../types/common';
import { useWeaponsManager } from './hooks/useWeaponsManager';
import { WeaponSelectorSection } from './sections/WeaponSelectorSection';
import { WeaponDetailsSection } from './sections/WeaponDetailsSection';
import './WeaponsManager.css';

interface WeaponsManagerProps {
  isAdmin: boolean;
  mysteryId: string | number;
  caseId: string | number;
  busy: boolean;
  showMysteryToast: (t: Partial<IToast>) => void;
  onClose?: () => void;
}

/**
 * WeaponsManager - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function WeaponsManager({
  isAdmin,
  mysteryId,
  caseId,
  busy,
  showMysteryToast,
  onClose,
}: WeaponsManagerProps) {
  const state = useWeaponsManager(isAdmin, mysteryId, caseId, showMysteryToast);

  return (
    <div className="modal-content">
      <div className="modal-header">
        <div className="fw-bold">Weapons</div>
        <div className="d-flex align-items-center gap-2">
          <div className="form-check">
            <input
              id="weapons-include-archived"
              className="form-check-input"
              type="checkbox"
              checked={state.weaponsIncludeArchived}
              onChange={(e) => state.setWeaponsIncludeArchived(e.target.checked)}
              disabled={busy || state.weaponsBusy}
            />
            <label className="form-check-label" htmlFor="weapons-include-archived">Show archived</label>
          </div>
          <button 
            type="button" 
            className="btn btn-sm btn-outline-secondary" 
            onClick={state.loadWeapons} 
            disabled={busy || state.weaponsBusy}
          >
            Refresh
          </button>
          {isAdmin && state.weapons.length === 0 && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={state.importMasterWeaponsToGlobal}
              disabled={busy || state.weaponsBusy || !isAdmin}
              title={mysteryId ? 'Import legacy (mystery-scoped) weapons' : 'Select a Mystery first'}
            >
              Import from Asset Library
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className={'btn btn-sm btn-primary catn8-dirty-save' + (state.weaponIsDirty ? ' catn8-dirty-save--visible' : '')}
              onClick={() => void state.saveWeapon()}
              disabled={busy || state.weaponsBusy || !isAdmin || !state.weaponIsDirty || state.weaponSelectedIsLocked}
              aria-label="Save"
              title={state.weaponSelectedIsLocked ? 'Weapon is locked' : (state.weaponIsDirty ? 'Save changes' : 'No changes to save')}
            >
              Save
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => void state.generateWeapon(true)}
              disabled={busy || state.weaponsBusy || state.weaponSelectedIsLocked || !state.canGenerateWeaponDetails}
              title={state.canGenerateWeaponDetails ? 'Generate details' : 'Enter required fields first'}
            >
              Generate Details
            </button>
          )}
          {onClose ? (
            <button type="button" className="btn-close catn8-mystery-modal-close" onClick={onClose} aria-label="Close"></button>
          ) : (
            <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
          )}
        </div>
      </div>
      <div className="modal-body">
        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <WeaponSelectorSection 
              weapons={state.weapons}
              weaponSelectedId={state.weaponSelectedId}
              weaponSelectedIsLocked={state.weaponSelectedIsLocked}
              weaponsBusy={state.weaponsBusy}
              busy={busy}
              isAdmin={isAdmin}
              weaponImageDraft={state.weaponImageDraft}
              selectWeaponById={state.selectWeaponById}
              setWeaponIsArchivedDraft={state.setWeaponIsArchivedDraft}
              deleteWeaponAction={state.deleteWeaponAction}
              generateWeapon={state.generateWeapon}
              uploadWeaponImage={state.uploadWeaponImage}
              deleteWeaponImage={state.deleteWeaponImage}
            />
          </div>
          <div className="col-12 col-lg-8">
            <WeaponDetailsSection 
              isAdmin={isAdmin}
              weaponNameDraft={state.weaponNameDraft}
              setWeaponNameDraft={state.setWeaponNameDraft}
              weaponSlugDraft={state.weaponSlugDraft}
              setWeaponSlugDraft={state.setWeaponSlugDraft}
              weaponDescriptionDraft={state.weaponDescriptionDraft}
              setWeaponDescriptionDraft={state.setWeaponDescriptionDraft}
              weaponIsArchivedDraft={state.weaponIsArchivedDraft}
              setWeaponIsArchivedDraft={state.setWeaponIsArchivedDraft}
              busy={busy}
              weaponsBusy={state.weaponsBusy}
              weaponSelectedIsLocked={state.weaponSelectedIsLocked}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
