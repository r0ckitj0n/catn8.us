import React from 'react';

import { IBuildWizardContact } from '../../types/buildWizard';
import { BuildWizardContactType, contactTypeChipClass, normalizeContactType } from './buildWizardPageRenderTypes';

type BuildWizardStepAssigneeEntry = {
  contact: IBuildWizardContact;
  source: 'phase' | 'step';
};

interface BuildWizardStepAssigneesProps {
  allStepAssignees: BuildWizardStepAssigneeEntry[];
  contactTypeChipClass: typeof contactTypeChipClass;
  hasAssigneeFilters: boolean;
  normalizeContactType: typeof normalizeContactType;
  open: boolean;
  stepId: number;
  visibleStepAssignees: BuildWizardStepAssigneeEntry[];
}

export function BuildWizardStepAssignees({
  allStepAssignees,
  contactTypeChipClass,
  hasAssigneeFilters,
  normalizeContactType,
  open,
  stepId,
  visibleStepAssignees,
}: BuildWizardStepAssigneesProps) {
  if (!open || allStepAssignees.length === 0) {
    return null;
  }

  return (
    <div className="build-wizard-step-assignees">
      <div className="build-wizard-step-assignees-label">Contacts</div>
      {visibleStepAssignees.length > 0 ? (
        <div className="build-wizard-step-assignee-list">
          {visibleStepAssignees.map((entry) => (
            <div key={`${stepId}-${entry.contact.id}`} className={`build-wizard-step-assignee-row ${contactTypeChipClass(normalizeContactType(entry.contact))}`}>
              <span className="build-wizard-step-assignee-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 12c2.5 0 4.5-2 4.5-4.5S14.5 3 12 3 7.5 5 7.5 7.5 9.5 12 12 12Zm0 2c-4.1 0-7.5 2.9-7.5 6.5V21h15v-.5c0-3.6-3.4-6.5-7.5-6.5Z" />
                </svg>
              </span>
              <span className="build-wizard-step-assignee-text">{entry.contact.display_name}</span>
              <span className="build-wizard-step-assignee-source">
                {entry.source === 'phase' ? 'Phase' : 'Step'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="build-wizard-muted">
          {hasAssigneeFilters ? 'No assignments match the current filter.' : 'No contact assignments.'}
        </div>
      )}
    </div>
  );
}
