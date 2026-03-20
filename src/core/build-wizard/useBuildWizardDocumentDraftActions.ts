import React from 'react';

import { toNumberOrNull, toStringOrNull } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
import { BuildWizardTaskMeta } from './buildWizardPageRenderTypes';
import { taskUsesManualDateOverride as resolveTaskManualDateOverride } from './buildWizardTaskMetaUtils';

type DocumentDraftState = {
  kind: string;
  caption: string;
  step_id: number;
  receipt_amount: string;
  receipt_title: string;
  receipt_vendor: string;
  receipt_date: string;
  receipt_notes: string;
};

interface UseBuildWizardDocumentDraftActionsOptions {
  attachExistingDocByReceiptId: Record<number, string>;
  attachExistingDocByStepId: Record<number, string>;
  buildDocumentDraftDeps: {
    documentDrafts: Record<number, DocumentDraftState>;
    parseTaskMetaFromReceiptNotes: (notes: string) => { taskMeta: BuildWizardTaskMeta };
    setTaskDateOverrideInReceiptNotes: (notes: string | null | undefined, taskDate: string | null | undefined) => string;
    taskUsesManualDateOverride?: (doc: IBuildWizardDocument, taskMeta: BuildWizardTaskMeta) => boolean;
  };
  documents: IBuildWizardDocument[];
  moveTaskModalDoc: IBuildWizardDocument | null;
  moveTaskModalTargetStepId: number;
  onSaveDocument: (documentId: number, patch: {
    kind?: string;
    caption?: string | null;
    step_id?: number | null;
    receipt_parent_document_id?: number | null;
    receipt_amount?: number | null;
    receipt_title?: string | null;
    receipt_vendor?: string | null;
    receipt_date?: string | null;
    receipt_notes?: string | null;
  }) => Promise<IBuildWizardDocument | null | undefined>;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  setAttachExistingDocByReceiptId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setAttachExistingDocByStepId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setAttachExistingDocFilterByReceiptId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setDocumentDrafts: React.Dispatch<React.SetStateAction<Record<number, DocumentDraftState>>>;
  setMoveTaskModalDocId: React.Dispatch<React.SetStateAction<number>>;
  setMoveTaskModalTargetStepId: React.Dispatch<React.SetStateAction<number>>;
  setPendingScrollReceiptId: React.Dispatch<React.SetStateAction<number>>;
  setTaskAttachmentsModalDocId: React.Dispatch<React.SetStateAction<number>>;
  stepByIdMap: Map<number, IBuildWizardStep>;
  uploadDocument: (kind: string, file: File, stepId?: number, caption?: string, phaseKey?: string, arg6?: undefined, options?: { receipt_parent_document_id?: number }) => Promise<unknown>;
}

