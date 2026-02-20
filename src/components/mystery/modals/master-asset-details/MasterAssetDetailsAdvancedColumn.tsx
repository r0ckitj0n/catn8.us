import React from 'react';

import { MasterAssetDetailsModalProps } from './types';

type Props = Pick<MasterAssetDetailsModalProps,
  'busy' | 'isAdmin' | 'masterAssetDetailsType' | 'masterAssetDetailsItem' | 'masterAssetDetailsFields' |
  'setMasterAssetDetailsFields' | 'masterCharacterDepositionBusy' | 'scenarioId' | 'masterCharacterScenarioEntityId' |
  'loadMasterCharacterDeposition' | 'openJsonPreview' | 'caseId' | 'enqueueSpecificJob' |
  'masterCharacterDepositionError' | 'masterCharacterDepositionUpdatedAt' | 'masterCharacterDepositionText' |
  'masterAssetDetailsDataText' | 'resetMasterAssetDetails' | 'archiveMasterAsset'
> & {
  getFav: (key: string) => string;
  setFav: (key: string, value: string) => void;
};

export function MasterAssetDetailsAdvancedColumn(props: Props) {
  const {
    busy,
    isAdmin,
    masterAssetDetailsType,
    masterAssetDetailsItem,
    masterAssetDetailsFields,
    setMasterAssetDetailsFields,
    masterCharacterDepositionBusy,
    scenarioId,
    masterCharacterScenarioEntityId,
    loadMasterCharacterDeposition,
    openJsonPreview,
    caseId,
    enqueueSpecificJob,
    masterCharacterDepositionError,
    masterCharacterDepositionUpdatedAt,
    masterCharacterDepositionText,
    masterAssetDetailsDataText,
    resetMasterAssetDetails,
    archiveMasterAsset,
    getFav,
    setFav,
  } = props;

  const isCharacter = masterAssetDetailsType === 'character';

  return (
    <div className="col-12 col-xl-4">
      {isCharacter ? (
        <div className="catn8-card p-3 h-100">
          <div className="fw-bold">Rapport Traits</div>
          <div className="row g-2 mt-2">
            <div className="col-12"><label className="form-label">Likes (one per line)</label><textarea className="form-control" rows={2} value={(masterAssetDetailsFields.rapport_likes || []).join('\n')} onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, rapport_likes: e.target.value.split('\n').filter(Boolean) }))} disabled={busy || !isAdmin} /></div>
            <div className="col-12"><label className="form-label">Dislikes (one per line)</label><textarea className="form-control" rows={2} value={(masterAssetDetailsFields.rapport_dislikes || []).join('\n')} onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, rapport_dislikes: e.target.value.split('\n').filter(Boolean) }))} disabled={busy || !isAdmin} /></div>
            <div className="col-12"><label className="form-label">Quirks (one per line)</label><textarea className="form-control" rows={2} value={(masterAssetDetailsFields.rapport_quirks || []).join('\n')} onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, rapport_quirks: e.target.value.split('\n').filter(Boolean) }))} disabled={busy || !isAdmin} /></div>
            <div className="col-12"><label className="form-label">Fun Facts (one per line)</label><textarea className="form-control" rows={2} value={(masterAssetDetailsFields.rapport_fun_facts || []).join('\n')} onChange={(e) => setMasterAssetDetailsFields((p: any) => ({ ...p, rapport_fun_facts: e.target.value.split('\n').filter(Boolean) }))} disabled={busy || !isAdmin} /></div>
          </div>

          <div className="mt-3">
            <div className="fw-bold">Legacy (Deprecated)</div>
            <details className="mt-2">
              <summary className="fw-bold small">JSON Fields</summary>
              <div className="row g-2 mt-2">
                {['color', 'snack', 'drink', 'music', 'hobby', 'pet'].map((key) => (
                  <div key={key} className="col-6"><label className="form-label text-capitalize">{key}</label><input className="form-control" value={getFav(key)} onChange={(e) => setFav(key, e.target.value)} disabled={busy || !isAdmin} /></div>
                ))}
              </div>
            </details>
          </div>

          <hr className="my-3" />
          <div>
            <div className="d-flex align-items-center justify-content-between gap-2">
              <div><div className="fw-bold">Deposition</div><div className="form-text">Sworn statement for this scenario.</div></div>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadMasterCharacterDeposition()} disabled={busy || masterCharacterDepositionBusy || !scenarioId || !masterCharacterScenarioEntityId} title="Refresh deposition">Refresh</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => openJsonPreview({ title: 'generate_deposition job', payload: { action: 'generate_deposition', case_id: caseId, scenario_id: scenarioId, entity_id: masterCharacterScenarioEntityId } })} disabled={busy || !scenarioId || !masterCharacterScenarioEntityId}>View Prompt</button>
                {isAdmin && <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => enqueueSpecificJob({ action: 'generate_deposition', spec: {}, requireScenario: true, entityId: masterCharacterScenarioEntityId })} disabled={busy || !scenarioId || !masterCharacterScenarioEntityId}>Generate</button>}
              </div>
            </div>
            {masterCharacterDepositionError && <div className="alert alert-danger mt-2 mb-0 small" role="alert">{masterCharacterDepositionError}</div>}
            {!scenarioId ? <div className="text-muted mt-2 small">Select a scenario to view depositions.</div> : (!masterCharacterScenarioEntityId ? <div className="text-muted mt-2 small">Character not in this scenario.</div> : (
              <div className="mt-2">
                {masterCharacterDepositionUpdatedAt && <div className="text-muted smallest mb-1">Updated: {masterCharacterDepositionUpdatedAt}</div>}
                <div className="catn8-card p-2 smallest bg-light">{masterCharacterDepositionText.trim() ? <div className="catn8-prewrap">{masterCharacterDepositionText}</div> : <div className="text-muted italic">No deposition yet.</div>}</div>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <div className="fw-bold">Advanced</div>
            <details className="mt-2"><summary className="fw-bold small">Data JSON</summary><textarea className="form-control mt-1" rows={10} value={masterAssetDetailsDataText} readOnly /></details>
          </div>

          <div className="mt-3 d-flex justify-content-end gap-2">
            {isAdmin && <button className="btn btn-outline-secondary" onClick={resetMasterAssetDetails}>Reset</button>}
            {isAdmin && <button className={`btn ${Number(masterAssetDetailsItem?.is_archived) ? 'btn-outline-success' : 'btn-outline-danger'}`} onClick={() => archiveMasterAsset({ type: 'character', id: masterAssetDetailsItem.id, is_archived: Number(masterAssetDetailsItem.is_archived) ? 0 : 1 })}>{Number(masterAssetDetailsItem?.is_archived) ? 'Restore' : 'Archive'}</button>}
          </div>
        </div>
      ) : (
        <div className="catn8-card p-3 h-100">
          <div className="fw-bold">Advanced</div>
          <textarea className="form-control mt-2" rows={15} value={masterAssetDetailsDataText} readOnly />
          <div className="mt-3 d-flex justify-content-end gap-2">
            {isAdmin && <button className="btn btn-outline-secondary" onClick={resetMasterAssetDetails}>Reset</button>}
            {isAdmin && <button className={`btn ${Number(masterAssetDetailsItem?.is_archived) ? 'btn-outline-success' : 'btn-outline-danger'}`} onClick={() => archiveMasterAsset({ type: masterAssetDetailsType, id: masterAssetDetailsItem.id, is_archived: Number(masterAssetDetailsItem.is_archived) ? 0 : 1 })}>{Number(masterAssetDetailsItem?.is_archived) ? 'Restore' : 'Archive'}</button>}
          </div>
        </div>
      )}
    </div>
  );
}
