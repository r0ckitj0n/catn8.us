import React from 'react';

import { ApiClient } from '../ApiClient';
import { IBuildWizardStep } from '../../types/buildWizard';
import { BuildWizardToast } from './buildWizardInternalTypes';
import { normalizeBuildWizardStep } from './buildWizardSanitizers';

interface UseBuildWizardStepNoteActionsArgs {
  onToast?: (t: BuildWizardToast) => void;
  setSteps: React.Dispatch<React.SetStateAction<IBuildWizardStep[]>>;
}

export function useBuildWizardStepNoteActions(args: UseBuildWizardStepNoteActionsArgs) {
  const { onToast, setSteps } = args;

  const addStepNote = React.useCallback(async (stepId: number, noteText: string) => {
    const t = String(noteText || '').trim();
    if (!t) return;
    try {
      const res = await ApiClient.post<{ success: boolean; step: IBuildWizardStep }>('/api/build_wizard.php?action=add_step_note', { step_id: stepId, note_text: t });
      const next = res?.step ? normalizeBuildWizardStep(res.step) : null;
      setSteps((prev) => prev.map((s) => (s.id === stepId ? (next || s) : s)));
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to add note' });
    }
  }, [onToast, setSteps]);

  const updateStepNote = React.useCallback(async (stepId: number, noteId: number, noteText: string) => {
    const t = String(noteText || '').trim();
    if (stepId <= 0 || noteId <= 0 || !t) return false;
    try {
      const res = await ApiClient.post<{ success: boolean; step: IBuildWizardStep }>('/api/build_wizard.php?action=update_step_note', { step_id: stepId, note_id: noteId, note_text: t });
      const next = res?.step ? normalizeBuildWizardStep(res.step) : null;
      setSteps((prev) => prev.map((s) => (s.id === stepId ? (next || s) : s)));
      onToast?.({ tone: 'success', message: 'Note updated.' });
      return true;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to update note' });
      return false;
    }
  }, [onToast, setSteps]);

  const deleteStepNote = React.useCallback(async (stepId: number, noteId: number) => {
    if (stepId <= 0 || noteId <= 0) return false;
    try {
      const res = await ApiClient.post<{ success: boolean; step: IBuildWizardStep }>('/api/build_wizard.php?action=delete_step_note', { step_id: stepId, note_id: noteId });
      const next = res?.step ? normalizeBuildWizardStep(res.step) : null;
      setSteps((prev) => prev.map((s) => (s.id === stepId ? (next || s) : s)));
      onToast?.({ tone: 'success', message: 'Note deleted.' });
      return true;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to delete note' });
      return false;
    }
  }, [onToast, setSteps]);

  return {
    addStepNote,
    updateStepNote,
    deleteStepNote,
  };
}
