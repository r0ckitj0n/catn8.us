import React from 'react';

import { toNumberOrNull, toStringOrNull } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
import { BuildWizardTaskMeta, BuildWizardTaskType, InlineReceiptField } from './buildWizardPageRenderTypes';
import { composeReceiptNotesWithTaskMeta, defaultTaskMeta, taskUsesManualDateOverride as resolveTaskManualDateOverride } from './buildWizardTaskMetaUtils';

type InlineReceiptDraft = {
  vendor: string;
  date: string;
  amount: string;
  taskType: BuildWizardTaskType;
  plainNotes: string;
  taskMeta: BuildWizardTaskMeta;
};

type ReceiptDraftState = {
  receipt_title: string;
  receipt_vendor: string;
  receipt_date: string;
  receipt_amount: string;
  receipt_notes: string;
  task_meta: BuildWizardTaskMeta;
};

interface UseBuildWizardReceiptActionsOptions {
  createStepReceipt: (payload: Record<string, unknown>) => Promise<{ id?: number } | null | undefined>;
  documents: IBuildWizardDocument[];
  editingReceiptDocumentIdByStep: Record<number, number>;
  inlineReceiptDraftByDocId: Record<number, InlineReceiptDraft>;
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
  parseTaskMetaFromReceiptNotes: (notes: string) => { plainNotes: string; taskMeta: BuildWizardTaskMeta };
  pendingScrollReceiptId: number;
  projectId: number;
  receiptAttachmentDraftByStep: Record<number, File[]>;
  receiptDraftByStep: Record<number, ReceiptDraftState>;
  receiptEditorRefByStepId: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  receiptRowRefByDocId: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  setEditingReceiptDocumentIdByStep: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  setInlineEditingReceiptFieldByDocId: React.Dispatch<React.SetStateAction<Record<number, InlineReceiptField | null>>>;
  setInlineReceiptDraftByDocId: React.Dispatch<React.SetStateAction<Record<number, InlineReceiptDraft>>>;
  setPendingScrollReceiptId: React.Dispatch<React.SetStateAction<number>>;
  setReceiptAttachmentDraftByStep: React.Dispatch<React.SetStateAction<Record<number, File[]>>>;
  setReceiptDraftByStep: React.Dispatch<React.SetStateAction<Record<number, ReceiptDraftState>>>;
  setReceiptEditorOpenByStep: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  taskUsesManualDateOverride?: (doc: IBuildWizardDocument, taskMeta: BuildWizardTaskMeta) => boolean;
  uploadDocument: (kind: string, file: File, stepId?: number, caption?: string, phaseKey?: string, arg6?: undefined, options?: { receipt_parent_document_id?: number }) => Promise<unknown>;
}

