import React from 'react';

import { BuildWizardWorkspaceModals } from './buildWizardWorkspaceModals';

export function useBuildWizardWorkspaceModalPropsBuilder(options: any): React.ComponentProps<typeof BuildWizardWorkspaceModals> {
  return React.useMemo(() => ({
    aiToolsProps: {
      aiBusy: options.aiBusy,
      aiPayloadJson: options.aiPayloadJson || '',
      aiPromptText: options.aiPromptText || '',
      deskAutoAssignBusy: options.deskAutoAssignBusy,
      onAutoAssignDeskStepsToTimeline: options.onAutoAssignDeskStepsToTimeline,
      onClose: () => options.setAiToolsOpen(false),
      onCompleteWithAi: options.onCompleteWithAi,
      open: options.aiToolsOpen,
      packageForAi: options.packageForAi,
      sendToAiAndIngest: () => options.generateStepsFromAi('optimize'),
    },
    documentUploadProps: {
      busy: options.documentUploadBusy,
      docKind: options.docKind,
      docKindOptions: options.docKindOptions,
      docPhaseKey: options.docPhaseKey,
      docStepId: options.docStepId,
      file: options.documentUploadFile,
      onClose: () => options.setDocumentUploadModalOpen(false),
      onFileChange: options.setDocumentUploadFile,
      open: options.documentUploadModalOpen,
      phaseOptions: options.phaseOptions,
      selectableDocSteps: options.selectableDocSteps,
      setDocKind: options.setDocKind,
      setDocPhaseKey: options.setDocPhaseKey,
      setDocStepId: options.setDocStepId,
      uploadDocument: async (...args: any[]) => {
        options.setDocumentUploadBusy(true);
        try {
          return await options.uploadDocument(...args);
        } finally {
          options.setDocumentUploadBusy(false);
        }
      },
    },
    lightboxProps: {
      closeLightbox: options.closeLightbox,
      lightboxDoc: options.lightboxDoc,
      lightboxSpreadsheetSheetIndex: options.lightboxSpreadsheetSheetIndex,
      lightboxSupportsZoom: options.lightboxSupportsZoom,
      lightboxZoom: options.lightboxZoom,
      lightboxZoomMax: options.LIGHTBOX_ZOOM_MAX,
      lightboxZoomMin: options.LIGHTBOX_ZOOM_MIN,
      lightboxZoomStep: options.LIGHTBOX_ZOOM_STEP,
      onLightboxWheelZoom: options.onLightboxWheelZoom,
      onEditTaskFromPreview: (() => {
        const previewDoc = options.lightboxDoc?.document;
        if (!previewDoc || String(previewDoc.kind || '').trim() !== 'receipt') {
          return undefined;
        }
        const stepId = Number(previewDoc.step_id || 0);
        const step = stepId > 0 ? (options.stepById.get(stepId) || null) : null;
        if (!step || typeof options.onStartEditReceiptForStep !== 'function') {
          return undefined;
        }
        return () => {
          options.closeLightbox();
          options.onStartEditReceiptForStep(step, previewDoc);
        };
      })(),
      open: Boolean(options.lightboxDoc),
      resetLightboxZoom: options.resetLightboxZoom,
      setLightboxSpreadsheetSheetIndex: options.setLightboxSpreadsheetSheetIndex,
      zoomLightboxBy: options.zoomLightboxBy,
    },
    projectOverviewProps: {
      formatCurrency: options.formatCurrency,
      onClose: () => options.setProjectOverviewOpen(false),
      open: options.projectOverviewOpen,
      projectOverviewRange: options.projectOverviewRange,
      projectOverviewSections: options.projectOverviewSections,
      projectOverviewTotals: options.projectOverviewTotals,
      steps: options.steps,
    },
    recoveryReportProps: {
      fetchSingletreeRecoveryStatus: options.fetchSingletreeRecoveryStatus,
      onClose: () => options.setRecoveryReportOpen(false),
      onToast: options.onToast,
      open: options.recoveryReportOpen,
      recoveryJobId: options.recoveryJobId,
      recoveryPolling: options.recoveryPolling,
      recoveryReportJson: options.recoveryReportJson,
      recoveryStagedCount: options.recoveryStagedCount,
      recoveryStagedRoot: options.recoveryStagedRoot,
      recoveryStatus: options.recoveryStatus,
      setRecoveryJobId: options.setRecoveryJobId,
      setRecoveryPolling: options.setRecoveryPolling,
      setRecoveryReportJson: options.setRecoveryReportJson,
      setRecoveryStatus: options.setRecoveryStatus,
    },
    stepEditProps: {
      activeTabStepNumbers: options.activeTabStepNumbers,
      closeStepEditModal: options.closeStepEditModal,
      dependencyCandidateByStepId: options.dependencyCandidateByStepId,
      setDependencyCandidateByStepId: options.setDependencyCandidateByStepId,
      open: Boolean(options.stepEditModalStep && options.stepEditModalDraft),
      saveStepEditModal: options.saveStepEditModal,
      saving: options.stepEditSaving,
      step: options.stepEditModalStep,
      stepById: options.stepById,
      stepDraft: options.stepEditModalDraft,
      stepEditModalDependencyIds: options.stepEditModalDependencyIds,
      stepEditModalDependencyOptions: options.stepEditModalDependencyOptions,
      updateStepDraft: options.updateStepDraft,
    },
    stepInfoProps: {
      activeTabStepNumbers: options.activeTabStepNumbers,
      formatAuditValue: options.formatAuditValue,
      formatDate: options.formatDate,
      noteEditedAtLabel: options.noteEditedAtLabel,
      onClose: () => options.setStepInfoModalStepId(0),
      open: Boolean(options.stepInfoModalStep),
      step: options.stepInfoModalStep,
    },
    workspaceActionModalProps: {
      activeTabStepNumbers: options.activeTabStepNumbers,
      attachExistingDocByReceiptId: options.attachExistingDocByReceiptId,
      attachExistingDocFilterByReceiptId: options.attachExistingDocFilterByReceiptId,
      confirmState: options.confirmState,
      documentSavingId: options.documentSavingId,
      documents: options.documents,
      moveStepModalStep: options.moveStepModalStep,
      moveStepPhaseOrderPreviewByTab: options.moveStepPhaseOrderPreviewByTab,
      moveStepModalTargetTab: options.moveStepModalTargetTab,
      moveStepPhaseTabOptions: options.moveStepPhaseTabOptions,
      moveTaskModalDoc: options.moveTaskModalDoc,
      moveTaskModalTargetStepId: options.moveTaskModalTargetStepId,
      moveTaskStepOptions: options.moveTaskStepOptions,
      movingStep: options.movingStep,
      onAttachExistingDocumentToReceipt: options.onAttachExistingDocumentToReceipt,
      onCloseMoveStep: () => options.setMoveStepModalStepId(0),
      onCloseMoveTask: () => options.setMoveTaskModalDocId(0),
      onCloseTaskAttachments: () => options.setTaskAttachmentsModalDocId(0),
      onConfirm: options.closeConfirmation,
      onMoveReceiptToStep: options.onMoveReceiptToStep,
      onMoveStepFromModal: options.onMoveStepFromModal,
      onOpenDocumentPreview: options.openDocumentPreview,
      onUploadReceiptAttachments: options.onUploadReceiptAttachments,
      setAttachExistingDocByReceiptId: options.setAttachExistingDocByReceiptId,
      setAttachExistingDocFilterByReceiptId: options.setAttachExistingDocFilterByReceiptId,
      setMoveStepModalTargetTab: options.setMoveStepModalTargetTab,
      setMoveTaskModalTargetStepId: options.setMoveTaskModalTargetStepId,
      taskAttachmentsModalAttachableDocuments: options.taskAttachmentsModalAttachableDocuments,
      taskAttachmentsModalDoc: options.taskAttachmentsModalDoc,
      taskAttachmentsModalStep: options.taskAttachmentsModalStep,
    },
  }), [options]);
}
