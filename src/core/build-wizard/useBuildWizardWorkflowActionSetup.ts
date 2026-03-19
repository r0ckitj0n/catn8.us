import { useBuildWizardAiConfirmActions } from './useBuildWizardAiConfirmActions';
import { useBuildWizardRecoveryUiActions } from './useBuildWizardRecoveryUiActions';
import { useBuildWizardStepDragActions } from './useBuildWizardStepDragActions';
import { useBuildWizardStepEditActions } from './useBuildWizardStepEditActions';

export function useBuildWizardWorkflowActionSetup(options: any) {
  const aiActions = useBuildWizardAiConfirmActions({
    generateStepsFromAi: options.generateStepsFromAi,
    requestConfirmation: options.requestConfirmation,
  });

  const recoveryActions = useBuildWizardRecoveryUiActions({
    clearedLegacyTaskDatesByProjectRef: options.clearedLegacyTaskDatesByProjectRef,
    documents: options.documents,
    fetchSingletreeRecoveryStatus: options.fetchSingletreeRecoveryStatus,
    isAdmin: options.isAdmin,
    isLegacyAutoStampedTaskDate: options.isLegacyAutoStampedTaskDate,
    onToast: options.onToast,
    openProject: options.openProject,
    parseTaskMetaFromReceiptNotes: options.parseTaskMetaFromReceiptNotes,
    projectId: options.projectId,
    recoverSingletreeDocuments: options.recoverSingletreeDocuments,
    recoveryBusy: options.recoveryBusy,
    recoveryJobId: options.recoveryJobId,
    recoveryPolling: options.recoveryPolling,
    recoveryStagedRoot: options.recoveryStagedRoot,
    recoveryStatus: options.recoveryStatus,
    recoveryUploadBusy: options.recoveryUploadBusy,
    recoveryUploadInputRef: options.recoveryUploadInputRef,
    requestConfirmation: options.requestConfirmation,
    setRecoveryJobId: options.setRecoveryJobId,
    setRecoveryPolling: options.setRecoveryPolling,
    setRecoveryReportJson: options.setRecoveryReportJson,
    setRecoveryReportOpen: options.setRecoveryReportOpen,
    setRecoveryStagedCount: options.setRecoveryStagedCount,
    setRecoveryStagedRoot: options.setRecoveryStagedRoot,
    setRecoveryStatus: options.setRecoveryStatus,
    setRecoveryUploadBusy: options.setRecoveryUploadBusy,
    setRecoveryUploadToken: options.setRecoveryUploadToken,
    setTaskDateOverrideInReceiptNotes: options.setTaskDateOverrideInReceiptNotes,
    stageSingletreeSourceFiles: options.stageSingletreeSourceFiles,
  });

  const stepEditActions = useBuildWizardStepEditActions({
    clearStepDraft: options.clearStepDraft,
    documents: options.documents,
    expandPhaseRangeForStep: options.expandPhaseRangeForStep,
    onToast: options.onToast,
    parseTaskMetaFromReceiptNotes: options.parseTaskMetaFromReceiptNotes,
    reorderSteps: options.reorderSteps,
    setStepEditModalStepId: options.setStepEditModalStepId,
    setStepEditSaving: options.setStepEditSaving,
    stepDrafts: options.stepDrafts,
    stepEditModalStep: options.stepEditModalStep,
    stepEditSaving: options.stepEditSaving,
    steps: options.steps,
    updateStep: options.updateStep,
  });

  const dragActions = useBuildWizardStepDragActions({
    activeTabTreeRows: options.activeTabTreeRows,
    clampStepDatesWithinRange: options.clampStepDatesWithinRange,
    draggingStepId: options.draggingStepId,
    reorderSteps: options.reorderSteps,
    setDragOverInsertIndex: options.setDragOverInsertIndex,
    setDragOverParentStepId: options.setDragOverParentStepId,
    setDraggingStepId: options.setDraggingStepId,
    stepById: options.stepById,
    steps: options.steps,
    updateStep: options.updateStep,
  });

  return {
    ...aiActions,
    ...recoveryActions,
    ...stepEditActions,
    ...dragActions,
  };
}
