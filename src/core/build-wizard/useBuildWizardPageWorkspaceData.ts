import React from 'react';

import { IBuildWizardStep } from '../../types/buildWizard';
import { LIGHTBOX_TEXT_PREVIEW_MAX_CHARS } from './buildWizardPageRenderConstants';
import { useBuildWizardActiveTabTree } from './useBuildWizardActiveTabTree';
import { useBuildWizardConfirmationActions } from './useBuildWizardConfirmationActions';
import { useBuildWizardDocumentManagerData } from './useBuildWizardDocumentManagerData';
import { useBuildWizardDocumentPreview } from './useBuildWizardDocumentPreview';
import { useBuildWizardDropdownData } from './useBuildWizardDropdownData';
import { useBuildWizardOverviewData } from './useBuildWizardOverviewData';
import { useBuildWizardPhaseRangeActions } from './useBuildWizardPhaseRangeActions';
import { useBuildWizardStepWorkspaceMeta } from './useBuildWizardStepWorkspaceMeta';
import { useBuildWizardWorkspaceData } from './useBuildWizardWorkspaceData';
import { useBuildWizardWorkspaceSelectionData } from './useBuildWizardWorkspaceSelectionData';
import { useBuildWizardPageEffects } from './useBuildWizardPageEffects';

export function useBuildWizardPageWorkspaceData(options: any) {
  const confirmationActions = useBuildWizardConfirmationActions();
  const documentPreview = useBuildWizardDocumentPreview({
    lightboxTextPreviewMaxChars: LIGHTBOX_TEXT_PREVIEW_MAX_CHARS,
    onToast: options.onToast,
    parseTaskDocumentPreview: options.parseTaskDocumentPreview,
    setLightboxDoc: options.state.setLightboxDoc,
    setLightboxSpreadsheetSheetIndex: options.state.setLightboxSpreadsheetSheetIndex,
    setLightboxZoom: options.state.setLightboxZoom,
  });

  const dropdownData = useBuildWizardDropdownData({
    docKind: options.state.docKind,
    dropdownSettings: options.state.dropdownSettings,
    lotSizeInput: options.state.lotSizeInput,
    setDocKind: options.state.setDocKind,
  });

  const workspaceData = useBuildWizardWorkspaceData({
    activeTab: options.state.activeTab,
    contactAssignments: options.buildWizard.contactAssignments,
    contacts: options.buildWizard.contacts,
    deskContactQuery: options.state.deskContactQuery,
    deskContactTypeFilter: options.state.deskContactTypeFilter,
    deskSelectedContactId: options.state.deskSelectedContactId,
    moveStepModalStepId: options.state.moveStepModalStepId,
    stepDrafts: options.state.stepDrafts,
    stepEditModalStepId: options.state.stepEditModalStepId,
    stepInfoModalStepId: options.state.stepInfoModalStepId,
    stepPhaseBucket: options.stepPhaseBucket,
    steps: options.buildWizard.steps,
  });
  const activeTabTree = useBuildWizardActiveTabTree(workspaceData.filteredTabSteps);

  const stepEditModalDependencyIds = React.useMemo(() => {
    if (!workspaceData.stepEditModalStep || !workspaceData.stepEditModalDraft) return [] as number[];
    return Array.from(
      new Set(
        (Array.isArray(workspaceData.stepEditModalDraft.depends_on_step_ids) ? workspaceData.stepEditModalDraft.depends_on_step_ids : [])
          .map((rawId) => Number(rawId || 0))
          .filter((id) => id > 0 && id !== workspaceData.stepEditModalStep.id),
      ),
    );
  }, [workspaceData.stepEditModalDraft, workspaceData.stepEditModalStep]);
  const stepEditModalDependencyOptions = React.useMemo(() => {
    if (!workspaceData.stepEditModalStep) return [] as IBuildWizardStep[];
    return options.buildWizard.steps
      .filter((candidate: IBuildWizardStep) => candidate.id !== workspaceData.stepEditModalStep.id && !stepEditModalDependencyIds.includes(candidate.id))
      .sort((a: IBuildWizardStep, b: IBuildWizardStep) => (a.step_order !== b.step_order ? a.step_order - b.step_order : a.id - b.id));
  }, [options.buildWizard.steps, stepEditModalDependencyIds, workspaceData.stepEditModalStep]);

  const stepWorkspaceMeta = useBuildWizardStepWorkspaceMeta({
    contactAssignments: options.buildWizard.contactAssignments,
    contacts: options.buildWizard.contacts,
    documents: options.buildWizard.documents,
    filteredTabSteps: workspaceData.filteredTabSteps,
    parseTaskMetaFromReceiptNotes: options.parseTaskMetaFromReceiptNotes,
    stepCardTextFilter: options.state.stepCardTextFilter,
    stepPhaseBucket: options.stepPhaseBucket,
    steps: options.buildWizard.steps,
  });
  const overviewData = useBuildWizardOverviewData({
    activeTab: options.state.activeTab,
    documents: options.buildWizard.documents,
    filteredTabSteps: workspaceData.filteredTabSteps,
    getStepActualExcludingQuotes: stepWorkspaceMeta.getStepActualExcludingQuotes,
    getStepEstimatedExcludingQuotes: stepWorkspaceMeta.getStepEstimatedExcludingQuotes,
    isAiEstimatedField: options.isAiEstimatedField,
    parseTaskMetaFromReceiptNotes: options.parseTaskMetaFromReceiptNotes,
    project: options.buildWizard.project,
    stepAssigneesByStepId: stepWorkspaceMeta.stepAssigneesByStepId,
    stepPhaseBucket: options.stepPhaseBucket,
    steps: options.buildWizard.steps,
  });
  const phaseRangeActions = useBuildWizardPhaseRangeActions({
    activeTab: options.state.activeTab,
    moveStepModalStepId: options.state.moveStepModalStepId,
    moveStepModalTargetTab: options.state.moveStepModalTargetTab,
    movingStep: options.state.movingStep,
    onToast: options.onToast,
    phaseDateRanges: options.buildWizard.phaseDateRanges,
    projectId: options.buildWizard.projectId,
    savePhaseDateRange: options.buildWizard.savePhaseDateRange,
    setActiveTab: options.state.setActiveTab,
    setMoveStepModalStepId: options.state.setMoveStepModalStepId,
    setMoveStepModalTargetTab: options.state.setMoveStepModalTargetTab,
    setMovingStep: options.state.setMovingStep,
    stepById: workspaceData.stepById,
    stepPhaseBucket: options.stepPhaseBucket,
    steps: options.buildWizard.steps,
    updateStep: options.buildWizard.updateStep,
  });
  const workspaceSelectionData = useBuildWizardWorkspaceSelectionData({
    activeTab: options.state.activeTab,
    docPhaseKey: options.state.docPhaseKey,
    documents: options.buildWizard.documents,
    filteredTabSteps: workspaceData.filteredTabSteps,
    setFooterRange: options.state.setFooterRange,
    stepPhaseBucket: options.stepPhaseBucket,
    steps: options.buildWizard.steps,
  });
  const documentManagerData = useBuildWizardDocumentManagerData({
    attachExistingDocFilterByReceiptId: options.state.attachExistingDocFilterByReceiptId,
    attachableProjectDocuments: workspaceSelectionData.attachableProjectDocuments,
    buildTabs: options.BUILD_TABS,
    docKindOptions: dropdownData.docKindOptions,
    documentManagerKindFilter: options.state.documentManagerKindFilter,
    documentManagerPhaseFilter: options.state.documentManagerPhaseFilter,
    documentManagerQuery: options.state.documentManagerQuery,
    documentManagerSearchResults: options.state.documentManagerSearchResults,
    documentManagerStepFilter: options.state.documentManagerStepFilter,
    documents: options.buildWizard.documents,
    linkedStepOptions: workspaceSelectionData.linkedStepOptions,
    moveTaskModalDocId: options.state.moveTaskModalDocId,
    stepById: workspaceData.stepById,
    stepByIdMap: workspaceData.stepByIdMap,
    stepPhaseBucket: options.stepPhaseBucket,
    steps: options.buildWizard.steps,
    taskAttachmentsModalDocId: options.state.taskAttachmentsModalDocId,
    topbarSearchDocumentResults: options.state.topbarSearchDocumentResults,
    topbarSearchQuery: options.state.topbarSearchQuery,
  });

  useBuildWizardPageEffects({
    PHASE_PROGRESS_ORDER: options.PHASE_PROGRESS_ORDER,
    buildWizard: options.buildWizard,
    documentManagerData,
    lotSizeSqftToDisplayInput: options.lotSizeSqftToDisplayInput,
    normalizeContactType: options.normalizeContactType,
    onToast: options.onToast,
    parseTaskMetaFromReceiptNotes: options.parseTaskMetaFromReceiptNotes,
    state: options.state,
    stepPhaseBucket: options.stepPhaseBucket,
    stepWorkspaceMeta,
    taskUsesManualDateOverride: options.taskUsesManualDateOverride,
    workspaceData,
    workspaceSelectionData,
  });

  return {
    activeTabTree,
    confirmationActions,
    documentManagerData,
    documentPreview,
    dropdownData,
    overviewData,
    phaseRangeActions,
    stepEditModalDependencyIds,
    stepEditModalDependencyOptions,
    stepWorkspaceMeta,
    workspaceData,
    workspaceSelectionData,
  };
}
