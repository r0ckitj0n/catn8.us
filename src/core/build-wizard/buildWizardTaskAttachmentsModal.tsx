import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';
import { buildWizardTokenLabel } from '../buildWizardDropdownSettings';
import { IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';

interface BuildWizardTaskAttachmentsModalProps {
  attachExistingDocByReceiptId: Record<number, string>;
  attachExistingDocFilterByReceiptId: Record<number, string>;
  documents: IBuildWizardDocument[];
  onAttachExistingDocumentToReceipt: (step: IBuildWizardStep, document: IBuildWizardDocument) => Promise<void>;
  onClose: () => void;
  onOpenDocumentPreview: (document: IBuildWizardDocument) => Promise<void>;
  onUploadReceiptAttachments: (document: IBuildWizardDocument, files: FileList | null) => void;
  open: boolean;
  setAttachExistingDocByReceiptId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setAttachExistingDocFilterByReceiptId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  taskAttachmentsModalAttachableDocuments: IBuildWizardDocument[];
  taskAttachmentsModalDoc: IBuildWizardDocument | null;
  taskAttachmentsModalStep: IBuildWizardStep | null;
}

export function BuildWizardTaskAttachmentsModal({
  attachExistingDocByReceiptId,
  attachExistingDocFilterByReceiptId,
  documents,
  onAttachExistingDocumentToReceipt,
  onClose,
  onOpenDocumentPreview,
  onUploadReceiptAttachments,
  open,
  setAttachExistingDocByReceiptId,
  setAttachExistingDocFilterByReceiptId,
  taskAttachmentsModalAttachableDocuments,
  taskAttachmentsModalDoc,
  taskAttachmentsModalStep,
}: BuildWizardTaskAttachmentsModalProps) {
  if (!open || !taskAttachmentsModalDoc) {
    return null;
  }

  return (
    <div className="build-wizard-doc-manager" onClick={onClose}>
      <div className="build-wizard-doc-manager-inner build-wizard-task-attachments-modal" onClick={(e) => e.stopPropagation()}>
        <div className="build-wizard-doc-manager-head">
          <h3>Task Attachments</h3>
          <div className="build-wizard-doc-manager-actions">
            <StandardIconButton
              iconKey="close"
              ariaLabel="Close attachments dialog"
              title="Close"
              className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
              onClick={onClose}
            />
          </div>
        </div>
        <p className="build-wizard-confirm-message">
          {`Manage attachments for "${taskAttachmentsModalDoc.receipt_title?.trim() || taskAttachmentsModalDoc.original_name}".`}
        </p>
        <div className="build-wizard-task-attachments-grid">
          <section className="build-wizard-task-attachments-card">
            <h4>Upload New Attachment</h4>
            <label className="btn btn-outline-primary btn-sm build-wizard-upload-btn">
              Choose Files
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={(e) => {
                  onUploadReceiptAttachments(taskAttachmentsModalDoc, e.target.files);
                  e.currentTarget.value = '';
                }}
              />
            </label>
            <div className="build-wizard-muted">Accepted: images and PDF files.</div>
          </section>
          <section className="build-wizard-task-attachments-card">
            <h4>Attach Existing Document</h4>
            <label className="build-wizard-move-modal-field">
              Filter documents
              <input
                type="text"
                className="build-wizard-attach-filter-input"
                placeholder="Filter attachments..."
                value={attachExistingDocFilterByReceiptId[taskAttachmentsModalDoc.id] || ''}
                onChange={(e) => setAttachExistingDocFilterByReceiptId((prev) => ({ ...prev, [taskAttachmentsModalDoc.id]: e.target.value }))}
              />
            </label>
            <label className="build-wizard-move-modal-field">
              Existing document
              <select
                value={attachExistingDocByReceiptId[taskAttachmentsModalDoc.id] || ''}
                onChange={(e) => setAttachExistingDocByReceiptId((prev) => ({ ...prev, [taskAttachmentsModalDoc.id]: e.target.value }))}
              >
                <option value="">Choose a document...</option>
                {taskAttachmentsModalAttachableDocuments.map((candidate) => (
                  <option key={`task-modal-attach-${taskAttachmentsModalDoc.id}-${candidate.id}`} value={String(candidate.id)}>
                    {candidate.original_name} ({buildWizardTokenLabel(candidate.kind, 'Other')})
                  </option>
                ))}
              </select>
            </label>
            <div className="build-wizard-doc-manager-actions">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => {
                  if (taskAttachmentsModalStep) {
                    void onAttachExistingDocumentToReceipt(taskAttachmentsModalStep, taskAttachmentsModalDoc);
                  }
                }}
                disabled={!taskAttachmentsModalStep || !attachExistingDocByReceiptId[taskAttachmentsModalDoc.id]}
              >
                Attach Existing
              </button>
            </div>
          </section>
          <section className="build-wizard-task-attachments-card is-wide">
            <h4>Current Attachments</h4>
            {documents.filter((doc) => Number(doc.receipt_parent_document_id || 0) === taskAttachmentsModalDoc.id).length > 0 ? (
              <div className="build-wizard-step-receipt-attachments-list">
                {documents
                  .filter((doc) => Number(doc.receipt_parent_document_id || 0) === taskAttachmentsModalDoc.id)
                  .map((attachment) => (
                    <button
                      key={`task-modal-current-attachment-${attachment.id}`}
                      type="button"
                      className="build-wizard-step-receipt-link"
                      onClick={() => { void onOpenDocumentPreview(attachment); }}
                      title={attachment.original_name}
                    >
                      {attachment.original_name}
                    </button>
                  ))}
              </div>
            ) : (
              <div className="build-wizard-muted">No attachments yet.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
