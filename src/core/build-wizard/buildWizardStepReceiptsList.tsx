import React from 'react';

import { IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
import { BuildWizardTaskMeta, BuildWizardTaskType, InlineReceiptField } from './buildWizardPageRenderTypes';

type ParsedTask = {
  plainNotes: string;
  taskMeta: BuildWizardTaskMeta;
};

type InlineReceiptDraft = {
  amount: string;
  date: string;
  plainNotes: string;
  taskMeta: BuildWizardTaskMeta;
  taskType: BuildWizardTaskType;
  vendor: string;
};

interface BuildWizardStepReceiptsListProps {
  deletingDocumentId: number;
  formatCurrency: (value: number) => string;
  getTaskEffectiveDate: (doc: IBuildWizardDocument, step: IBuildWizardStep, taskMeta: BuildWizardTaskMeta) => string | null;
  inlineEditingReceiptFieldByDocId: Record<number, InlineReceiptField | null>;
  inlineReceiptDraftByDocId: Record<number, InlineReceiptDraft>;
  onDeleteDocument: (documentId: number, originalName: string) => Promise<void>;
  onOpenDocumentPreview: (document: IBuildWizardDocument) => Promise<void>;
  onStartEditReceiptForStep: (step: IBuildWizardStep, document: IBuildWizardDocument) => void;
  openMoveTaskModal: (document: IBuildWizardDocument) => void;
  openTaskAttachmentsModal: (document: IBuildWizardDocument) => void;
  parseTaskMetaFromReceiptNotes: (notes: string) => ParsedTask;
  receiptRowRefByDocId: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  saveInlineReceiptEdit: (document: IBuildWizardDocument, field: InlineReceiptField, patch?: Partial<InlineReceiptDraft>) => Promise<void>;
  setInlineReceiptDraftByDocId: React.Dispatch<React.SetStateAction<Record<number, InlineReceiptDraft>>>;
  startInlineReceiptEdit: (document: IBuildWizardDocument, parsedTask: ParsedTask, field: InlineReceiptField) => void;
  step: IBuildWizardStep;
  stepReadOnly: boolean;
  stepReceiptAttachmentDocuments: IBuildWizardDocument[];
  stepReceiptDocuments: IBuildWizardDocument[];
  taskUsesManualDateOverride: (document: IBuildWizardDocument, taskMeta: BuildWizardTaskMeta) => boolean;
  taskVendorOptions: string[];
  taskTypeOptions: Array<{ label: string; value: BuildWizardTaskType }>;
}

export function BuildWizardStepReceiptsList({
  deletingDocumentId,
  formatCurrency,
  getTaskEffectiveDate,
  inlineEditingReceiptFieldByDocId,
  inlineReceiptDraftByDocId,
  onDeleteDocument,
  onOpenDocumentPreview,
  onStartEditReceiptForStep,
  openMoveTaskModal,
  openTaskAttachmentsModal,
  parseTaskMetaFromReceiptNotes,
  receiptRowRefByDocId,
  saveInlineReceiptEdit,
  setInlineReceiptDraftByDocId,
  startInlineReceiptEdit,
  step,
  stepReadOnly,
  stepReceiptAttachmentDocuments,
  stepReceiptDocuments,
  taskUsesManualDateOverride,
  taskVendorOptions,
  taskTypeOptions,
}: BuildWizardStepReceiptsListProps) {
  if (stepReceiptDocuments.length === 0) {
    return null;
  }

  return (
    <div className="build-wizard-step-receipt-list">
      {stepReceiptDocuments.map((doc) => {
        const attachments = stepReceiptAttachmentDocuments.filter((attachment) => Number(attachment.receipt_parent_document_id || 0) === doc.id);
        const parsedTask = parseTaskMetaFromReceiptNotes(doc.receipt_notes || '');
        const taskNotes = String(parsedTask.plainNotes || '').trim();
        const taskTypeLabel = taskTypeOptions.find((option) => option.value === parsedTask.taskMeta.task_type)?.label || 'Construction';
        const isQuoteTask = parsedTask.taskMeta.task_type === 'quote';
        const inlineEditingField = inlineEditingReceiptFieldByDocId[doc.id] || null;
        const inlineDraft = inlineReceiptDraftByDocId[doc.id] || {
          vendor: doc.receipt_vendor || '',
          date: taskUsesManualDateOverride(doc, parsedTask.taskMeta) ? (doc.receipt_date || '') : '',
          amount: doc.receipt_amount !== null && Number.isFinite(Number(doc.receipt_amount)) ? String(doc.receipt_amount) : '',
          taskType: parsedTask.taskMeta.task_type,
          plainNotes: parsedTask.plainNotes || '',
          taskMeta: parsedTask.taskMeta,
        };

        return (
          <div
            className="build-wizard-step-receipt-row"
            key={`step-${step.id}-receipt-${doc.id}`}
            ref={(el) => { receiptRowRefByDocId.current[doc.id] = el; }}
          >
            <div className="build-wizard-step-receipt-file">
              <button
                type="button"
                className="build-wizard-step-receipt-link"
                onClick={() => { void onOpenDocumentPreview(doc); }}
                title={doc.original_name}
              >
                {doc.receipt_title?.trim() || doc.caption || doc.original_name}
              </button>
              <span>
                Vendor:{' '}
                {inlineEditingField === 'vendor' ? (
                  <select
                    autoFocus
                    value={inlineDraft.vendor}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setInlineReceiptDraftByDocId((prev) => ({
                        ...prev,
                        [doc.id]: { ...inlineDraft, vendor: nextValue },
                      }));
                      void saveInlineReceiptEdit(doc, 'vendor', { vendor: nextValue });
                    }}
                    onBlur={() => { void saveInlineReceiptEdit(doc, 'vendor'); }}
                  >
                    <option value="">-</option>
                    {taskVendorOptions.map((vendorName) => (
                      <option key={`vendor-opt-${doc.id}-${vendorName}`} value={vendorName}>{vendorName}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    className="build-wizard-inline-edit-trigger"
                    onClick={() => startInlineReceiptEdit(doc, parsedTask, 'vendor')}
                  >
                    {doc.receipt_vendor || '-'}
                  </button>
                )}
                {' '}| Date:{' '}
                {inlineEditingField === 'date' ? (
                  <input
                    type="date"
                    autoFocus
                    value={inlineDraft.date}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setInlineReceiptDraftByDocId((prev) => ({
                        ...prev,
                        [doc.id]: { ...inlineDraft, date: nextValue },
                      }));
                    }}
                    onBlur={() => { void saveInlineReceiptEdit(doc, 'date'); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="build-wizard-inline-edit-trigger"
                    onClick={() => startInlineReceiptEdit(doc, parsedTask, 'date')}
                  >
                    {getTaskEffectiveDate(doc, step, parsedTask.taskMeta) || '-'}
                  </button>
                )}
                {' '}| Amount:{' '}
                {inlineEditingField === 'amount' ? (
                  <input
                    type="number"
                    autoFocus
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={inlineDraft.amount}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setInlineReceiptDraftByDocId((prev) => ({
                        ...prev,
                        [doc.id]: { ...inlineDraft, amount: nextValue },
                      }));
                    }}
                    onBlur={() => { void saveInlineReceiptEdit(doc, 'amount'); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="build-wizard-inline-edit-trigger"
                    onClick={() => startInlineReceiptEdit(doc, parsedTask, 'amount')}
                  >
                    <span className={isQuoteTask ? 'build-wizard-quote-amount' : ''}>{formatCurrency(Number(doc.receipt_amount || 0))}</span>
                  </button>
                )}
              </span>
              <span>
                Type:{' '}
                {inlineEditingField === 'type' ? (
                  <select
                    autoFocus
                    value={inlineDraft.taskType}
                    onChange={(e) => {
                      const nextType = e.target.value as BuildWizardTaskType;
                      setInlineReceiptDraftByDocId((prev) => ({
                        ...prev,
                        [doc.id]: { ...inlineDraft, taskType: nextType },
                      }));
                      void saveInlineReceiptEdit(doc, 'type', { taskType: nextType });
                    }}
                    onBlur={() => { void saveInlineReceiptEdit(doc, 'type'); }}
                  >
                    {taskTypeOptions.map((opt) => (
                      <option key={`inline-task-type-${doc.id}-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    className="build-wizard-inline-edit-trigger"
                    onClick={() => startInlineReceiptEdit(doc, parsedTask, 'type')}
                  >
                    {taskTypeLabel}
                  </button>
                )}
              </span>
              {taskNotes ? (
                <div className="build-wizard-step-receipt-notes">
                  <div className="build-wizard-step-receipt-notes-label">Notes</div>
                  <div className="build-wizard-step-receipt-notes-body">{taskNotes}</div>
                </div>
              ) : null}
            </div>
            <div className="build-wizard-step-receipt-attachments">
              <div className="build-wizard-step-receipt-attachments-label">
                Attachments ({attachments.length})
              </div>
              {attachments.length > 0 ? (
                <div className="build-wizard-step-receipt-attachments-list">
                  {attachments.map((attachment) => (
                    <button
                      key={`receipt-${doc.id}-attachment-${attachment.id}`}
                      type="button"
                      className="build-wizard-step-receipt-link"
                      onClick={() => { void onOpenDocumentPreview(attachment); }}
                      title={attachment.original_name}
                    >
                      {attachment.original_name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="build-wizard-step-receipt-actions">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => onStartEditReceiptForStep(step, doc)}
                disabled={stepReadOnly}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => openMoveTaskModal(doc)}
                disabled={stepReadOnly}
              >
                Move
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => openTaskAttachmentsModal(doc)}
              >
                Attachments
              </button>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => { void onDeleteDocument(doc.id, doc.original_name); }}
                disabled={deletingDocumentId === doc.id}
              >
                {deletingDocumentId === doc.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
