import React from 'react';

import { ApiClient } from '../ApiClient';
import {
  IBuildWizardDocument,
  IBuildWizardFindPurchaseOptionsResponse,
  IBuildWizardStep,
} from '../../types/buildWizard';
import {
  BuildWizardToast,
  DeleteDocumentResponse,
  PurchaseOptionsResult,
  ReplaceDocumentResponse,
  UpdateDocumentResponse,
} from './buildWizardInternalTypes';
import {
  normalizeBuildWizardStep,
  normalizeBuildWizardSteps,
  sanitizeBuildWizardStepTitle,
} from './buildWizardSanitizers';

interface UseBuildWizardDocumentActionsArgs {
  onToast?: (t: BuildWizardToast) => void;
  projectId: number;
  refreshCurrentProject: () => Promise<void>;
  setSteps: React.Dispatch<React.SetStateAction<IBuildWizardStep[]>>;
  setDocuments: React.Dispatch<React.SetStateAction<IBuildWizardDocument[]>>;
}

export function useBuildWizardDocumentActions(args: UseBuildWizardDocumentActionsArgs) {
  const { onToast, projectId, refreshCurrentProject, setSteps, setDocuments } = args;

  const applyStepUpdatesFromDocumentResponse = React.useCallback((res: { step?: IBuildWizardStep | null; steps?: IBuildWizardStep[] } | null | undefined) => {
    if (Array.isArray(res?.steps) && res.steps.length > 0) {
      const normalized = normalizeBuildWizardSteps(res.steps);
      setSteps((prev) => {
        const map = new Map<number, IBuildWizardStep>();
        prev.forEach((step) => map.set(step.id, step));
        normalized.forEach((step) => map.set(step.id, step));
        return Array.from(map.values()).sort((a, b) => (a.step_order !== b.step_order ? a.step_order - b.step_order : a.id - b.id));
      });
      return;
    }
    if (res?.step) {
      const normalized = normalizeBuildWizardStep(res.step);
      setSteps((prev) => prev.map((step) => (step.id === normalized.id ? normalized : step)));
    }
  }, [setSteps]);

  const uploadDocument = React.useCallback(async (
    kind: string,
    file: File,
    stepId?: number,
    caption?: string,
    phaseKey?: string,
    receiptMeta?: {
      receipt_amount?: number | null;
      receipt_title?: string | null;
      receipt_vendor?: string | null;
      receipt_date?: string | null;
      receipt_notes?: string | null;
    },
    options?: {
      receipt_parent_document_id?: number | null;
    },
  ) => {
    if (!file || projectId <= 0) return;
    const formData = new FormData();
    formData.append('project_id', String(projectId));
    formData.append('kind', kind);
    formData.append('file', file);
    if (stepId && stepId > 0) formData.append('step_id', String(stepId));
    if (phaseKey && String(phaseKey).trim() !== '') formData.append('phase_key', String(phaseKey).trim());
    if (caption && String(caption).trim() !== '') formData.append('caption', String(caption).trim());
    if (receiptMeta) {
      if (receiptMeta.receipt_amount !== null && receiptMeta.receipt_amount !== undefined) formData.append('receipt_amount', String(receiptMeta.receipt_amount));
      if (String(receiptMeta.receipt_title || '').trim() !== '') formData.append('receipt_title', String(receiptMeta.receipt_title || '').trim());
      if (String(receiptMeta.receipt_vendor || '').trim() !== '') formData.append('receipt_vendor', String(receiptMeta.receipt_vendor || '').trim());
      if (String(receiptMeta.receipt_date || '').trim() !== '') formData.append('receipt_date', String(receiptMeta.receipt_date || '').trim());
      if (String(receiptMeta.receipt_notes || '').trim() !== '') formData.append('receipt_notes', String(receiptMeta.receipt_notes || '').trim());
    }
    if (options && Number(options.receipt_parent_document_id || 0) > 0) {
      formData.append('receipt_parent_document_id', String(Number(options.receipt_parent_document_id)));
    }
    try {
      const res = await ApiClient.postFormData<UpdateDocumentResponse>('/api/build_wizard.php?action=upload_document', formData);
      if (res?.document) setDocuments((prev) => [res.document, ...prev]);
      applyStepUpdatesFromDocumentResponse(res);
      onToast?.({ tone: 'success', message: 'Document uploaded.' });
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Upload failed' });
    }
  }, [applyStepUpdatesFromDocumentResponse, onToast, projectId, setDocuments]);

  const createStepReceipt = React.useCallback(async (payload: {
    project_id: number;
    step_id: number;
    receipt_title?: string | null;
    receipt_vendor?: string | null;
    receipt_date?: string | null;
    receipt_amount?: number | null;
    receipt_notes?: string | null;
    caption?: string | null;
  }) => {
    if (Number(payload.project_id || 0) <= 0 || Number(payload.step_id || 0) <= 0) return null;
    try {
      const res = await ApiClient.post<UpdateDocumentResponse>('/api/build_wizard.php?action=create_step_receipt', payload);
      if (res?.document) setDocuments((prev) => [res.document, ...prev]);
      applyStepUpdatesFromDocumentResponse(res);
      onToast?.({ tone: 'success', message: 'Task added.' });
      return res?.document || null;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to add task' });
      return null;
    }
  }, [applyStepUpdatesFromDocumentResponse, onToast, setDocuments]);

  const deleteDocument = React.useCallback(async (documentId: number) => {
    if (documentId <= 0) return false;
    try {
      const res = await ApiClient.post<DeleteDocumentResponse>('/api/build_wizard.php?action=delete_document', { document_id: documentId });
      if (Array.isArray(res?.documents)) setDocuments(res.documents);
      else setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      applyStepUpdatesFromDocumentResponse(res);
      onToast?.({ tone: 'success', message: 'Document deleted.' });
      return true;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to delete document' });
      await refreshCurrentProject();
      return false;
    }
  }, [applyStepUpdatesFromDocumentResponse, onToast, refreshCurrentProject, setDocuments]);

  const replaceDocument = React.useCallback(async (documentId: number, file: File) => {
    if (documentId <= 0 || !file) return null;
    const formData = new FormData();
    formData.append('document_id', String(documentId));
    formData.append('file', file);
    try {
      const res = await ApiClient.postFormData<ReplaceDocumentResponse>('/api/build_wizard.php?action=replace_document', formData);
      if (res?.document) setDocuments((prev) => prev.map((doc) => (doc.id === documentId ? res.document : doc)));
      onToast?.({ tone: 'success', message: 'Document file replaced.' });
      return res?.document || null;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to replace document file' });
      await refreshCurrentProject();
      return null;
    }
  }, [onToast, refreshCurrentProject, setDocuments]);

  const updateDocument = React.useCallback(async (documentId: number, patch: {
    kind?: string;
    caption?: string | null;
    step_id?: number | null;
    receipt_parent_document_id?: number | null;
    receipt_amount?: number | null;
    receipt_title?: string | null;
    receipt_vendor?: string | null;
    receipt_date?: string | null;
    receipt_notes?: string | null;
  }) => {
    if (documentId <= 0) return null;
    const body: Record<string, unknown> = { document_id: documentId };
    if (Object.prototype.hasOwnProperty.call(patch, 'kind')) body.kind = String(patch.kind || '').trim();
    if (Object.prototype.hasOwnProperty.call(patch, 'caption')) body.caption = patch.caption;
    if (Object.prototype.hasOwnProperty.call(patch, 'step_id')) body.step_id = patch.step_id;
    if (Object.prototype.hasOwnProperty.call(patch, 'receipt_parent_document_id')) body.receipt_parent_document_id = patch.receipt_parent_document_id;
    if (Object.prototype.hasOwnProperty.call(patch, 'receipt_amount')) body.receipt_amount = patch.receipt_amount;
    if (Object.prototype.hasOwnProperty.call(patch, 'receipt_title')) body.receipt_title = patch.receipt_title;
    if (Object.prototype.hasOwnProperty.call(patch, 'receipt_vendor')) body.receipt_vendor = patch.receipt_vendor;
    if (Object.prototype.hasOwnProperty.call(patch, 'receipt_date')) body.receipt_date = patch.receipt_date;
    if (Object.prototype.hasOwnProperty.call(patch, 'receipt_notes')) body.receipt_notes = patch.receipt_notes;
    if (Object.keys(body).length <= 1) return null;
    try {
      const res = await ApiClient.post<UpdateDocumentResponse>('/api/build_wizard.php?action=update_document', body);
      if (Array.isArray(res?.documents) && res.documents.length > 0) {
        const replacements = new Map<number, IBuildWizardDocument>();
        res.documents.forEach((doc) => replacements.set(doc.id, doc));
        setDocuments((prev) => prev.map((doc) => replacements.get(doc.id) || doc));
      } else if (res?.document) {
        setDocuments((prev) => prev.map((doc) => (doc.id === documentId ? res.document : doc)));
      }
      applyStepUpdatesFromDocumentResponse(res);
      onToast?.({ tone: 'success', message: 'Document updated.' });
      return res?.document || null;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to update document' });
      await refreshCurrentProject();
      return null;
    }
  }, [applyStepUpdatesFromDocumentResponse, onToast, refreshCurrentProject, setDocuments]);

  const findPurchaseOptions = React.useCallback(async (stepId: number, productUrl?: string): Promise<PurchaseOptionsResult | null> => {
    if (stepId <= 0) return null;
    try {
      const res = await ApiClient.post<IBuildWizardFindPurchaseOptionsResponse>('/api/build_wizard.php?action=find_purchase_options', {
        step_id: stepId,
        product_url: (productUrl || '').trim() || undefined,
      });
      const nextStep = res?.step ? normalizeBuildWizardStep(res.step) : null;
      if (nextStep) setSteps((prev) => prev.map((s) => (s.id === stepId ? nextStep : s)));
      const nextOptions = Array.isArray(res?.options)
        ? res.options.map((opt) => ({ ...opt, title: sanitizeBuildWizardStepTitle(opt?.title || '', 'purchase') }))
        : [];
      return { options: nextOptions, step: nextStep };
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to find purchase options' });
      return null;
    }
  }, [onToast, setSteps]);

  return {
    uploadDocument,
    createStepReceipt,
    deleteDocument,
    replaceDocument,
    updateDocument,
    findPurchaseOptions,
  };
}
