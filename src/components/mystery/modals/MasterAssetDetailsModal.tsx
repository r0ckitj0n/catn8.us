import React from 'react';

import { MasterAssetDetailsAdvancedColumn } from './master-asset-details/MasterAssetDetailsAdvancedColumn';
import { MasterAssetDetailsBasicsColumn } from './master-asset-details/MasterAssetDetailsBasicsColumn';
import { MasterAssetDetailsMediaColumn } from './master-asset-details/MasterAssetDetailsMediaColumn';
import { MasterAssetDetailsModalProps } from './master-asset-details/types';

export function MasterAssetDetailsModal(props: MasterAssetDetailsModalProps) {
  const {
    modalRef,
    busy,
    isAdmin,
    masterAssetDetailsItem,
    isMasterAssetDetailsDirty,
    saveMasterAssetDetails,
    onOpenAiImageConfig,
    saveSvg,
    cogSvg,
    masterAssetDetailsFavorites,
    setMasterAssetDetailsFavorites,
  } = props;

  const getFav = (key: string) => masterAssetDetailsFavorites?.[key] || '';
  const setFav = (key: string, val: string) => {
    setMasterAssetDetailsFavorites((prev: any) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Asset Details</div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={isMasterAssetDetailsDirty ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary'}
                onClick={saveMasterAssetDetails}
                disabled={busy || !isAdmin || !isMasterAssetDetailsDirty}
                title={isMasterAssetDetailsDirty ? 'Save changes' : 'No changes to save'}
              >
                {saveSvg}
                <span className="ms-1">Save</span>
              </button>
              {isAdmin && (
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onOpenAiImageConfig} disabled={busy} title="AI Image Configuration">
                  {cogSvg}
                  <span className="ms-1">Config</span>
                </button>
              )}
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            {!masterAssetDetailsItem ? (
              <div className="text-muted">Select an asset first.</div>
            ) : (
              <div className="row g-3">
                <MasterAssetDetailsBasicsColumn {...props} />
                <MasterAssetDetailsMediaColumn {...props} />
                <MasterAssetDetailsAdvancedColumn {...props} getFav={getFav} setFav={setFav} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
