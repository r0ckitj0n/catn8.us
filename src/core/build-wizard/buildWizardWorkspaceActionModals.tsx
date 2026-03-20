import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';
import { IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
import { BuildTabId } from '../../types/pages/buildWizardPage';
import { BuildWizardConfirmState } from './buildWizardPageRenderTypes';
import { BuildWizardTaskAttachmentsModal } from './buildWizardTaskAttachmentsModal';

interface BuildWizardWorkspaceActionModalsProps {
  activeTabStepNumbers: Map<number, number>;
  attachExistingDocByReceiptId: Record<number, string>;
  attachExistingDocFilterByReceiptId: Record<number, string>;
  confirmState: BuildWizardConfirmState | null;
  documentSavingId: number;
  documents: IBuildWizardDocument[];
  moveStepModalStep: IBuildWizardStep | null;
  moveStepPhaseOrderPreviewByTab: Partial<Record<BuildTabId, Array<{ id: number; label: string }>>>;
  moveStepModalTargetTab: BuildTabId;
  moveStepPhaseTabOptions: Array<{ label: string; value: BuildTabId }>;
  moveTaskModalDoc: IBuildWizardDocument | null;
  moveTaskModalTargetStepId: number;
  moveTaskStepOptions: Array<{ label: string; step: IBuildWizardStep }>;
  movingStep: boolean;
  onAttachExistingDocumentToReceipt: (step: IBuildWizardStep, document: IBuildWizardDocument) => Promise<void>;
  onCloseMoveStep: () => void;
  onCloseMoveTask: () => void;
  onCloseTaskAttachments: () => void;
  onConfirm: (confirmed: boolean) => void;
  onMoveStepFromModal: () => Promise<void>;
  onMoveReceiptToStep: () => Promise<void>;
  onOpenDocumentPreview: (document: IBuildWizardDocument) => Promise<void>;
  onUploadReceiptAttachments: (document: IBuildWizardDocument, files: FileList | null) => void;
  setAttachExistingDocByReceiptId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setAttachExistingDocFilterByReceiptId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setMoveStepModalTargetTab: (value: BuildTabId) => void;
  setMoveTaskModalTargetStepId: (value: number) => void;
  taskAttachmentsModalAttachableDocuments: IBuildWizardDocument[];
  taskAttachmentsModalDoc: IBuildWizardDocument | null;
  taskAttachmentsModalStep: IBuildWizardStep | null;
}

export function BuildWizardWorkspaceActionModals({
  activeTabStepNumbers,
  attachExistingDocByReceiptId,
  attachExistingDocFilterByReceiptId,
  confirmState,
  documentSavingId,
  documents,
  moveStepModalStep,
  moveStepPhaseOrderPreviewByTab,
  moveStepModalTargetTab,
  moveStepPhaseTabOptions,
  moveTaskModalDoc,
  moveTaskModalTargetStepId,
  moveTaskStepOptions,
  movingStep,
  onAttachExistingDocumentToReceipt,
  onCloseMoveStep,
  onCloseMoveTask,
  onCloseTaskAttachments,
  onConfirm,
  onMoveStepFromModal,
  onMoveReceiptToStep,
  onOpenDocumentPreview,
  onUploadReceiptAttachments,
  setAttachExistingDocByReceiptId,
  setAttachExistingDocFilterByReceiptId,
  setMoveStepModalTargetTab,
  setMoveTaskModalTargetStepId,
  taskAttachmentsModalAttachableDocuments,
  taskAttachmentsModalDoc,
  taskAttachmentsModalStep,
}: BuildWizardWorkspaceActionModalsProps) {
  const targetPhaseOrderPreview = moveStepPhaseOrderPreviewByTab[moveStepModalTargetTab] || [];
  return (
    <>
      {confirmState ? (
        <div className="build-wizard-doc-manager" onClick={() => onConfirm(false)}>
          <div className="build-wizard-doc-manager-inner build-wizard-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="build-wizard-doc-manager-head">
              <h3>{confirmState.title}</h3>
              <div className="build-wizard-doc-manager-actions">
                <StandardIconButton
                  iconKey="close"
                  ariaLabel="Close confirmation dialog"
                  title="Close"
                  className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
                  onClick={() => onConfirm(false)}
                />
              </div>
            </div>
            <p className="build-wizard-confirm-message">{confirmState.message}</p>
            <div className="build-wizard-confirm-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={() => onConfirm(false)}>
                {confirmState.cancelLabel}
              </button>
              <button type="button" className={confirmState.confirmButtonClass} onClick={() => onConfirm(true)}>
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {moveStepModalStep ? (
        <div className="build-wizard-doc-manager" onClick={() => !movingStep && onCloseMoveStep()}>
          <div className="build-wizard-doc-manager-inner build-wizard-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="build-wizard-doc-manager-head">
              <h3>Move Step</h3>
              <div className="build-wizard-doc-manager-actions">
                <StandardIconButton
                  iconKey="close"
                  ariaLabel="Close move step dialog"
                  title="Close"
                  className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
                  onClick={() => {
                    if (!movingStep) {
                      onCloseMoveStep();
                    }
                  }}
                />
              </div>
            </div>
            <p className="build-wizard-confirm-message">
              {`Where do you want to move "#${activeTabStepNumbers.get(moveStepModalStep.id) || moveStepModalStep.step_order} ${moveStepModalStep.title}"?`}
            </p>
            <label className="build-wizard-move-modal-field">
              Target phase
              <select
                value={moveStepModalTargetTab}
                onChange={(e) => setMoveStepModalTargetTab(e.target.value as BuildTabId)}
                disabled={movingStep}
              >
                {moveStepPhaseTabOptions.map((option) => (
                  <option key={`move-modal-phase-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="build-wizard-move-modal-phase-preview">
              <div className="build-wizard-move-modal-phase-preview-title">Current step order</div>
              {targetPhaseOrderPreview.length > 0 ? (
                <ol className="build-wizard-move-modal-phase-preview-list">
                  {targetPhaseOrderPreview.map((entry) => (
                    <li key={`move-step-preview-${moveStepModalTargetTab}-${entry.id}`}>{entry.label.replace(/^#\d+\s/, '')}</li>
                  ))}
                </ol>
              ) : (
                <div className="build-wizard-muted">No steps in this phase yet.</div>
              )}
            </div>
            <div className="build-wizard-confirm-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={onCloseMoveStep} disabled={movingStep}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => { void onMoveStepFromModal(); }} disabled={movingStep}>
                {movingStep ? 'Moving...' : 'Move Step'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {moveTaskModalDoc ? (
        <div className="build-wizard-doc-manager" onClick={() => documentSavingId !== moveTaskModalDoc.id && onCloseMoveTask()}>
          <div className="build-wizard-doc-manager-inner build-wizard-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="build-wizard-doc-manager-head">
              <h3>Move Task</h3>
              <div className="build-wizard-doc-manager-actions">
                <StandardIconButton
                  iconKey="close"
                  ariaLabel="Close move task dialog"
                  title="Close"
                  className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
                  onClick={() => {
                    if (documentSavingId !== moveTaskModalDoc.id) {
                      onCloseMoveTask();
                    }
                  }}
                />
              </div>
            </div>
            <p className="build-wizard-confirm-message">
              {`Where do you want to move "${moveTaskModalDoc.receipt_title?.trim() || moveTaskModalDoc.original_name}"?`}
            </p>
            <label className="build-wizard-move-modal-field">
              Target step
              <select
                value={moveTaskModalTargetStepId > 0 ? String(moveTaskModalTargetStepId) : ''}
                onChange={(e) => setMoveTaskModalTargetStepId(Number(e.target.value || '0'))}
                disabled={documentSavingId === moveTaskModalDoc.id}
              >
                <option value="">Choose a step...</option>
                {moveTaskStepOptions.map((option) => (
                  <option key={`move-task-modal-${option.step.id}`} value={option.step.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="build-wizard-confirm-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={onCloseMoveTask} disabled={documentSavingId === moveTaskModalDoc.id}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { void onMoveReceiptToStep(); }}
                disabled={documentSavingId === moveTaskModalDoc.id || moveTaskModalTargetStepId <= 0}
              >
                {documentSavingId === moveTaskModalDoc.id ? 'Moving...' : 'Move Task'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BuildWizardTaskAttachmentsModal
        attachExistingDocByReceiptId={attachExistingDocByReceiptId}
        attachExistingDocFilterByReceiptId={attachExistingDocFilterByReceiptId}
        documents={documents}
        onAttachExistingDocumentToReceipt={onAttachExistingDocumentToReceipt}
        onClose={onCloseTaskAttachments}
        onOpenDocumentPreview={onOpenDocumentPreview}
        onUploadReceiptAttachments={onUploadReceiptAttachments}
        open={Boolean(taskAttachmentsModalDoc)}
        setAttachExistingDocByReceiptId={setAttachExistingDocByReceiptId}
        setAttachExistingDocFilterByReceiptId={setAttachExistingDocFilterByReceiptId}
        taskAttachmentsModalAttachableDocuments={taskAttachmentsModalAttachableDocuments}
        taskAttachmentsModalDoc={taskAttachmentsModalDoc}
        taskAttachmentsModalStep={taskAttachmentsModalStep}
      />
    </>
  );
}
