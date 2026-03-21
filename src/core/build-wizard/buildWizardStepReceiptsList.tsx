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
  toggleTaskCompleted: (document: IBuildWizardDocument, parsedTask: ParsedTask, completed: boolean) => Promise<void>;
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
  toggleTaskCompleted,
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
        const taskCompleted = parsedTask.taskMeta.is_completed === true;
        const taskAmount = Number(doc.receipt_amount || 0);
        const showTaskAmount = Number.isFinite(taskAmount) && Math.abs(taskAmount) >= 0.005;
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
                Vendor: {doc.receipt_vendor || '-'} | Date: {getTaskEffectiveDate(doc, step, parsedTask.taskMeta) || '-'}
                {showTaskAmount ? (
                  <>
                    {' '}| Amount:{' '}
                    <span className={isQuoteTask ? 'build-wizard-quote-amount' : ''}>{formatCurrency(taskAmount)}</span>
                  </>
                ) : null}
              </span>
              <span>Type: {taskTypeLabel}</span>
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
                className={`build-wizard-task-icon-btn${taskCompleted ? ' is-active' : ''}`}
                aria-label={taskCompleted ? 'Mark task incomplete' : 'Mark task complete'}
                title={taskCompleted ? 'Mark task incomplete' : 'Mark task complete'}
                disabled={stepReadOnly}
                onClick={() => { void toggleTaskCompleted(doc, parsedTask, !taskCompleted); }}
              >
                {taskCompleted ? '☑️' : '⬜'}
              </button>
              <button
                type="button"
                className="build-wizard-task-icon-btn"
                aria-label="Edit task"
                title="Edit task"
                onClick={() => onStartEditReceiptForStep(step, doc)}
                disabled={stepReadOnly}
              >
                ✏️
              </button>
              <button
                type="button"
                className="build-wizard-task-icon-btn"
                aria-label="Move task"
                title="Move task"
                onClick={() => openMoveTaskModal(doc)}
                disabled={stepReadOnly}
              >
                ↔️
              </button>
              <button
                type="button"
                className="build-wizard-task-icon-btn"
                aria-label={`Task attachments (${attachments.length})`}
                title={`Task attachments (${attachments.length})`}
                onClick={() => openTaskAttachmentsModal(doc)}
              >
                📎
              </button>
              <button
                type="button"
                className="build-wizard-task-icon-btn is-danger"
                aria-label={deletingDocumentId === doc.id ? 'Deleting task' : 'Delete task'}
                title={deletingDocumentId === doc.id ? 'Deleting task' : 'Delete task'}
                onClick={() => { void onDeleteDocument(doc.id, doc.original_name); }}
                disabled={deletingDocumentId === doc.id}
              >
                {deletingDocumentId === doc.id ? '⏳' : '🗑️'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
