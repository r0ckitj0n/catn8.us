import React from 'react';
import { IToast } from '../../../types/common';
import { WeaponsManager } from '../../modals/WeaponsManager';

interface WeaponsModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  isAdmin: boolean;
  mysteryId: string | number;
  caseId: string | number;
  busy: boolean;
  showMysteryToast: (t: Partial<IToast>) => void;
}

export function WeaponsModal({
  modalRef,
  isAdmin,
  mysteryId,
  caseId,
  busy,
  showMysteryToast,
}: WeaponsModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl catn8-modal-wide">
        <div className="modal-content">
          <WeaponsManager 
            isAdmin={isAdmin}
            mysteryId={mysteryId}
            caseId={caseId}
            busy={busy}
            showMysteryToast={showMysteryToast}
          />
        </div>
      </div>
    </div>
  );
}
