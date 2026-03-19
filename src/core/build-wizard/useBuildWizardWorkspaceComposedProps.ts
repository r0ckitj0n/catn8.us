import { buildBuildWizardEditableStepCardOptions } from './buildBuildWizardEditableStepCardOptions';
import { buildBuildWizardWorkspaceMainOptions } from './buildBuildWizardWorkspaceMainOptions';
import { buildBuildWizardWorkspaceModalOptions } from './buildBuildWizardWorkspaceModalOptions';
import { useBuildWizardEditableStepCardSetup } from './useBuildWizardEditableStepCardSetup';
import { useBuildWizardWorkspaceMainSetup } from './useBuildWizardWorkspaceMainSetup';
import { useBuildWizardWorkspaceModalSetup } from './useBuildWizardWorkspaceModalSetup';
import { useBuildWizardWorkspaceRenderHelpers } from './useBuildWizardWorkspaceRenderHelpers';

export function useBuildWizardWorkspaceComposedProps(options: any) {
  const editableStepCardContext = useBuildWizardEditableStepCardSetup(buildBuildWizardEditableStepCardOptions(options));
  const renderHelpers = useBuildWizardWorkspaceRenderHelpers({
    activeTabTreeRows: options.activeTabTreeRows,
    dragOverInsertIndex: options.dragOverInsertIndex,
    editableStepCardContext,
    formatCurrency: options.formatCurrency,
    onDropReorder: options.onDropReorder,
    setDragOverInsertIndex: options.setDragOverInsertIndex,
    setDragOverParentStepId: options.setDragOverParentStepId,
    stepCardAssigneeIdFilter: options.stepCardAssigneeIdFilter,
    stepCardAssigneeTypeFilter: options.stepCardAssigneeTypeFilter,
    stepCardTextFilterTokens: options.stepCardTextFilterTokens,
    stepSearchTextById: options.stepSearchTextById,
  });

  const workspaceModalProps = useBuildWizardWorkspaceModalSetup({
    ...buildBuildWizardWorkspaceModalOptions(options),
    formatAuditValue: renderHelpers.formatAuditValue,
  });
  const buildWorkspaceProps = useBuildWizardWorkspaceMainSetup({
    ...buildBuildWizardWorkspaceMainOptions(options),
    renderEditableStepCards: renderHelpers.renderEditableStepCards,
  });

  return {
    buildWorkspaceProps,
    editableStepCardContext,
    workspaceModalProps,
  };
}
