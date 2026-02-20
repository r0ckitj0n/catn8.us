import React from 'react';

import { WebpImage } from '../../../common/WebpImage';
import { MasterAssetDetailsModalProps } from './types';

type Props = Pick<MasterAssetDetailsModalProps,
  'busy' | 'isAdmin' | 'masterAssetDetailsType' | 'masterCharacterImageUrl' | 'masterCharacterMugshotUrl' |
  'masterCharacterIrUrls' | 'masterCharacterIrIndex' | 'setMasterCharacterIrIndex' | 'masterCharacterIrEmotions' |
  'masterCharacterIrEmotionEnabled' | 'setMasterCharacterIrEmotionEnabled' | 'masterCharacterMissingRequiredImageFields' |
  'openMasterCharacterImagePrompt' | 'generateMasterCharacterImages' | 'deleteMasterCharacterImage' |
  'uploadMasterCharacterImage' | 'generateAllMissingMasterCharacterImages' | 'isMasterAssetFieldLocked' |
  'toggleMasterAssetFieldLock' | 'lockSvg' | 'unlockSvg' | 'getMasterAssetDataObject' | 'updateMasterAssetDetailsDataObject' |
  'generateMasterAssetPrimaryImage' | 'deleteMasterAssetPrimaryImage' | 'uploadMasterAssetImage'
>;

