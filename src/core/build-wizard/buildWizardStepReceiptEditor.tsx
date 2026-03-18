import React from 'react';

import { composeReceiptNotesWithTaskMeta } from './buildWizardTaskMetaUtils';
import { toStringOrNull } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardContact, IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
import { BuildWizardTaskType } from './buildWizardPageRenderTypes';
import { BuildWizardReceiptDraftState, BuildWizardReceiptTaskMetaFields } from './buildWizardReceiptTaskMetaFields';

interface BuildWizardStepReceiptEditorProps {
  authorityContacts: IBuildWizardContact[];
  autosaveExistingReceiptDraftForStep: (step: IBuildWizardStep, patch: Partial<IBuildWizardDocument>) => Promise<void>;
  editingReceiptDocumentIdByStep: Record<number, number>;
  onSaveReceiptForStep: (step: IBuildWizardStep) => Promise<void>;
  open: boolean;
  permitDocuments: IBuildWizardDocument[];
  permitStatusOptions: string[];
  purchaseUnitOptions: string[];
  receiptDraft: BuildWizardReceiptDraftState;
  receiptDraftByStep: Record<number, BuildWizardReceiptDraftState>;
  receiptEditorRefByStepId: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  setEditingReceiptDocumentIdByStep: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  setReceiptAttachmentDraftByStep: React.Dispatch<React.SetStateAction<Record<number, File[]>>>;
  setReceiptDraftByStep: React.Dispatch<React.SetStateAction<Record<number, BuildWizardReceiptDraftState>>>;
  setReceiptEditorOpenByStep: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  step: IBuildWizardStep;
  taskTypeOptions: Array<{ label: string; value: BuildWizardTaskType }>;
}

export function BuildWizardStepReceiptEditor({
  authorityContacts,
  autosaveExistingReceiptDraftForStep,
  editingReceiptDocumentIdByStep,
  onSaveReceiptForStep,
  open,
  permitDocuments,
  permitStatusOptions,
  purchaseUnitOptions,
  receiptDraft,
  receiptDraftByStep,
  receiptEditorRefByStepId,
  setEditingReceiptDocumentIdByStep,
  setReceiptAttachmentDraftByStep,
  setReceiptDraftByStep,
  setReceiptEditorOpenByStep,
  step,
  taskTypeOptions,
}: BuildWizardStepReceiptEditorProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="build-wizard-note-editor"
      ref={(el) => { receiptEditorRefByStepId.current[step.id] = el; }}
    >
      <div className="build-wizard-muted">
        {Number(editingReceiptDocumentIdByStep[step.id] || 0) > 0 ? 'Editing task' : 'New task'}
      </div>
      <div className="build-wizard-step-receipt-upload-grid">
        <label>
          Title
          <input
            type="text"
            value={receiptDraft.receipt_title}
            onChange={(e) => setReceiptDraftByStep((prev) => ({
              ...prev,
              [step.id]: { ...receiptDraft, receipt_title: e.target.value },
            }))}
          />
        </label>
        <label>
          Vendor
          <input
            type="text"
            value={receiptDraft.receipt_vendor}
            onChange={(e) => setReceiptDraftByStep((prev) => ({
              ...prev,
              [step.id]: { ...receiptDraft, receipt_vendor: e.target.value },
            }))}
          />
        </label>
        <label>
          Task Date Override
          <input
            type="date"
            value={receiptDraft.receipt_date}
            onChange={(e) => setReceiptDraftByStep((prev) => ({
              ...prev,
              [step.id]: { ...receiptDraft, receipt_date: e.target.value },
            }))}
            onBlur={() => {
              const activeDraft = receiptDraftByStep[step.id] ?? receiptDraft;
              void autosaveExistingReceiptDraftForStep(step, {
                receipt_date: toStringOrNull(activeDraft.receipt_date || ''),
                receipt_notes: toStringOrNull(composeReceiptNotesWithTaskMeta({
                  ...activeDraft.task_meta,
                  manual_date_override: Boolean(toStringOrNull(activeDraft.receipt_date || '')),
                }, activeDraft.receipt_notes)),
              });
            }}
          />
        </label>
        <label>
          Amount
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={receiptDraft.receipt_amount}
            onChange={(e) => setReceiptDraftByStep((prev) => ({
              ...prev,
              [step.id]: { ...receiptDraft, receipt_amount: e.target.value },
            }))}
          />
        </label>
        <label>
          Type
          <select
            value={receiptDraft.task_meta.task_type}
            onChange={(e) => setReceiptDraftByStep((prev) => ({
              ...prev,
              [step.id]: {
                ...receiptDraft,
                task_meta: {
                  ...receiptDraft.task_meta,
                  task_type: e.target.value as BuildWizardTaskType,
                },
              },
            }))}
          >
            {taskTypeOptions.map((opt) => (
              <option key={`task-type-${opt.value}`} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <BuildWizardReceiptTaskMetaFields
          authorityContacts={authorityContacts}
          permitDocuments={permitDocuments}
          permitStatusOptions={permitStatusOptions}
          purchaseUnitOptions={purchaseUnitOptions}
          receiptDraft={receiptDraft}
          setReceiptDraftByStep={setReceiptDraftByStep}
          stepId={step.id}
        />
        <label className="is-wide">
          Notes
          <input
            type="text"
            value={receiptDraft.receipt_notes}
            onChange={(e) => setReceiptDraftByStep((prev) => ({
              ...prev,
              [step.id]: { ...receiptDraft, receipt_notes: e.target.value },
            }))}
          />
        </label>
        <label className="is-wide">
          Task Attachment(s)
          <input
            type="file"
            accept="image/*,.pdf"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              setReceiptAttachmentDraftByStep((prev) => ({ ...prev, [step.id]: files }));
            }}
          />
        </label>
      </div>
      <div className="build-wizard-note-editor-actions">
        <button className="btn btn-primary btn-sm" onClick={() => { void onSaveReceiptForStep(step); }}>
          {Number(editingReceiptDocumentIdByStep[step.id] || 0) > 0 ? 'Update Task' : 'Save Task'}
        </button>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => {
            setEditingReceiptDocumentIdByStep((prev) => ({ ...prev, [step.id]: 0 }));
            setReceiptEditorOpenByStep((prev) => ({ ...prev, [step.id]: false }));
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
