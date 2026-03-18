import React from 'react';

import { ApiClient } from '../ApiClient';
import {
  IBuildWizardDocument,
  IBuildWizardStep,
} from '../../types/buildWizard';
import {
  AddStepResponse,
  BuildWizardToast,
  DeleteStepResponse,
  ReorderStepsResponse,
} from './buildWizardInternalTypes';
import {
  normalizeBuildWizardStep,
  normalizeBuildWizardSteps,
} from './buildWizardSanitizers';
import { useBuildWizardDocumentActions } from './useBuildWizardDocumentActions';
import { useBuildWizardStepNoteActions } from './useBuildWizardStepNoteActions';

interface UseBuildWizardStepDocumentActionsArgs {
  onToast?: (t: BuildWizardToast) => void;
  projectId: number;
  refreshCurrentProject: () => Promise<void>;
  setSteps: React.Dispatch<React.SetStateAction<IBuildWizardStep[]>>;
  setDocuments: React.Dispatch<React.SetStateAction<IBuildWizardDocument[]>>;
}

export function useBuildWizardStepDocumentActions(args: UseBuildWizardStepDocumentActionsArgs) {
  const { onToast, projectId, refreshCurrentProject, setSteps, setDocuments } = args;
  const stepNoteActions = useBuildWizardStepNoteActions({ onToast, setSteps });
  const documentActions = useBuildWizardDocumentActions({
    onToast,
    projectId,
    refreshCurrentProject,
    setSteps,
    setDocuments,
  });

  const updateStep = React.useCallback(async (stepId: number, patch: Partial<IBuildWizardStep>) => {
    if (stepId <= 0) return null;
    const body: Record<string, unknown> = { step_id: stepId };
    const acceptedFields = ['phase_key', 'parent_step_id', 'step_type', 'title', 'description', 'permit_required', 'permit_document_id', 'permit_name', 'permit_authority', 'permit_status', 'permit_application_url', 'purchase_category', 'purchase_brand', 'purchase_model', 'purchase_sku', 'purchase_unit', 'purchase_qty', 'purchase_unit_price', 'purchase_vendor', 'purchase_url', 'expected_start_date', 'expected_end_date', 'expected_duration_days', 'estimated_cost', 'actual_cost', 'is_completed', 'source_ref', 'depends_on_step_ids', 'ai_estimated_fields'] as const;
    acceptedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(patch, field)) body[field] = (patch as any)[field];
    });
    if (Object.keys(body).length <= 1) return null;
    try {
      const res = await ApiClient.post<{ success: boolean; step: IBuildWizardStep; steps?: IBuildWizardStep[] }>('/api/build_wizard.php?action=update_step', body);
      if (Array.isArray(res?.steps)) {
        const normalizedSteps = normalizeBuildWizardSteps(res.steps);
        setSteps(normalizedSteps);
        return normalizedSteps.find((s) => s.id === stepId) || null;
      }
      const next = res?.step ? normalizeBuildWizardStep(res.step) : null;
      setSteps((prev) => prev.map((s) => (s.id === stepId ? (next || s) : s)));
      return next;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to update step' });
      await refreshCurrentProject();
      return null;
    }
  }, [onToast, refreshCurrentProject, setSteps]);

  const toggleStep = React.useCallback(async (step: IBuildWizardStep, checked: boolean) => {
    await updateStep(step.id, { is_completed: checked ? 1 : 0 });
  }, [updateStep]);

  const addStep = React.useCallback(async (phaseKey: string) => {
    if (projectId <= 0) return;
    try {
      const res = await ApiClient.post<AddStepResponse>('/api/build_wizard.php?action=add_step', { project_id: projectId, phase_key: phaseKey });
      if (res?.step) {
        const nextStep = normalizeBuildWizardStep(res.step);
        setSteps((prev) => [...prev, nextStep].sort((a, b) => (a.step_order !== b.step_order ? a.step_order - b.step_order : a.id - b.id)));
      } else {
        await refreshCurrentProject();
      }
      onToast?.({ tone: 'success', message: 'Step added.' });
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to add step' });
    }
  }, [onToast, projectId, refreshCurrentProject, setSteps]);

  const deleteStep = React.useCallback(async (stepId: number) => {
    if (stepId <= 0) return;
    try {
      const res = await ApiClient.post<DeleteStepResponse>('/api/build_wizard.php?action=delete_step', { step_id: stepId });
      if (Array.isArray(res?.steps)) {
        setSteps(normalizeBuildWizardSteps(res.steps));
      } else {
        setSteps((prev) => prev.filter((s) => s.id !== stepId));
      }
      onToast?.({ tone: 'success', message: 'Step deleted.' });
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to delete step' });
      await refreshCurrentProject();
    }
  }, [onToast, refreshCurrentProject, setSteps]);

  const reorderSteps = React.useCallback(async (phaseKey: string, orderedStepIds: number[]) => {
    if (projectId <= 0 || !Array.isArray(orderedStepIds) || orderedStepIds.length === 0) return false;
    try {
      const res = await ApiClient.post<ReorderStepsResponse>('/api/build_wizard.php?action=reorder_steps', { project_id: projectId, phase_key: phaseKey, ordered_step_ids: orderedStepIds });
      if (Array.isArray(res?.steps)) {
        setSteps(normalizeBuildWizardSteps(res.steps));
      } else {
        await refreshCurrentProject();
      }
      return true;
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to reorder steps' });
      await refreshCurrentProject();
      return false;
    }
  }, [onToast, projectId, refreshCurrentProject, setSteps]);

  return {
    updateStep,
    toggleStep,
    ...stepNoteActions,
    addStep,
    deleteStep,
    reorderSteps,
    ...documentActions,
  };
}
