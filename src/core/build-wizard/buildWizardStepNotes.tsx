import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';
import { IBuildWizardStep } from '../../types/buildWizard';

interface BuildWizardStepNotesProps {
  deletingNoteId: number;
  editingNoteTextById: Record<number, string>;
  formatDate: (value: string | null | undefined) => string;
  noteEditedAtLabel: (note: IBuildWizardStep['notes'][number]) => string;
  onCancelEditNote: (noteId: number) => void;
  onDeleteStepNoteById: (stepId: number, noteId: number) => Promise<void>;
  onSaveEditedNote: (stepId: number, noteId: number) => Promise<void>;
  onStartEditNote: (noteId: number, text: string) => void;
  open: boolean;
  savingNoteId: number;
  setEditingNoteTextById: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  step: IBuildWizardStep;
  stepReadOnly: boolean;
}

export function BuildWizardStepNotes({
  deletingNoteId,
  editingNoteTextById,
  formatDate,
  noteEditedAtLabel,
  onCancelEditNote,
  onDeleteStepNoteById,
  onSaveEditedNote,
  onStartEditNote,
  open,
  savingNoteId,
  setEditingNoteTextById,
  step,
  stepReadOnly,
}: BuildWizardStepNotesProps) {
  if (!open || step.notes.length === 0) {
    return null;
  }

  const editingNote = step.notes.find((note) => Object.prototype.hasOwnProperty.call(editingNoteTextById, note.id)) || null;

  return (
    <>
      <div className="build-wizard-note-list">
        {step.notes.map((note) => (
          <div key={note.id}>
            <strong>{formatDate(note.created_at)}</strong>: {note.note_text}
            {noteEditedAtLabel(note) ? (
              <>
                {' '}
                <em>(Edited {noteEditedAtLabel(note)})</em>
              </>
            ) : null}
            {!stepReadOnly ? (
              <>
                {' '}
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => onStartEditNote(note.id, note.note_text)}
                >
                  Edit
                </button>
                {' '}
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => { void onDeleteStepNoteById(step.id, note.id); }}
                  disabled={deletingNoteId === note.id}
                >
                  {deletingNoteId === note.id ? 'Deleting...' : 'Delete'}
                </button>
              </>
            ) : null}
          </div>
        ))}
      </div>
      {editingNote ? (
        <div
          className="build-wizard-doc-manager"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onCancelEditNote(editingNote.id);
            }
          }}
        >
          <div className="build-wizard-doc-manager-inner build-wizard-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="build-wizard-doc-manager-head">
              <h3>Edit Note</h3>
              <div className="build-wizard-doc-manager-actions">
                <StandardIconButton iconKey="close" ariaLabel="Close note editor" title="Close" className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn" onClick={() => onCancelEditNote(editingNote.id)} />
              </div>
            </div>
            <div className="build-wizard-note-editor">
              <textarea
                rows={4}
                value={editingNoteTextById[editingNote.id] || ''}
                onChange={(e) => setEditingNoteTextById((prev) => ({ ...prev, [editingNote.id]: e.target.value }))}
              />
              <div className="build-wizard-note-editor-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => { void onSaveEditedNote(step.id, editingNote.id); }} disabled={savingNoteId === editingNote.id}>
                  {savingNoteId === editingNote.id ? 'Saving...' : 'Save'}
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onCancelEditNote(editingNote.id)} disabled={savingNoteId === editingNote.id}>
                  Cancel
                </button>
                <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => { void onDeleteStepNoteById(step.id, editingNote.id); }} disabled={deletingNoteId === editingNote.id || savingNoteId === editingNote.id}>
                  {deletingNoteId === editingNote.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
