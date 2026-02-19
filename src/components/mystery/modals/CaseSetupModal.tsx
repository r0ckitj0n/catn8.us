import React from 'react';
import { IMasterCharacter, IMasterLocation, IMasterWeapon, IMasterMotive } from '../../../types/game';
import { CaseSetupAssetTable } from './sections/CaseSetupAssetTable';

interface CaseSetupModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  busy: boolean;
  isAdmin: boolean;
  scenarioId: string;
  masterCharacters: IMasterCharacter[];
  masterLocations: IMasterLocation[];
  masterWeapons: IMasterWeapon[];
  masterMotives: IMasterMotive[];
  caseAvailableMasterCharacterIds: number[];
  setCaseAvailableMasterCharacterIds: React.Dispatch<React.SetStateAction<number[]>>;
  caseAvailableMasterLocationIds: number[];
  setCaseAvailableMasterLocationIds: React.Dispatch<React.SetStateAction<number[]>>;
  caseAvailableMasterWeaponIds: number[];
  setCaseAvailableMasterWeaponIds: React.Dispatch<React.SetStateAction<number[]>>;
  caseAvailableMasterMotiveIds: number[];
  setCaseAvailableMasterMotiveIds: React.Dispatch<React.SetStateAction<number[]>>;
  
  // Actions
  loadMasterCharacters: () => Promise<IMasterCharacter[]>;
  loadMasterLocations: () => Promise<IMasterLocation[]>;
  loadMasterWeapons: () => Promise<IMasterWeapon[]>;
  loadMasterMotives: () => Promise<IMasterMotive[]>;
  saveCaseSetup: (params: any) => Promise<void>;
}

/**
 * CaseSetupModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function CaseSetupModal(props: CaseSetupModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={props.modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl catn8-modal-wide">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Case Setup</div>
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            <div className="catn8-card p-3">
              <div className="d-flex align-items-center justify-content-between gap-2">
                <div>
                  <div className="fw-bold">Case Setup</div>
                  <div className="form-text">Pick which characters, locations, weapons, and motives are available for this case.</div>
                </div>
                <div className="d-flex gap-2">
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline-secondary" 
                    onClick={() => { 
                      void props.loadMasterCharacters(); 
                      void props.loadMasterLocations(); 
                      void props.loadMasterWeapons(); 
                      void props.loadMasterMotives(); 
                    }} 
                    disabled={props.busy || !props.isAdmin}
                  >
                    Refresh Library
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => props.saveCaseSetup({
                    character_ids: props.caseAvailableMasterCharacterIds,
                    location_ids: props.caseAvailableMasterLocationIds,
                    weapon_ids: props.caseAvailableMasterWeaponIds,
                    motive_ids: props.caseAvailableMasterMotiveIds
                  })} disabled={props.busy || !props.scenarioId || !props.isAdmin}>
                    Save Case Setup
                  </button>
                </div>
              </div>

              {!props.isAdmin && (
                <div className="text-muted mt-3 mb-0">
                  Master rosters are admin-managed. Ask an admin to update the Asset Library.
                </div>
              )}

              <div className="row g-3 mt-1">
                <CaseSetupAssetTable 
                  title="Available Characters"
                  items={props.masterCharacters}
                  selectedIds={props.caseAvailableMasterCharacterIds}
                  setSelectedIds={props.setCaseAvailableMasterCharacterIds}
                  busy={props.busy}
                  isAdmin={props.isAdmin}
                  scenarioId={props.scenarioId}
                />
                <CaseSetupAssetTable 
                  title="Available Locations"
                  items={props.masterLocations}
                  selectedIds={props.caseAvailableMasterLocationIds}
                  setSelectedIds={props.setCaseAvailableMasterLocationIds}
                  busy={props.busy}
                  isAdmin={props.isAdmin}
                  scenarioId={props.scenarioId}
                />
                <CaseSetupAssetTable 
                  title="Available Weapons"
                  items={props.masterWeapons}
                  selectedIds={props.caseAvailableMasterWeaponIds}
                  setSelectedIds={props.setCaseAvailableMasterWeaponIds}
                  busy={props.busy}
                  isAdmin={props.isAdmin}
                  scenarioId={props.scenarioId}
                />
                <CaseSetupAssetTable 
                  title="Available Motives"
                  items={props.masterMotives}
                  selectedIds={props.caseAvailableMasterMotiveIds}
                  setSelectedIds={props.setCaseAvailableMasterMotiveIds}
                  busy={props.busy}
                  isAdmin={props.isAdmin}
                  scenarioId={props.scenarioId}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
