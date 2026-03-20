import React from 'react';

export function useBuildWizardSelectionEffects(options: any) {
  React.useEffect(() => {
    if (options.stepCardAssigneeIdFilter <= 0) {
      return;
    }
    const exists = options.stepFilterContactOptions.some((contact: any) => contact.id === options.stepCardAssigneeIdFilter);
    if (!exists) {
      options.setStepCardAssigneeIdFilter(0);
    }
  }, [options.setStepCardAssigneeIdFilter, options.stepCardAssigneeIdFilter, options.stepFilterContactOptions]);

  React.useEffect(() => {
    if (options.moveStepModalStepId <= 0) {
      return;
    }
    const selected = options.stepById.get(options.moveStepModalStepId);
    if (!selected) {
      options.setMoveStepModalStepId(0);
    }
  }, [options.moveStepModalStepId, options.setMoveStepModalStepId, options.stepById]);

  React.useEffect(() => {
    if (options.stepEditModalStepId <= 0) {
      return;
    }
    if (!options.stepById.has(options.stepEditModalStepId)) {
      options.setStepEditModalStepId(0);
    }
  }, [options.setStepEditModalStepId, options.stepById, options.stepEditModalStepId]);
}
