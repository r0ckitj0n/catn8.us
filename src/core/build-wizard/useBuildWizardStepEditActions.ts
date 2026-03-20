import React from 'react';

import { PHASE_PROGRESS_ORDER } from '../../components/pages/build-wizard/buildWizardConstants';
import { calculateDurationDays, stepPhaseBucket, toStringOrNull } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
import { BuildTabId, StepDraftMap } from '../../types/pages/buildWizardPage';
import { BuildWizardTaskMeta } from './buildWizardPageRenderTypes';

interface UseBuildWizardStepEditActionsOptions {
  clearStepDraft: (stepId: number) => void;
  documents: IBuildWizardDocument[];
  expandPhaseRangeForStep: (step: IBuildWizardStep, overrides?: Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>) => Promise<void>;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  parseTaskMetaFromReceiptNotes: (notes: string) => { plainNotes: string; taskMeta: BuildWizardTaskMeta };
  reorderSteps: (phaseKey: string, orderedIds: number[]) => Promise<unknown>;
  setStepEditModalStepId: React.Dispatch<React.SetStateAction<number>>;
  setStepEditSaving: React.Dispatch<React.SetStateAction<boolean>>;
  stepDrafts: StepDraftMap;
  stepEditModalStep: IBuildWizardStep | null;
  stepEditSaving: boolean;
  steps: IBuildWizardStep[];
  updateStep: (stepId: number, patch: Partial<IBuildWizardStep>) => Promise<IBuildWizardStep | null | undefined>;
}