export function MasterAssetDetailsMediaColumn(props: Props) {
  const {
    busy,
    isAdmin,
    masterAssetDetailsType,
    masterCharacterImageUrl,
    masterCharacterMugshotUrl,
    masterCharacterIrUrls,
    masterCharacterIrIndex,
    setMasterCharacterIrIndex,
    masterCharacterIrEmotions,
    masterCharacterIrEmotionEnabled,
    setMasterCharacterIrEmotionEnabled,
    masterCharacterMissingRequiredImageFields,
    openMasterCharacterImagePrompt,
    generateMasterCharacterImages,
    deleteMasterCharacterImage,
    uploadMasterCharacterImage,
    generateAllMissingMasterCharacterImages,
    isMasterAssetFieldLocked,
    toggleMasterAssetFieldLock,
    lockSvg,
    unlockSvg,
    getMasterAssetDataObject,
    updateMasterAssetDetailsDataObject,
    generateMasterAssetPrimaryImage,
    deleteMasterAssetPrimaryImage,
    uploadMasterAssetImage,
  } = props;

  const isCharacter = masterAssetDetailsType === 'character';
  const isLocation = masterAssetDetailsType === 'location';
  const isWeapon = masterAssetDetailsType === 'weapon';

  return (
    <div className="col-12 col-xl-4">
      <div className="catn8-card p-3 h-100">
        {isCharacter ? (
          <>
            <div className="d-flex align-items-center justify-content-between gap-2">
              <div className="fw-bold">Character Images</div>
              {isAdmin && <button type="button" className="btn btn-sm btn-outline-primary" onClick={generateAllMissingMasterCharacterImages} disabled={busy}>Generate All Missing</button>}
            </div>
            <div className="mt-3">
              <div className="fw-bold">Main Image</div>
              {masterCharacterImageUrl ? <WebpImage className="img-fluid rounded mt-2" src={masterCharacterImageUrl} alt="Character" /> : <div className="form-text mt-2">No image found.</div>}
              <div className="mt-2 d-flex gap-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => openMasterCharacterImagePrompt({ kind: 'character' })}>View Prompt</button>
                {isAdmin && (
                  <>
                    <button className="btn btn-sm btn-outline-primary" onClick={() => generateMasterCharacterImages({ kind: 'character' })} disabled={busy || masterCharacterMissingRequiredImageFields.length > 0} title={masterCharacterMissingRequiredImageFields.length ? `Missing: ${masterCharacterMissingRequiredImageFields.join(', ')}` : ''}>Generate</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => deleteMasterCharacterImage({ kind: 'character' })}>Delete</button>
                  </>
                )}
              </div>
              {isAdmin && <input type="file" className="form-control form-control-sm mt-2" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMasterCharacterImage({ kind: 'character', file: f }); }} />}
            </div>
            <hr className="my-3" />
            <div className="mt-3">
              <div className="fw-bold">Mugshot</div>
              {masterCharacterMugshotUrl ? <WebpImage className="img-fluid rounded mt-2" src={masterCharacterMugshotUrl} alt="Mugshot" /> : <div className="form-text mt-2">No mugshot found.</div>}
              <div className="mt-2 d-flex gap-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => openMasterCharacterImagePrompt({ kind: 'mugshot' })}>View Prompt</button>
                {isAdmin && (
                  <>
                    <button className="btn btn-sm btn-outline-primary" onClick={() => generateMasterCharacterImages({ kind: 'mugshot' })}>Generate</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => deleteMasterCharacterImage({ kind: 'mugshot' })}>Delete</button>
                  </>
                )}
              </div>
            </div>
            <hr className="my-3" />
            <div className="mt-3">
              <div className="fw-bold">Interrogation Room Photos</div>
              {masterCharacterIrUrls.length > 0 ? (
                <div className="mt-2">
                  <div className="form-text">Photo {masterCharacterIrIndex + 1} / {masterCharacterIrUrls.length}</div>
                  <WebpImage className="img-fluid rounded" src={masterCharacterIrUrls[masterCharacterIrIndex]} alt="IR" />
                  <div className="mt-2 d-flex gap-2">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setMasterCharacterIrIndex((i) => Math.max(0, i - 1))} disabled={masterCharacterIrIndex === 0}>Prev</button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setMasterCharacterIrIndex((i) => (i + 1) % masterCharacterIrUrls.length)}>Next</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => deleteMasterCharacterImage({ kind: 'ir', url: masterCharacterIrUrls[masterCharacterIrIndex] })}>Delete</button>
                  </div>
                </div>
              ) : <div className="form-text mt-2">No IR photos found.</div>}
              <div className="mt-2">
                <div className="small fw-bold">Emotions</div>
                <div className="d-flex flex-wrap gap-2 mt-1">
                  {masterCharacterIrEmotions.map((emo) => (
                    <label key={emo} className="form-check m-0 small"><input type="checkbox" className="form-check-input" checked={masterCharacterIrEmotionEnabled[emo] !== false} onChange={(e) => setMasterCharacterIrEmotionEnabled((p) => ({ ...p, [emo]: e.target.checked }))} />{emo}</label>
                  ))}
                </div>
                {isAdmin && <button className="btn btn-sm btn-outline-primary mt-2" onClick={() => generateMasterCharacterImages({ kind: 'ir' })} disabled={busy}>Generate IR Photo</button>}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="fw-bold">Description</div>
            <div className="input-group mt-2">
              <button type="button" className={isMasterAssetFieldLocked('description') ? 'btn btn-outline-warning' : 'btn btn-outline-secondary'} onClick={() => toggleMasterAssetFieldLock('description')} disabled={busy || !isAdmin}>{isMasterAssetFieldLocked('description') ? lockSvg : unlockSvg}</button>
              <textarea className="form-control" rows={4} value={getMasterAssetDataObject().description || ''} onChange={(e) => updateMasterAssetDetailsDataObject((prev: any) => ({ ...prev, description: e.target.value }))} disabled={busy || !isAdmin || isMasterAssetFieldLocked('description')} />
            </div>
            {(isLocation || isWeapon) && (
              <div className="mt-3">
                <div className="fw-bold">Image</div>
                {getMasterAssetDataObject().image?.url && <WebpImage className="img-fluid rounded mt-2" src={getMasterAssetDataObject().image.url} alt="Asset" />}
                <div className="mt-2 d-flex gap-2">
                  {isAdmin && <button className="btn btn-sm btn-outline-primary" onClick={generateMasterAssetPrimaryImage}>Generate Image</button>}
                  {isAdmin && <button className="btn btn-sm btn-outline-danger" onClick={deleteMasterAssetPrimaryImage}>Delete Image</button>}
                </div>
                {isAdmin && <input type="file" className="form-control form-control-sm mt-2" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMasterAssetImage({ file: f }); }} />}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
