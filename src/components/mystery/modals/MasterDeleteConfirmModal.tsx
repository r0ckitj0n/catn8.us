import React from 'react';

interface MasterDeleteConfirmModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  busy: boolean;
  isAdmin: boolean;
  pendingMasterDelete: any;
  confirmMasterAssetDelete: () => Promise<void>;
}

export function MasterDeleteConfirmModal({
  modalRef,
  busy,
  isAdmin,
  pendingMasterDelete,
  confirmMasterAssetDelete,
}: MasterDeleteConfirmModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Delete permanently?</div>
            <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="mb-2">
              This will permanently delete the archived asset:
            </div>
            <div className="fw-bold">
              {String((pendingMasterDelete && typeof pendingMasterDelete === 'object' && pendingMasterDelete.item)
                ? (pendingMasterDelete.item.name || pendingMasterDelete.item.slug || pendingMasterDelete.item.id || '')
                : '')}
            </div>
            <div className="form-text">
              This cannot be undone.
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              data-bs-dismiss="modal"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={confirmMasterAssetDelete}
              disabled={busy || !isAdmin || !(pendingMasterDelete && typeof pendingMasterDelete === 'object' && pendingMasterDelete.item)}
            >
              Delete permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
