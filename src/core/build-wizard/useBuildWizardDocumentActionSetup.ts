import { useBuildWizardDocumentDraftActions } from './useBuildWizardDocumentDraftActions';
import { useBuildWizardDocumentStepData } from './useBuildWizardDocumentStepData';
import { useBuildWizardReceiptActions } from './useBuildWizardReceiptActions';

export function useBuildWizardDocumentActionSetup(options: any) {
  const documentStepData = useBuildWizardDocumentStepData({
    contacts: options.contacts,
    documentSavingId: options.documentSavingId,
    documents: options.documents,
    projectId: options.projectId,
    resolvePhaseDateRange: options.resolvePhaseDateRange,
    savePhaseDateRange: options.savePhaseDateRange,
    setDocumentSavingId: options.setDocumentSavingId,
    stepPhaseBucket: options.stepPhaseBucket,
    updateDocument: options.updateDocument,
  });

  const documentDraftActions = useBuildWizardDocumentDraftActions({
    attachExistingDocByReceiptId: options.attachExistingDocByReceiptId,
    attachExistingDocByStepId: options.attachExistingDocByStepId,
    buildDocumentDraftDeps: options.buildDocumentDraftDeps,
    documents: options.documents,
    moveTaskModalDoc: options.moveTaskModalDoc,
    moveTaskModalTargetStepId: options.moveTaskModalTargetStepId,
    onSaveDocument: documentStepData.onSaveDocument,
    onToast: options.onToast,
    setAttachExistingDocByReceiptId: options.setAttachExistingDocByReceiptId,
    setAttachExistingDocByStepId: options.setAttachExistingDocByStepId,
    setAttachExistingDocFilterByReceiptId: options.setAttachExistingDocFilterByReceiptId,
    setDocumentDrafts: options.setDocumentDrafts,
    setMoveTaskModalDocId: options.setMoveTaskModalDocId,
    setMoveTaskModalTargetStepId: options.setMoveTaskModalTargetStepId,
    setPendingScrollReceiptId: options.setPendingScrollReceiptId,
    setTaskAttachmentsModalDocId: options.setTaskAttachmentsModalDocId,
    stepByIdMap: options.stepByIdMap,
    uploadDocument: options.uploadDocument,
  });

  const receiptActions = useBuildWizardReceiptActions({
    createStepReceipt: options.createStepReceipt,
    documents: options.documents,
    editingReceiptDocumentIdByStep: options.editingReceiptDocumentIdByStep,
    inlineReceiptDraftByDocId: options.inlineReceiptDraftByDocId,
    onSaveDocument: documentStepData.onSaveDocument,
    parseTaskMetaFromReceiptNotes: options.parseTaskMetaFromReceiptNotes,
    pendingScrollReceiptId: options.pendingScrollReceiptId,
    projectId: options.projectId,
    receiptAttachmentDraftByStep: options.receiptAttachmentDraftByStep,
    receiptDraftByStep: options.receiptDraftByStep,
    receiptEditorRefByStepId: options.receiptEditorRefByStepId,
    receiptRowRefByDocId: options.receiptRowRefByDocId,
    setEditingReceiptDocumentIdByStep: options.setEditingReceiptDocumentIdByStep,
    setInlineEditingReceiptFieldByDocId: options.setInlineEditingReceiptFieldByDocId,
    setInlineReceiptDraftByDocId: options.setInlineReceiptDraftByDocId,
    setPendingScrollReceiptId: options.setPendingScrollReceiptId,
    setReceiptAttachmentDraftByStep: options.setReceiptAttachmentDraftByStep,
    setReceiptDraftByStep: options.setReceiptDraftByStep,
    setReceiptEditorOpenByStep: options.setReceiptEditorOpenByStep,
    taskUsesManualDateOverride: options.taskUsesManualDateOverride,
    uploadDocument: options.uploadDocument,
  });

  return {
    ...documentStepData,
    ...documentDraftActions,
    ...receiptActions,
  };
}
