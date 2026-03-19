import React from 'react';

import { IBuildWizardStep } from '../../types/buildWizard';
import { BuildWizardEditableStepCards } from './buildWizardEditableStepCards';
import { formatAuditValue as formatAuditValueBase } from './buildWizardCurrencyAuditUtils';

export function useBuildWizardWorkspaceRenderHelpers(options: any) {
  const formatAuditValue = React.useCallback((value: unknown, fieldName?: string): string => {
    return formatAuditValueBase(value, fieldName, options.formatCurrency);
  }, [options.formatCurrency]);

  const renderEditableStepCards = React.useCallback((tabSteps: IBuildWizardStep[]) => (
    <BuildWizardEditableStepCards
      activeTabTreeRows={options.activeTabTreeRows}
      cardContext={options.editableStepCardContext}
      dragOverInsertIndex={options.dragOverInsertIndex}
      onDropReorder={options.onDropReorder}
      setDragOverInsertIndex={options.setDragOverInsertIndex}
      setDragOverParentStepId={options.setDragOverParentStepId}
      stepCardAssigneeIdFilter={options.stepCardAssigneeIdFilter}
      stepCardAssigneeTypeFilter={options.stepCardAssigneeTypeFilter}
      stepCardTextFilterTokens={options.stepCardTextFilterTokens}
      stepSearchTextById={options.stepSearchTextById}
      tabSteps={tabSteps}
    />
  ), [
    options.activeTabTreeRows,
    options.dragOverInsertIndex,
    options.editableStepCardContext,
    options.onDropReorder,
    options.setDragOverInsertIndex,
    options.setDragOverParentStepId,
    options.stepCardAssigneeIdFilter,
    options.stepCardAssigneeTypeFilter,
    options.stepCardTextFilterTokens,
    options.stepSearchTextById,
  ]);

  return { formatAuditValue, renderEditableStepCards };
}
