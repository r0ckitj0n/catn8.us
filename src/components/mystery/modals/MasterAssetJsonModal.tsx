import React from 'react';

interface MasterAssetJsonModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  masterAssetJsonTitle: string;
  masterAssetJsonText: string;
  copyMasterAssetJsonText: () => void;
}

export function MasterAssetJsonModal({
  modalRef,
  masterAssetJsonTitle,
  masterAssetJsonText,
  copyMasterAssetJsonText,
}: MasterAssetJsonModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{masterAssetJsonTitle || 'JSON'}</h5>
            <div className="d-flex gap-2 align-items-center">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={copyMasterAssetJsonText} disabled={!masterAssetJsonText}>
                Copy
              </button>
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            <textarea className="form-control" value={String(masterAssetJsonText || '')} readOnly rows={18} spellCheck={false} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