export function useBuildWizardStepEditActions({
  clearStepDraft,
  documents,
  expandPhaseRangeForStep,
  onToast,
  parseTaskMetaFromReceiptNotes,
  reorderSteps,
  setStepEditModalStepId,
  setStepEditSaving,
  stepDrafts,
  stepEditModalStep,
  stepEditSaving,
  steps,
  updateStep,
}: UseBuildWizardStepEditActionsOptions) {
  const compareStepsByTimeline = React.useCallback((
    left: IBuildWizardStep,
    right: IBuildWizardStep,
    overridesByStepId?: Map<number, Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>>,
  ): number => {
    const leftStart = toStringOrNull((overridesByStepId?.get(left.id)?.expected_start_date ?? left.expected_start_date) || '');
    const leftEnd = toStringOrNull((overridesByStepId?.get(left.id)?.expected_end_date ?? left.expected_end_date) || '');
    const rightStart = toStringOrNull((overridesByStepId?.get(right.id)?.expected_start_date ?? right.expected_start_date) || '');
    const rightEnd = toStringOrNull((overridesByStepId?.get(right.id)?.expected_end_date ?? right.expected_end_date) || '');
    const leftAnchor = leftStart || leftEnd;
    const rightAnchor = rightStart || rightEnd;
    if (leftAnchor === null && rightAnchor !== null) return 1;
    if (leftAnchor !== null && rightAnchor === null) return -1;
    if (leftAnchor !== null && rightAnchor !== null && leftAnchor !== rightAnchor) return leftAnchor.localeCompare(rightAnchor);
    if (leftStart === null && rightStart !== null) return 1;
    if (leftStart !== null && rightStart === null) return -1;
    if (leftStart !== null && rightStart !== null && leftStart !== rightStart) return leftStart.localeCompare(rightStart);
    if (leftEnd === null && rightEnd !== null) return 1;
    if (leftEnd !== null && rightEnd === null) return -1;
    if (leftEnd !== null && rightEnd !== null && leftEnd !== rightEnd) return leftEnd.localeCompare(rightEnd);
    if (left.step_order !== right.step_order) return left.step_order - right.step_order;
    return left.id - right.id;
  }, []);

  const autoReorderPhaseByTimeline = React.useCallback(async (
    phaseKey: string,
    overridesByStepId?: Map<number, Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>>,
  ) => {
    const normalizedPhase = String(phaseKey || '').trim().toLowerCase() || 'general';
    const phaseSteps = steps
      .filter((candidate) => (String(candidate.phase_key || '').trim().toLowerCase() || 'general') === normalizedPhase)
      .sort((a, b) => compareStepsByTimeline(a, b, overridesByStepId));
    const orderedIds = phaseSteps.map((candidate) => candidate.id);
    if (orderedIds.length > 1) {
      await reorderSteps(normalizedPhase, orderedIds);
    }
  }, [compareStepsByTimeline, reorderSteps, steps]);

  const refreshPhaseTimelineOrder = React.useCallback(async (phaseKey: string) => {
    const normalizedPhase = String(phaseKey || '').trim().toLowerCase() || 'general';
    const phaseStepCount = steps.filter((candidate) => (String(candidate.phase_key || '').trim().toLowerCase() || 'general') === normalizedPhase).length;
    if (phaseStepCount <= 1) {
      onToast?.({ tone: 'info', message: 'Not enough dated steps in this phase to reorder.' });
      return false;
    }
    await autoReorderPhaseByTimeline(normalizedPhase);
    onToast?.({ tone: 'success', message: 'Step order refreshed from timeline dates.' });
    return true;
  }, [autoReorderPhaseByTimeline, onToast, steps]);

  const saveStepEditModal = React.useCallback(async () => {
    if (!stepEditModalStep || stepEditSaving) return;
    const step = stepEditModalStep;
    const draft = stepDrafts[step.id] || step;
    const nextTitle = String(draft.title || '').trim();
    if (!nextTitle) {
      onToast?.({ tone: 'warning', message: 'Step title is required.' });
      return;
    }
    const nextStartDate = toStringOrNull(draft.expected_start_date || '');
    const requestedEndDate = toStringOrNull(draft.expected_end_date || '');
    const nextEndDate = nextStartDate && requestedEndDate && requestedEndDate < nextStartDate ? nextStartDate : requestedEndDate;
    const nextDurationDays = calculateDurationDays(nextStartDate, nextEndDate) ?? (draft.expected_duration_days ?? null);
    const nextDependencyIds = Array.from(new Set((Array.isArray(draft.depends_on_step_ids) ? draft.depends_on_step_ids : []).map((rawId) => Number(rawId || 0)).filter((id) => id > 0 && id !== step.id)));
    const receiptActualCostTotal = documents.reduce((sum, doc) => {
      if (Number(doc.step_id || 0) !== step.id || String(doc.kind || '').trim() !== 'receipt') return sum;
      const parsed = parseTaskMetaFromReceiptNotes(doc.receipt_notes || '');
      if (parsed.taskMeta.task_type === 'quote') return sum;
      return sum + Number(doc.receipt_amount || 0);
    }, 0);
    const requestedActualCost = draft.actual_cost ?? null;
    const nextActualCost = requestedActualCost === null ? null : Number(requestedActualCost);
    const patch: Partial<IBuildWizardStep> = {
      title: nextTitle,
      description: String(draft.description || '').trim(),
      expected_start_date: nextStartDate,
      expected_end_date: nextEndDate,
      expected_duration_days: nextDurationDays,
      estimated_cost: draft.estimated_cost ?? null,
      actual_cost: nextActualCost,
      depends_on_step_ids: nextDependencyIds,
    };
    setStepEditSaving(true);
    try {
      const nextStep = await updateStep(step.id, patch);
      if (!nextStep) return;
      const timelineOverrides = new Map<number, Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>>();
      timelineOverrides.set(step.id, { expected_start_date: nextStartDate, expected_end_date: nextEndDate });
      await autoReorderPhaseByTimeline(step.phase_key, timelineOverrides);
      await expandPhaseRangeForStep(step, timelineOverrides.get(step.id));
      clearStepDraft(step.id);
      setStepEditModalStepId(0);
      const savedWithManualActualCost = receiptActualCostTotal > 0
        && nextActualCost !== null
        && Math.abs(nextActualCost - receiptActualCostTotal) >= 0.005;
      onToast?.({
        tone: savedWithManualActualCost ? 'info' : 'success',
        message: savedWithManualActualCost
          ? 'Step updated. Actual cost is now a manual override; use refresh to sync it back to task totals.'
          : 'Step updated.',
      });
    } finally {
      setStepEditSaving(false);
    }
  }, [autoReorderPhaseByTimeline, clearStepDraft, documents, expandPhaseRangeForStep, onToast, parseTaskMetaFromReceiptNotes, setStepEditModalStepId, setStepEditSaving, stepDrafts, stepEditModalStep, stepEditSaving, updateStep]);

  return { autoReorderPhaseByTimeline, compareStepsByTimeline, refreshPhaseTimelineOrder, saveStepEditModal };
}
