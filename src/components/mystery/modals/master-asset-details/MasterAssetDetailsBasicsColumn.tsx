import React from 'react';

import { CharacterProfileFields } from './CharacterProfileFields';
import { LocationProfileFields } from './LocationProfileFields';
import { MasterAssetDetailsModalProps } from './types';
import { WeaponProfileFields } from './WeaponProfileFields';

type Props = Pick<MasterAssetDetailsModalProps,
  'busy' | 'isAdmin' | 'masterAssetDetailsItem' | 'masterAssetDetailsType' | 'masterAssetDetailsName' |
  'setMasterAssetDetailsName' | 'masterAssetDetailsFields' | 'setMasterAssetDetailsFields' |
  'voiceProfiles' | 'clearMasterAssetFields' | 'openMasterAssetDerivedJson' | 'generateMasterAssetContent' |
  'toggleMasterAssetFieldLock' | 'isMasterAssetFieldLocked' | 'lockSvg' | 'unlockSvg'
>;

export function MasterAssetDetailsBasicsColumn(props: Props) {
  const {
    busy,
    isAdmin,
    masterAssetDetailsItem,
    masterAssetDetailsType,
    masterAssetDetailsName,
    setMasterAssetDetailsName,
    masterAssetDetailsFields,
    setMasterAssetDetailsFields,
    voiceProfiles,
    clearMasterAssetFields,
    openMasterAssetDerivedJson,
    generateMasterAssetContent,
    toggleMasterAssetFieldLock,
    isMasterAssetFieldLocked,
    lockSvg,
    unlockSvg,
  } = props;

  const isCharacter = masterAssetDetailsType === 'character';
  const isLocation = masterAssetDetailsType === 'location';
  const isWeapon = masterAssetDetailsType === 'weapon';

  return (
    <div className="col-12 col-xl-4">
      <div className="catn8-card p-3 h-100">
        <div className="d-flex justify-content-between align-items-center gap-2">
          <div>
            <div className="fw-bold">Basics</div>
            <div className="form-text">Type: {masterAssetDetailsType}</div>
          </div>
          <div className="d-flex gap-2">
            {isAdmin && (
              <>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={clearMasterAssetFields} disabled={busy || Boolean(masterAssetDetailsItem?.is_regen_locked)} title="Clear fields">Clear Fields</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={openMasterAssetDerivedJson} disabled={busy} title="View content prompt">View Content Prompt</button>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={generateMasterAssetContent} disabled={busy || Boolean(masterAssetDetailsItem?.is_regen_locked)} title="Generate content">Generate Content</button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3">
          <label className="form-label" htmlFor="details-name">Name</label>
          <div className="input-group">
            <button type="button" className={isMasterAssetFieldLocked('name') ? 'btn btn-outline-warning' : 'btn btn-outline-secondary'} onClick={() => toggleMasterAssetFieldLock('name')} disabled={busy || !isAdmin}>
              {isMasterAssetFieldLocked('name') ? lockSvg : unlockSvg}
            </button>
            <input id="details-name" className="form-control" value={masterAssetDetailsName} onChange={(e) => setMasterAssetDetailsName(e.target.value)} disabled={busy || !isAdmin || isMasterAssetFieldLocked('name')} />
          </div>
        </div>

        <div className="mt-3">
          <div className="fw-bold">Profile</div>
          <div className="form-text mb-2">Database curated fields.</div>
          {isCharacter && <CharacterProfileFields busy={busy} isAdmin={isAdmin} fields={masterAssetDetailsFields} voiceProfiles={voiceProfiles} setFields={setMasterAssetDetailsFields} />}
          {isLocation && <LocationProfileFields busy={busy} isAdmin={isAdmin} fields={masterAssetDetailsFields} setFields={setMasterAssetDetailsFields} />}
          {isWeapon && <WeaponProfileFields busy={busy} isAdmin={isAdmin} fields={masterAssetDetailsFields} setFields={setMasterAssetDetailsFields} />}
        </div>
      </div>
    </div>
  );
}
