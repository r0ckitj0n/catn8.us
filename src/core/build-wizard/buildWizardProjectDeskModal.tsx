import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';

interface BuildWizardProjectDeskModalProps {
  children: React.ReactNode;
  onAddStep: () => Promise<unknown>;
  onClose: () => void;
  open: boolean;
}

export function BuildWizardProjectDeskModal({ children, onAddStep, onClose, open }: BuildWizardProjectDeskModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="build-wizard-doc-manager" onClick={onClose}>
      <div className="build-wizard-doc-manager-inner build-wizard-project-desk-inner" onClick={(e) => e.stopPropagation()}>
        <div className="build-wizard-doc-manager-head">
          <h3>Project Desk</h3>
          <div className="build-wizard-doc-manager-actions">
            <button type="button" className="build-wizard-phase-add" title="Add step" aria-label="Add step" onClick={() => void onAddStep()}>+</button>
            <StandardIconButton iconKey="close" ariaLabel="Close project desk" title="Close" className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn" onClick={onClose} />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
