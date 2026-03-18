import React from 'react';

import { IBuildWizardStep } from '../../types/buildWizard';
import { BuildWizardProjectDeskContacts } from './buildWizardProjectDeskContacts';
import { BuildWizardProjectDeskDocuments } from './buildWizardProjectDeskDocuments';
import { BuildWizardProjectDeskModal } from './buildWizardProjectDeskModal';

interface BuildWizardProjectDeskWorkspaceProps {
  contactsProps: React.ComponentProps<typeof BuildWizardProjectDeskContacts>;
  documentsProps: React.ComponentProps<typeof BuildWizardProjectDeskDocuments>;
  onAddStep: () => Promise<unknown>;
  onClose: () => void;
  open: boolean;
  projectDeskSteps: IBuildWizardStep[];
  renderEditableStepCards: (tabSteps: IBuildWizardStep[]) => React.ReactNode;
}

export function BuildWizardProjectDeskWorkspace({
  contactsProps,
  documentsProps,
  onAddStep,
  onClose,
  open,
  projectDeskSteps,
  renderEditableStepCards,
}: BuildWizardProjectDeskWorkspaceProps) {
  return (
    <BuildWizardProjectDeskModal open={open} onClose={onClose} onAddStep={onAddStep}>
      <div className="build-wizard-desk-grid">
        <BuildWizardProjectDeskDocuments {...documentsProps} />
        <BuildWizardProjectDeskContacts {...contactsProps} />
      </div>
      {renderEditableStepCards(projectDeskSteps)}
    </BuildWizardProjectDeskModal>
  );
}
