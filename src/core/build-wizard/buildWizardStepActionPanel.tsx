import React from 'react';

import { buildWizardTokenLabel } from '../buildWizardDropdownSettings';
import { IBuildWizardContact, IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
import { BuildWizardContactType, contactTypeLabel, normalizeContactType } from './buildWizardPageRenderTypes';

interface BuildWizardStepActionPanelProps {
  addableStepContacts: IBuildWizardContact[];
  attachExistingDocByStepId: Record<number, string>;
  attachExistingDocFilterByStepId: Record<number, string>;
  attachExistingPickerOpenByStepId: Record<number, boolean>;
  attachableProjectDocuments: IBuildWizardDocument[];
  contactTypeLabel: typeof contactTypeLabel;
  draft: IBuildWizardStep;
  effectiveStepContactCandidateId: number;
  filteredAttachableProjectDocuments: IBuildWizardDocument[];
  linkedStepDisplayNumberById: Map<number, number>;
  normalizeContactType: typeof normalizeContactType;
  noteDraftByStep: Record<number, string>;
  noteEditorOpenByStep: Record<number, boolean>;
  onAddContactToStep: (stepId: number, contactId: number) => Promise<void>;
  onAttachExistingDocumentToStep: (step: IBuildWizardStep) => Promise<void>;
  onSubmitNote: (step: IBuildWizardStep) => Promise<boolean>;
  setAttachExistingDocByStepId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setAttachExistingDocFilterByStepId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setAttachExistingPickerOpenByStepId: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setEditingReceiptDocumentIdByStep: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  setNoteDraftByStep: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setNoteEditorOpenByStep: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setReceiptEditorOpenByStep: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setStepContactCandidateByStepId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setStepContactPickerOpenByStepId: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  step: IBuildWizardStep;
  stepById: Map<number, IBuildWizardStep>;
  stepContactPickerOpenByStepId: Record<number, boolean>;
  stepReadOnly: boolean;
  uploadDocument: (kind: string, file: File, stepId?: number, caption?: string, phaseKey?: string) => Promise<unknown>;
}

export function BuildWizardStepActionPanel({
  addableStepContacts,
  attachExistingDocByStepId,
  attachExistingDocFilterByStepId,
  attachExistingPickerOpenByStepId,
  attachableProjectDocuments,
  contactTypeLabel,
  draft,
  effectiveStepContactCandidateId,
  filteredAttachableProjectDocuments,
  linkedStepDisplayNumberById,
  normalizeContactType,
  noteDraftByStep,
  noteEditorOpenByStep,
  onAddContactToStep,
  onAttachExistingDocumentToStep,
  onSubmitNote,
  setAttachExistingDocByStepId,
  setAttachExistingDocFilterByStepId,
  setAttachExistingPickerOpenByStepId,
  setEditingReceiptDocumentIdByStep,
  setNoteDraftByStep,
  setNoteEditorOpenByStep,
  setReceiptEditorOpenByStep,
  setStepContactCandidateByStepId,
  setStepContactPickerOpenByStepId,
  step,
  stepById,
  stepContactPickerOpenByStepId,
  stepReadOnly,
  uploadDocument,
}: BuildWizardStepActionPanelProps) {
  return (
    <>
      <div className="build-wizard-step-actions">
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => setNoteEditorOpenByStep((prev) => ({ ...prev, [step.id]: !prev[step.id] }))}
        >
          Add Note
        </button>
        <button
          className="btn btn-outline-secondary btn-sm"
          disabled={stepReadOnly}
          onClick={() => {
            setEditingReceiptDocumentIdByStep((prev) => ({ ...prev, [step.id]: 0 }));
            setReceiptEditorOpenByStep((prev) => ({ ...prev, [step.id]: !prev[step.id] }));
          }}
        >
          Add Task
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={stepReadOnly}
          onClick={() => setStepContactPickerOpenByStepId((prev) => ({ ...prev, [step.id]: !prev[step.id] }))}
        >
          Add Contact
        </button>
        <label className="btn btn-outline-secondary btn-sm build-wizard-upload-btn">
          Upload
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={(e) => {
              const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
              if (file) {
                const uploadKind = draft.step_type === 'blueprints'
                  ? 'blueprint'
                  : (draft.step_type === 'photos' ? 'photo' : 'progress_photo');
                void uploadDocument(uploadKind, file, step.id, step.title, step.phase_key);
              }
              e.currentTarget.value = '';
            }}
          />
        </label>
        {attachableProjectDocuments.length ? (
          <div className="build-wizard-step-attach-existing">
            {attachExistingPickerOpenByStepId[step.id] ? (
              <input
                type="text"
                className="build-wizard-attach-filter-input"
                placeholder="Filter attachments..."
                value={attachExistingDocFilterByStepId[step.id] || ''}
                onChange={(e) => setAttachExistingDocFilterByStepId((prev) => ({ ...prev, [step.id]: e.target.value }))}
              />
            ) : null}
            <select
              value={attachExistingDocByStepId[step.id] || ''}
              onFocus={() => setAttachExistingPickerOpenByStepId((prev) => ({ ...prev, [step.id]: true }))}
              onMouseDown={() => setAttachExistingPickerOpenByStepId((prev) => ({ ...prev, [step.id]: true }))}
              onChange={(e) => setAttachExistingDocByStepId((prev) => ({ ...prev, [step.id]: e.target.value }))}
            >
              <option value="">Attach existing document...</option>
              {filteredAttachableProjectDocuments.map((doc) => {
                const linkedStepId = Number(doc.step_id || 0);
                const linkedStep = linkedStepId > 0 ? stepById.get(linkedStepId) : null;
                const linkedStepNumber = linkedStepId > 0
                  ? (linkedStepDisplayNumberById.get(linkedStepId) || linkedStep?.step_order || linkedStepId)
                  : 0;
                const linkSuffix = linkedStep
                  ? `Linked #${linkedStepNumber}: ${linkedStep.title}`
                  : 'Unlinked';
                return (
                  <option key={doc.id} value={String(doc.id)}>
                    {doc.original_name} ({buildWizardTokenLabel(doc.kind, 'Other')}) - {linkSuffix}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => { void onAttachExistingDocumentToStep(step); }}
              disabled={!attachExistingDocByStepId[step.id]}
            >
              Attach
            </button>
          </div>
        ) : null}
      </div>

      {stepContactPickerOpenByStepId[step.id] ? (
        <div className="build-wizard-step-contact-picker">
          <select
            value={effectiveStepContactCandidateId > 0 ? String(effectiveStepContactCandidateId) : ''}
            onChange={(e) => setStepContactCandidateByStepId((prev) => ({ ...prev, [step.id]: e.target.value }))}
          >
            <option value="">Select contact...</option>
            {addableStepContacts.map((contact) => (
              <option key={`step-contact-${step.id}-${contact.id}`} value={String(contact.id)}>
                {contact.display_name} ({contactTypeLabel(normalizeContactType(contact))})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            disabled={stepReadOnly || effectiveStepContactCandidateId <= 0}
            onClick={() => { void onAddContactToStep(step.id, effectiveStepContactCandidateId); }}
          >
            Assign
          </button>
        </div>
      ) : null}

      {noteEditorOpenByStep[step.id] ? (
        <div className="build-wizard-note-editor">
          <textarea
            rows={3}
            placeholder="Type your note..."
            value={noteDraftByStep[step.id] || ''}
            onChange={(e) => setNoteDraftByStep((prev) => ({ ...prev, [step.id]: e.target.value }))}
          />
          <div className="build-wizard-note-editor-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                void onSubmitNote(step).then((saved) => {
                  if (saved) {
                    setNoteEditorOpenByStep((prev) => ({ ...prev, [step.id]: false }));
                  }
                });
              }}
            >
              Save Note
            </button>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setNoteEditorOpenByStep((prev) => ({ ...prev, [step.id]: false }))}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
