import React from 'react';
import { IToast } from '../../../types/common';
import { LocationsManager } from '../../modals/LocationsManager';

interface LocationsModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  isAdmin: boolean;
  caseId: string | number;
  busy: boolean;
  showMysteryToast: (t: Partial<IToast>) => void;
}

export function LocationsModal({
  modalRef,
  isAdmin,
  caseId,
  busy,
  showMysteryToast,
}: LocationsModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl catn8-modal-wide">
        <div className="modal-content">
          <LocationsManager 
            isAdmin={isAdmin}
            caseId={caseId}
            busy={busy}
            showMysteryToast={showMysteryToast}
          />
        </div>
      </div>
    </div>
  );
}
