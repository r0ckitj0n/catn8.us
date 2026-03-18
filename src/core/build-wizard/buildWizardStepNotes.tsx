import React from 'react';

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

  return (
    <div className="build-wizard-note-list">
      {step.notes.map((note) => (
        <div key={note.id}>
          <strong>{formatDate(note.created_at)}</strong>:
          {Object.prototype.hasOwnProperty.call(editingNoteTextById, note.id) ? (
            <div className="build-wizard-note-editor">
              <textarea
                rows={2}
                value={editingNoteTextById[note.id] || ''}
                onChange={(e) => setEditingNoteTextById((prev) => ({ ...prev, [note.id]: e.target.value }))}
              />
              <div className="build-wizard-note-editor-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => { void onSaveEditedNote(step.id, note.id); }}
                  disabled={savingNoteId === note.id}
                >
                  {savingNoteId === note.id ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => onCancelEditNote(note.id)}
                  disabled={savingNoteId === note.id}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => { void onDeleteStepNoteById(step.id, note.id); }}
                  disabled={deletingNoteId === note.id || savingNoteId === note.id}
                >
                  {deletingNoteId === note.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {' '}
              {note.note_text}
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
            </>
          )}
        </div>
      ))}
    </div>
  );
}