export function useBuildWizardDocumentDraftActions({
  attachExistingDocByReceiptId,
  attachExistingDocByStepId,
  buildDocumentDraftDeps,
  documents,
  moveTaskModalDoc,
  moveTaskModalTargetStepId,
  onSaveDocument,
  onToast,
  setAttachExistingDocByReceiptId,
  setAttachExistingDocByStepId,
  setAttachExistingDocFilterByReceiptId,
  setDocumentDrafts,
  setMoveTaskModalDocId,
  setMoveTaskModalTargetStepId,
  setPendingScrollReceiptId,
  setTaskAttachmentsModalDocId,
  stepByIdMap,
  uploadDocument,
}: UseBuildWizardDocumentDraftActionsOptions) {
  const updateDocumentDraft = React.useCallback((documentId: number, patch: Partial<DocumentDraftState>) => {
    setDocumentDrafts((prev) => ({
      ...prev,
      [documentId]: {
        kind: patch.kind ?? (prev[documentId]?.kind || 'other'),
        caption: patch.caption ?? (prev[documentId]?.caption || ''),
        step_id: patch.step_id ?? (prev[documentId]?.step_id || 0),
        receipt_amount: patch.receipt_amount ?? (prev[documentId]?.receipt_amount || ''),
        receipt_title: patch.receipt_title ?? (prev[documentId]?.receipt_title || ''),
        receipt_vendor: patch.receipt_vendor ?? (prev[documentId]?.receipt_vendor || ''),
        receipt_date: patch.receipt_date ?? (prev[documentId]?.receipt_date || ''),
        receipt_notes: patch.receipt_notes ?? (prev[documentId]?.receipt_notes || ''),
      },
    }));
  }, [setDocumentDrafts]);

  const buildDocumentDraft = React.useCallback((doc: IBuildWizardDocument): DocumentDraftState => {
    const { documentDrafts, parseTaskMetaFromReceiptNotes, taskUsesManualDateOverride } = buildDocumentDraftDeps;
    const usesManualDateOverride = taskUsesManualDateOverride ?? resolveTaskManualDateOverride;
    return documentDrafts[doc.id] || {
      kind: doc.kind || 'other',
      caption: doc.caption || '',
      step_id: Number(doc.step_id || 0),
      receipt_amount: doc.receipt_amount !== null && Number.isFinite(Number(doc.receipt_amount)) ? String(doc.receipt_amount) : '',
      receipt_title: doc.receipt_title || '',
      receipt_vendor: doc.receipt_vendor || '',
      receipt_date: usesManualDateOverride(doc, parseTaskMetaFromReceiptNotes(doc.receipt_notes || '').taskMeta) ? (doc.receipt_date || '') : '',
      receipt_notes: doc.receipt_notes || '',
    };
  }, [buildDocumentDraftDeps]);

  const onSaveDocumentDraft = React.useCallback(async (doc: IBuildWizardDocument) => {
    const draft = buildDocumentDraft(doc);
    await onSaveDocument(doc.id, {
      kind: draft.kind,
      caption: draft.caption.trim() || null,
      step_id: draft.step_id > 0 ? draft.step_id : null,
      receipt_amount: draft.kind === 'receipt' ? toNumberOrNull(draft.receipt_amount) : null,
      receipt_title: draft.kind === 'receipt' ? toStringOrNull(draft.receipt_title) : null,
      receipt_vendor: draft.kind === 'receipt' ? toStringOrNull(draft.receipt_vendor) : null,
      receipt_date: draft.kind === 'receipt' ? toStringOrNull(draft.receipt_date) : null,
      receipt_notes: draft.kind === 'receipt' ? toStringOrNull(buildDocumentDraftDeps.setTaskDateOverrideInReceiptNotes(draft.receipt_notes, draft.receipt_date)) : null,
    });
  }, [buildDocumentDraft, buildDocumentDraftDeps, onSaveDocument]);

  const onAttachExistingDocumentToReceipt = React.useCallback(async (step: IBuildWizardStep, receiptDoc: IBuildWizardDocument) => {
    const selectedDocumentId = Number(attachExistingDocByReceiptId[receiptDoc.id] || 0);
    if (selectedDocumentId <= 0) return;
    if (selectedDocumentId === receiptDoc.id) {
      onToast?.({ tone: 'warning', message: 'A task cannot attach itself.' });
      return;
    }
    const selectedDocument = documents.find((doc) => doc.id === selectedDocumentId);
    if (!selectedDocument) {
      onToast?.({ tone: 'warning', message: 'Selected document is no longer available. Refresh and try again.' });
      return;
    }
    const alreadyAttachedToThisTask = String(selectedDocument.kind || '').trim() === 'receipt_attachment' && Number(selectedDocument.receipt_parent_document_id || 0) === receiptDoc.id;
    if (alreadyAttachedToThisTask) {
      onToast?.({ tone: 'info', message: 'Document is already attached to this task.' });
      return;
    }
    await onSaveDocument(selectedDocumentId, { kind: 'receipt_attachment', step_id: step.id, receipt_parent_document_id: receiptDoc.id });
    setAttachExistingDocByReceiptId((prev) => ({ ...prev, [receiptDoc.id]: '' }));
  }, [attachExistingDocByReceiptId, documents, onSaveDocument, onToast, setAttachExistingDocByReceiptId]);

  const openMoveTaskModal = React.useCallback((receiptDoc: IBuildWizardDocument) => {
    setMoveTaskModalDocId(receiptDoc.id);
    setMoveTaskModalTargetStepId(0);
  }, [setMoveTaskModalDocId, setMoveTaskModalTargetStepId]);

  const openTaskAttachmentsModal = React.useCallback((receiptDoc: IBuildWizardDocument) => {
    setTaskAttachmentsModalDocId(receiptDoc.id);
    setAttachExistingDocByReceiptId((prev) => ({ ...prev, [receiptDoc.id]: '' }));
    setAttachExistingDocFilterByReceiptId((prev) => ({ ...prev, [receiptDoc.id]: '' }));
  }, [setAttachExistingDocByReceiptId, setAttachExistingDocFilterByReceiptId, setTaskAttachmentsModalDocId]);

  const onMoveReceiptToStep = React.useCallback(async () => {
    if (!moveTaskModalDoc) return;
    const currentStepId = Number(moveTaskModalDoc.step_id || 0);
    const targetStepId = Number(moveTaskModalTargetStepId || 0);
    if (targetStepId <= 0 || targetStepId === currentStepId) return;
    const targetStep = stepByIdMap.get(targetStepId) || null;
    if (!targetStep) {
      onToast?.({ tone: 'warning', message: 'That destination step is no longer available. Refresh and try again.' });
      return;
    }
    const movedDocument = await onSaveDocument(moveTaskModalDoc.id, { step_id: targetStepId });
    if (!movedDocument) return;
    setMoveTaskModalDocId(0);
    setMoveTaskModalTargetStepId(0);
    setPendingScrollReceiptId(moveTaskModalDoc.id);
  }, [moveTaskModalDoc, moveTaskModalTargetStepId, onSaveDocument, onToast, setMoveTaskModalDocId, setMoveTaskModalTargetStepId, setPendingScrollReceiptId, stepByIdMap]);

  const onUploadReceiptAttachments = React.useCallback((receiptDoc: IBuildWizardDocument, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const stepId = Number(receiptDoc.step_id || 0);
    Array.from(files).forEach((file) => {
      void uploadDocument('receipt_attachment', file, stepId > 0 ? stepId : undefined, `Attachment: ${receiptDoc.receipt_title || receiptDoc.original_name}`, receiptDoc.step_phase_key || undefined, undefined, { receipt_parent_document_id: receiptDoc.id });
    });
  }, [uploadDocument]);

  const onAttachExistingDocumentToStep = React.useCallback(async (step: IBuildWizardStep) => {
    const selectedDocumentId = Number(attachExistingDocByStepId[step.id] || 0);
    if (selectedDocumentId <= 0) return;
    const selectedDocument = documents.find((doc) => doc.id === selectedDocumentId);
    if (!selectedDocument) {
      onToast?.({ tone: 'warning', message: 'Selected document is no longer available. Refresh and try again.' });
      return;
    }
    if (Number(selectedDocument.step_id || 0) === step.id) {
      onToast?.({ tone: 'info', message: 'Document is already linked to this step.' });
      return;
    }
    await onSaveDocument(selectedDocumentId, { step_id: step.id });
    setAttachExistingDocByStepId((prev) => ({ ...prev, [step.id]: '' }));
  }, [attachExistingDocByStepId, documents, onSaveDocument, onToast, setAttachExistingDocByStepId]);

  return {
    buildDocumentDraft,
    onAttachExistingDocumentToReceipt,
    onAttachExistingDocumentToStep,
    onMoveReceiptToStep,
    onSaveDocumentDraft,
    onUploadReceiptAttachments,
    openMoveTaskModal,
    openTaskAttachmentsModal,
    updateDocumentDraft,
  };
}
