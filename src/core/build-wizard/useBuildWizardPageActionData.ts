import React from 'react';

import { useBuildWizardDeskActions } from './useBuildWizardDeskActions';
import { useBuildWizardLauncherActions } from './useBuildWizardLauncherActions';
import { useBuildWizardNoteDocumentActions } from './useBuildWizardNoteDocumentActions';
import { useBuildWizardRenderers } from './useBuildWizardRenderers';
import { useBuildWizardStepUiActions } from './useBuildWizardStepUiActions';
import { useBuildWizardWorkspaceUiCallbacks } from './useBuildWizardWorkspaceUiCallbacks';
import { useBuildWizardPageDocumentWorkflowActions } from './useBuildWizardPageDocumentWorkflowActions';

export function useBuildWizardPageActionData(options: any) {
  const launcherProjects = React.useMemo(
    () => options.buildWizard.projects.filter((candidate: any) => Number(candidate.is_template || 0) !== 1),
    [options.buildWizard.projects],
  );
  const templateProjects = React.useMemo(
    () => options.buildWizard.projects.filter((candidate: any) => Number(candidate.is_template || 0) === 1),
    [options.buildWizard.projects],
  );
  const isTemplateProject = Number(options.buildWizard.project?.is_template || 0) === 1;
  const launcherActions = useBuildWizardLauncherActions({
    buildEntryPoint: options.state.buildEntryPoint,
    createProject: options.buildWizard.createProject,
    isTemplateProject,
    newHomeWastewaterKind: options.state.newHomeWastewaterKind,
    newHomeWaterKind: options.state.newHomeWaterKind,
    onSetLauncherView: (nextView: any, nextEntryPoint: any) => {
      options.state.setView(nextView);
      options.state.setBuildEntryPoint(nextEntryPoint);
    },
    openProject: options.buildWizard.openProject,
    projectId: options.buildWizard.projectId,
    setActiveTab: options.state.setActiveTab,
    templateProjectsLength: templateProjects.length,
    updateProject: options.buildWizard.updateProject,
  });
  const stepUiActions = useBuildWizardStepUiActions({
    activeCurrencyInputKey: options.state.activeCurrencyInputKey,
    currencyInputByKey: options.state.currencyInputByKey,
    onToast: options.onToast,
    reorderSteps: options.buildWizard.reorderSteps,
    setActiveCurrencyInputKey: options.state.setActiveCurrencyInputKey,
    setCurrencyInputByKey: options.state.setCurrencyInputByKey,
    setRefreshingActualCostByStepId: options.state.setRefreshingActualCostByStepId,
    setStepDrafts: options.state.setStepDrafts,
    setStepEditModalStepId: options.state.setStepEditModalStepId,
    setVerifiedActualCostSignatureByStepId: options.state.setVerifiedActualCostSignatureByStepId,
    stepById: options.workspace.workspaceData.stepById,
    stepDrafts: options.state.stepDrafts,
    stepEditModalStepId: options.state.stepEditModalStepId,
    steps: options.buildWizard.steps,
    updateStep: options.buildWizard.updateStep,
  });
  const noteDocumentActions = useBuildWizardNoteDocumentActions({
    addStepNote: options.buildWizard.addStepNote,
    deleteDocument: options.buildWizard.deleteDocument,
    deleteStepNote: options.buildWizard.deleteStepNote,
    deletingDocumentId: options.state.deletingDocumentId,
    deletingNoteId: options.state.deletingNoteId,
    editingNoteTextById: options.state.editingNoteTextById,
    noteDraftByStep: options.state.noteDraftByStep,
    onToast: options.onToast,
    replacingDocumentId: options.state.replacingDocumentId,
    replaceDocument: options.buildWizard.replaceDocument,
    requestConfirmation: options.workspace.confirmationActions.requestConfirmation,
    setDeletingDocumentId: options.state.setDeletingDocumentId,
    setDeletingNoteId: options.state.setDeletingNoteId,
    setEditingNoteTextById: options.state.setEditingNoteTextById,
    setNoteDraftByStep: options.state.setNoteDraftByStep,
    setReplacingDocumentId: options.state.setReplacingDocumentId,
    setSavingNoteId: options.state.setSavingNoteId,
    setUnlinkingDocumentId: options.state.setUnlinkingDocumentId,
    unlinkingDocumentId: options.state.unlinkingDocumentId,
    updateDocument: options.buildWizard.updateDocument,
    updateStepNote: options.buildWizard.updateStepNote,
    savingNoteId: options.state.savingNoteId,
  });
  const lightboxSupportsZoom = Boolean(
    options.state.lightboxDoc
    && (options.state.lightboxDoc.mode === 'image' || options.state.lightboxDoc.mode === 'spreadsheet' || options.state.lightboxDoc.mode === 'plan')
  );
  const workspaceUiCallbacks = useBuildWizardWorkspaceUiCallbacks({
    activeTab: options.state.activeTab,
    clampLightboxZoom: options.clampLightboxZoom,
    deleteProject: options.buildWizard.deleteProject,
    focusStepExpansion: options.state.setExpandedStepById,
    lightboxSupportsZoom,
    lightboxZoomStep: options.LIGHTBOX_ZOOM_STEP,
    lightboxZoomStepFast: options.LIGHTBOX_ZOOM_STEP_FAST,
    onOpenDocumentPreview: options.workspace.documentPreview.openDocumentPreview,
    requestConfirmation: options.workspace.confirmationActions.requestConfirmation,
    setActiveTab: options.state.setActiveTab,
    setDeletingProjectId: options.state.setDeletingProjectId,
    setLightboxZoom: options.state.setLightboxZoom,
    setTopbarSearchFocusStepId: options.state.setTopbarSearchFocusStepId,
    setTopbarSearchOpen: options.state.setTopbarSearchOpen,
  });
  const deskActions = useBuildWizardDeskActions({
    addContactAssignment: options.buildWizard.addContactAssignment,
    aiBusy: options.buildWizard.aiBusy,
    deleteContact: options.buildWizard.deleteContact,
    deskAssignmentPhaseKey: options.state.deskAssignmentPhaseKey,
    deskAssignmentStepId: options.state.deskAssignmentStepId,
    deskAutoAssignBusy: options.state.deskAutoAssignBusy,
    deskContactDraft: options.state.deskContactDraft,
    deskContacts: options.workspace.workspaceData.deskContacts,
    generateStepsFromAi: options.buildWizard.generateStepsFromAi,
    onToast: options.onToast,
    projectId: options.buildWizard.projectId,
    requestConfirmation: options.workspace.confirmationActions.requestConfirmation,
    saveContact: options.buildWizard.saveContact,
    selectedDeskContact: options.workspace.workspaceData.selectedDeskContact,
    setDeskAutoAssignBusy: options.state.setDeskAutoAssignBusy,
    setDeskContactDraft: options.state.setDeskContactDraft,
    setDeskCreateMode: options.state.setDeskCreateMode,
    setDeskSelectedContactId: options.state.setDeskSelectedContactId,
    setStepContactCandidateByStepId: options.state.setStepContactCandidateByStepId,
    setStepContactPickerOpenByStepId: options.state.setStepContactPickerOpenByStepId,
    steps: options.buildWizard.steps,
    updateStep: options.buildWizard.updateStep,
    toStringOrNull: options.toStringOrNull,
  });
  const { documentActions, workflowActions } = useBuildWizardPageDocumentWorkflowActions({
    buildWizard: options.buildWizard,
    isAdmin: options.isAdmin,
    isLegacyAutoStampedTaskDate: options.isLegacyAutoStampedTaskDate,
    onToast: options.onToast,
    parseTaskMetaFromReceiptNotes: options.parseTaskMetaFromReceiptNotes,
    setTaskDateOverrideInReceiptNotes: options.setTaskDateOverrideInReceiptNotes,
    state: options.state,
    stepPhaseBucket: options.stepPhaseBucket,
    stepUiActions,
    toStringOrNull: options.toStringOrNull,
    workspace: options.workspace,
    taskUsesManualDateOverride: options.taskUsesManualDateOverride,
  });
  const renderers = useBuildWizardRenderers({
    deletingProjectId: options.state.deletingProjectId,
    docKind: options.state.docKind,
    docKindOptions: options.workspace.dropdownData.docKindOptions,
    docPhaseKey: options.state.docPhaseKey,
    docStepId: options.state.docStepId,
    formatDate: options.formatDate,
    isPlanPreviewDoc: options.workspace.documentPreview.isPlanPreviewDoc,
    isSpreadsheetPreviewDoc: options.workspace.documentPreview.isSpreadsheetPreviewDoc,
    launcherProjects,
    newHomeWastewaterKind: options.state.newHomeWastewaterKind,
    newHomeWaterKind: options.state.newHomeWaterKind,
    onBackToLauncher: launcherActions.onBackToLauncher,
    onCloseWizard: launcherActions.onCloseWizard,
    onCreateNewBuild: launcherActions.onCreateNewBuild,
    onCreateTemplate: launcherActions.onCreateTemplate,
    onDeleteProject: workspaceUiCallbacks.onDeleteProject,
    onOpenTemplateEditor: launcherActions.onOpenTemplateEditor,
    onRemoveDocumentFromStep: noteDocumentActions.onRemoveDocumentFromStep,
    openBuild: launcherActions.openBuild,
    openDocumentPreview: options.workspace.documentPreview.openDocumentPreview,
    phaseOptions: options.workspace.documentManagerData.phaseOptions,
    primaryBlueprintChoices: options.workspace.documentManagerData.primaryBlueprintChoices,
    primaryPhotoChoices: options.workspace.documentManagerData.primaryPhotoChoices,
    project: options.buildWizard.project,
    projectDocuments: options.workspace.documentManagerData.projectDocuments,
    selectableDocSteps: options.workspace.workspaceSelectionData.selectableDocSteps,
    setDocKind: options.state.setDocKind,
    setDocPhaseKey: options.state.setDocPhaseKey,
    setDocStepId: options.state.setDocStepId,
    setNewHomeWastewaterKind: options.state.setNewHomeWastewaterKind,
    setNewHomeWaterKind: options.state.setNewHomeWaterKind,
    templateProjects,
    unlinkingDocumentId: options.state.unlinkingDocumentId,
    updateProject: options.buildWizard.updateProject,
    uploadDocument: options.buildWizard.uploadDocument,
  });
  return {
    deskActions,
    documentActions,
    isTemplateProject,
    launcherActions,
    lightboxSupportsZoom,
    noteDocumentActions,
    renderers,
    stepUiActions,
    workflowActions,
    workspaceUiCallbacks,
  };
}