export function useBuildWizardReceiptActions({
  createStepReceipt,
  documents,
  editingReceiptDocumentIdByStep,
  inlineReceiptDraftByDocId,
  onSaveDocument,
  parseTaskMetaFromReceiptNotes,
  pendingScrollReceiptId,
  projectId,
  receiptAttachmentDraftByStep,
  receiptDraftByStep,
  receiptEditorRefByStepId,
  receiptRowRefByDocId,
  setEditingReceiptDocumentIdByStep,
  setInlineEditingReceiptFieldByDocId,
  setInlineReceiptDraftByDocId,
  setPendingScrollReceiptId,
  setReceiptAttachmentDraftByStep,
  setReceiptDraftByStep,
  setReceiptEditorOpenByStep,
  taskUsesManualDateOverride,
  uploadDocument,
}: UseBuildWizardReceiptActionsOptions) {
  const usesManualDateOverride = taskUsesManualDateOverride ?? resolveTaskManualDateOverride;

  React.useEffect(() => {
    if (pendingScrollReceiptId <= 0) return;
    const rowEl = receiptRowRefByDocId.current[pendingScrollReceiptId];
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setPendingScrollReceiptId(0);
      return;
    }
    const timer = window.setTimeout(() => {
      const delayedEl = receiptRowRefByDocId.current[pendingScrollReceiptId];
      if (delayedEl) delayedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setPendingScrollReceiptId(0);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [documents, pendingScrollReceiptId, receiptRowRefByDocId, setPendingScrollReceiptId]);

  const startInlineReceiptEdit = React.useCallback((doc: IBuildWizardDocument, parsed: { taskMeta: BuildWizardTaskMeta; plainNotes: string }, field: InlineReceiptField) => {
    setInlineReceiptDraftByDocId((prev) => ({
      ...prev,
      [doc.id]: {
        vendor: doc.receipt_vendor || '',
        date: usesManualDateOverride(doc, parsed.taskMeta) ? (doc.receipt_date || '') : '',
        amount: doc.receipt_amount !== null && Number.isFinite(Number(doc.receipt_amount)) ? String(doc.receipt_amount) : '',
        taskType: parsed.taskMeta.task_type,
        plainNotes: parsed.plainNotes || '',
        taskMeta: parsed.taskMeta,
      },
    }));
    setInlineEditingReceiptFieldByDocId((prev) => ({ ...prev, [doc.id]: field }));
  }, [setInlineEditingReceiptFieldByDocId, setInlineReceiptDraftByDocId, usesManualDateOverride]);

  const saveInlineReceiptEdit = React.useCallback(async (doc: IBuildWizardDocument, field: InlineReceiptField, overrides?: Partial<{ vendor: string; date: string; amount: string; taskType: BuildWizardTaskType }>) => {
    const baseDraft = inlineReceiptDraftByDocId[doc.id];
    const draft = baseDraft ? { ...baseDraft, ...(overrides || {}) } : null;
    if (!draft) {
      setInlineEditingReceiptFieldByDocId((prev) => ({ ...prev, [doc.id]: null }));
      return;
    }
    const patch: { receipt_vendor?: string | null; receipt_date?: string | null; receipt_amount?: number | null; receipt_notes?: string | null } = {};
    if (field === 'vendor') patch.receipt_vendor = toStringOrNull(draft.vendor);
    else if (field === 'date') {
      patch.receipt_date = toStringOrNull(draft.date);
      patch.receipt_notes = toStringOrNull(composeReceiptNotesWithTaskMeta({ ...draft.taskMeta, manual_date_override: Boolean(toStringOrNull(draft.date)) }, draft.plainNotes));
    } else if (field === 'amount') patch.receipt_amount = toNumberOrNull(draft.amount);
    else if (field === 'type') patch.receipt_notes = toStringOrNull(composeReceiptNotesWithTaskMeta({ ...draft.taskMeta, task_type: draft.taskType }, draft.plainNotes));
    await onSaveDocument(doc.id, patch);
    setInlineEditingReceiptFieldByDocId((prev) => ({ ...prev, [doc.id]: null }));
  }, [inlineReceiptDraftByDocId, onSaveDocument, setInlineEditingReceiptFieldByDocId]);

  const toggleTaskCompleted = React.useCallback(async (doc: IBuildWizardDocument, parsed: { taskMeta: BuildWizardTaskMeta; plainNotes: string }, completed: boolean) => {
    await onSaveDocument(doc.id, {
      receipt_notes: toStringOrNull(composeReceiptNotesWithTaskMeta({
        ...parsed.taskMeta,
        is_completed: completed,
      }, parsed.plainNotes)),
    });
  }, [onSaveDocument]);

  const onSaveReceiptForStep = React.useCallback(async (step: IBuildWizardStep) => {
    if (projectId <= 0) return;
    const draft = receiptDraftByStep[step.id] || { receipt_title: '', receipt_vendor: '', receipt_date: '', receipt_amount: '', receipt_notes: '', task_meta: defaultTaskMeta((step.step_type || 'construction') as BuildWizardTaskType) };
    const editingReceiptDocumentId = Number(editingReceiptDocumentIdByStep[step.id] || 0);
    const existingReceipt = editingReceiptDocumentId > 0 ? documents.find((doc) => doc.id === editingReceiptDocumentId) : null;
    const shouldScrollBackToReceipt = existingReceipt !== null;
    let receiptId = 0;
    if (existingReceipt) {
      const updated = await onSaveDocument(existingReceipt.id, {
        kind: 'receipt',
        step_id: step.id,
        caption: toStringOrNull(draft.receipt_title || step.title),
        receipt_title: toStringOrNull(draft.receipt_title),
        receipt_vendor: toStringOrNull(draft.receipt_vendor),
        receipt_date: toStringOrNull(draft.receipt_date),
        receipt_amount: toNumberOrNull(draft.receipt_amount),
        receipt_notes: toStringOrNull(composeReceiptNotesWithTaskMeta({ ...draft.task_meta, manual_date_override: Boolean(toStringOrNull(draft.receipt_date)) }, draft.receipt_notes)),
      });
      if (!updated) return;
      receiptId = existingReceipt.id;
    } else {
      const created = await createStepReceipt({
        project_id: projectId,
        step_id: step.id,
        receipt_title: toStringOrNull(draft.receipt_title),
        receipt_vendor: toStringOrNull(draft.receipt_vendor),
        receipt_date: toStringOrNull(draft.receipt_date),
        receipt_amount: toNumberOrNull(draft.receipt_amount),
        receipt_notes: toStringOrNull(composeReceiptNotesWithTaskMeta({ ...draft.task_meta, manual_date_override: Boolean(toStringOrNull(draft.receipt_date)) }, draft.receipt_notes)),
        caption: toStringOrNull(draft.receipt_title || step.title),
      });
      if (!created?.id) return;
      receiptId = created.id;
    }
    const files = receiptAttachmentDraftByStep[step.id] || [];
    for (const file of files) {
      await uploadDocument('receipt_attachment', file, step.id, `Attachment: ${draft.receipt_title || step.title}`, step.phase_key, undefined, { receipt_parent_document_id: receiptId });
    }
    setReceiptDraftByStep((prev) => ({ ...prev, [step.id]: { receipt_title: '', receipt_vendor: '', receipt_date: '', receipt_amount: '', receipt_notes: '', task_meta: defaultTaskMeta((step.step_type || 'construction') as BuildWizardTaskType) } }));
    setReceiptAttachmentDraftByStep((prev) => ({ ...prev, [step.id]: [] }));
    setEditingReceiptDocumentIdByStep((prev) => ({ ...prev, [step.id]: 0 }));
    setReceiptEditorOpenByStep((prev) => ({ ...prev, [step.id]: false }));
    if (shouldScrollBackToReceipt && receiptId > 0) setPendingScrollReceiptId(receiptId);
  }, [createStepReceipt, documents, editingReceiptDocumentIdByStep, onSaveDocument, projectId, receiptAttachmentDraftByStep, receiptDraftByStep, setEditingReceiptDocumentIdByStep, setPendingScrollReceiptId, setReceiptAttachmentDraftByStep, setReceiptDraftByStep, setReceiptEditorOpenByStep, uploadDocument]);

  const autosaveExistingReceiptDraftForStep = React.useCallback(async (step: IBuildWizardStep, patch: { receipt_date?: string | null; receipt_notes?: string | null }) => {
    const editingReceiptDocumentId = Number(editingReceiptDocumentIdByStep[step.id] || 0);
    if (editingReceiptDocumentId <= 0) return;
    await onSaveDocument(editingReceiptDocumentId, patch);
  }, [editingReceiptDocumentIdByStep, onSaveDocument]);

  const onStartEditReceiptForStep = React.useCallback((step: IBuildWizardStep, doc: IBuildWizardDocument) => {
    const parsed = parseTaskMetaFromReceiptNotes(doc.receipt_notes || '');
    setEditingReceiptDocumentIdByStep((prev) => ({ ...prev, [step.id]: doc.id }));
    setReceiptDraftByStep((prev) => ({ ...prev, [step.id]: {
      receipt_title: doc.receipt_title || '',
      receipt_vendor: doc.receipt_vendor || '',
      receipt_date: usesManualDateOverride(doc, parsed.taskMeta) ? (doc.receipt_date || '') : '',
      receipt_amount: doc.receipt_amount !== null && Number.isFinite(Number(doc.receipt_amount)) ? String(doc.receipt_amount) : '',
      receipt_notes: parsed.plainNotes || '',
      task_meta: parsed.taskMeta,
    } }));
    setReceiptAttachmentDraftByStep((prev) => ({ ...prev, [step.id]: [] }));
    setReceiptEditorOpenByStep((prev) => ({ ...prev, [step.id]: true }));
    window.setTimeout(() => {
      const editorEl = receiptEditorRefByStepId.current[step.id];
      if (editorEl) editorEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, [parseTaskMetaFromReceiptNotes, receiptEditorRefByStepId, setEditingReceiptDocumentIdByStep, setReceiptAttachmentDraftByStep, setReceiptDraftByStep, setReceiptEditorOpenByStep, usesManualDateOverride]);

  return {
    autosaveExistingReceiptDraftForStep,
    onSaveReceiptForStep,
    onStartEditReceiptForStep,
    saveInlineReceiptEdit,
    startInlineReceiptEdit,
    toggleTaskCompleted,
  };
}
