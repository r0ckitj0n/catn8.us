import React from 'react';

import { IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';

interface UseBuildWizardNoteDocumentActionsOptions {
  addStepNote: (stepId: number, noteText: string) => Promise<unknown>;
  deleteDocument: (docId: number) => Promise<unknown>;
  deleteStepNote: (stepId: number, noteId: number) => Promise<unknown>;
  deletingDocumentId: number;
  deletingNoteId: number;
  editingNoteTextById: Record<number, string>;
  noteDraftByStep: Record<number, string>;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  replacingDocumentId: number;
  requestConfirmation: (config: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmButtonClass?: string;
  }) => Promise<boolean>;
  setDeletingDocumentId: React.Dispatch<React.SetStateAction<number>>;
  setDeletingNoteId: React.Dispatch<React.SetStateAction<number>>;
  setEditingNoteTextById: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setNoteDraftByStep: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setReplacingDocumentId: React.Dispatch<React.SetStateAction<number>>;
  setSavingNoteId: React.Dispatch<React.SetStateAction<number>>;
  setUnlinkingDocumentId: React.Dispatch<React.SetStateAction<number>>;
  unlinkingDocumentId: number;
  updateDocument: (docId: number, patch: { step_id?: number | null }) => Promise<unknown>;
  updateStepNote: (stepId: number, noteId: number, noteText: string) => Promise<boolean>;
  replaceDocument: (docId: number, file: File) => Promise<unknown>;
  savingNoteId: number;
}

export function useBuildWizardNoteDocumentActions({
  addStepNote,
  deleteDocument,
  deleteStepNote,
  deletingDocumentId,
  deletingNoteId,
  editingNoteTextById,
  noteDraftByStep,
  onToast,
  replacingDocumentId,
  requestConfirmation,
  setDeletingDocumentId,
  setDeletingNoteId,
  setEditingNoteTextById,
  setNoteDraftByStep,
  setReplacingDocumentId,
  setSavingNoteId,
  setUnlinkingDocumentId,
  unlinkingDocumentId,
  updateDocument,
  updateStepNote,
  replaceDocument,
  savingNoteId,
}: UseBuildWizardNoteDocumentActionsOptions) {
  const onSubmitNote = React.useCallback(async (step: IBuildWizardStep): Promise<boolean> => {
    const draft = String(noteDraftByStep[step.id] || '').trim();
    if (!draft) {
      return false;
    }
    await addStepNote(step.id, draft);
    setNoteDraftByStep((prev) => ({ ...prev, [step.id]: '' }));
    return true;
  }, [addStepNote, noteDraftByStep, setNoteDraftByStep]);

  const onStartEditNote = React.useCallback((noteId: number, noteText: string) => {
    setEditingNoteTextById((prev) => ({ ...prev, [noteId]: noteText }));
  }, [setEditingNoteTextById]);

  const onCancelEditNote = React.useCallback((noteId: number) => {
    setEditingNoteTextById((prev) => {
      const next = { ...prev };
      delete next[noteId];
      return next;
    });
  }, [setEditingNoteTextById]);

  const onSaveEditedNote = React.useCallback(async (stepId: number, noteId: number) => {
    if (savingNoteId === noteId) {
      return;
    }
    const draft = String(editingNoteTextById[noteId] || '').trim();
    if (!draft) {
      onToast?.({ tone: 'warning', message: 'Note cannot be empty.' });
      return;
    }
    setSavingNoteId(noteId);
    try {
      const ok = await updateStepNote(stepId, noteId, draft);
      if (ok) {
        onCancelEditNote(noteId);
      }
    } finally {
      setSavingNoteId(0);
    }
  }, [editingNoteTextById, onCancelEditNote, onToast, savingNoteId, setSavingNoteId, updateStepNote]);

  const onDeleteStepNoteById = React.useCallback(async (stepId: number, noteId: number) => {
    if (deletingNoteId === noteId) {
      return;
    }
    const confirmed = await requestConfirmation({
      title: 'Delete Note?',
      message: 'Delete this note?\n\nThis cannot be undone.',
      confirmLabel: 'Delete',
      confirmButtonClass: 'btn btn-danger',
    });
    if (!confirmed) {
      return;
    }
    setDeletingNoteId(noteId);
    try {
      await deleteStepNote(stepId, noteId);
      onCancelEditNote(noteId);
    } finally {
      setDeletingNoteId(0);
    }
  }, [deletingNoteId, deleteStepNote, onCancelEditNote, requestConfirmation, setDeletingNoteId]);

  const onDeleteDocument = React.useCallback(async (docId: number, docName: string) => {
    if (docId <= 0 || deletingDocumentId === docId) {
      return;
    }
    const confirmed = await requestConfirmation({
      title: 'Delete Document?',
      message: `Delete "${docName}"?\n\nThis cannot be undone.`,
      confirmLabel: 'Delete',
      confirmButtonClass: 'btn btn-danger',
    });
    if (!confirmed) {
      return;
    }
    setDeletingDocumentId(docId);
    try {
      await deleteDocument(docId);
    } finally {
      setDeletingDocumentId(0);
    }
  }, [deleteDocument, deletingDocumentId, requestConfirmation, setDeletingDocumentId]);

  const onRemoveDocumentFromStep = React.useCallback(async (docId: number) => {
    if (docId <= 0 || unlinkingDocumentId === docId) {
      return;
    }
    setUnlinkingDocumentId(docId);
    try {
      await updateDocument(docId, { step_id: null });
    } finally {
      setUnlinkingDocumentId(0);
    }
  }, [setUnlinkingDocumentId, unlinkingDocumentId, updateDocument]);

  const onReplaceDocumentFile = React.useCallback(async (doc: IBuildWizardDocument, file: File | null) => {
    if (!file || replacingDocumentId === doc.id) {
      return;
    }
    setReplacingDocumentId(doc.id);
    try {
      await replaceDocument(doc.id, file);
    } finally {
      setReplacingDocumentId(0);
    }
  }, [replaceDocument, replacingDocumentId, setReplacingDocumentId]);

  return {
    onCancelEditNote,
    onDeleteDocument,
    onDeleteStepNoteById,
    onRemoveDocumentFromStep,
    onReplaceDocumentFile,
    onSaveEditedNote,
    onStartEditNote,
    onSubmitNote,
  };
}
