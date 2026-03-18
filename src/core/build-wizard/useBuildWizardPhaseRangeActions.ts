import React from 'react';

import { PHASE_PROGRESS_ORDER, TAB_DEFAULT_PHASE_KEY } from '../../components/pages/build-wizard/buildWizardConstants';
import { calculateDurationDays, toStringOrNull } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardStep } from '../../types/buildWizard';
import { BuildTabId } from '../../types/pages/buildWizardPage';
import { PhaseDateRange } from './buildWizardPageRenderTypes';

interface UseBuildWizardPhaseRangeActionsOptions {
  activeTab: BuildTabId;
  moveStepModalStepId: number;
  moveStepModalTargetTab: BuildTabId;
  movingStep: boolean;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  phaseDateRanges: Array<{ phase_tab?: string | null; start_date?: string | null; end_date?: string | null }>;
  projectId: number;
  savePhaseDateRange: (projectId: number, phaseTab: 'land' | 'permits' | 'site' | 'framing' | 'mep' | 'finishes', startDate: string | null, endDate: string | null) => Promise<unknown>;
  setActiveTab: React.Dispatch<React.SetStateAction<BuildTabId>>;
  setMoveStepModalStepId: React.Dispatch<React.SetStateAction<number>>;
  setMoveStepModalTargetTab: React.Dispatch<React.SetStateAction<BuildTabId>>;
  setMovingStep: React.Dispatch<React.SetStateAction<boolean>>;
  stepById: Map<number, IBuildWizardStep>;
  stepPhaseBucket: (step: IBuildWizardStep) => BuildTabId;
  steps: IBuildWizardStep[];
  updateStep: (stepId: number, patch: Partial<IBuildWizardStep>) => Promise<IBuildWizardStep | null | undefined>;
}

export function useBuildWizardPhaseRangeActions({
  activeTab,
  moveStepModalStepId,
  moveStepModalTargetTab,
  movingStep,
  onToast,
  phaseDateRanges,
  projectId,
  savePhaseDateRange,
  setActiveTab,
  setMoveStepModalStepId,
  setMoveStepModalTargetTab,
  setMovingStep,
  stepById,
  stepPhaseBucket,
  steps,
  updateStep,
}: UseBuildWizardPhaseRangeActionsOptions) {
  const derivePhaseDateRange = React.useCallback((tabId: BuildTabId): PhaseDateRange => {
    const tabSteps = steps.filter((step) => stepPhaseBucket(step) === tabId);
    const sortedStartDates = tabSteps.map((step) => toStringOrNull(step.expected_start_date || '')).filter((value): value is string => Boolean(value)).sort();
    const sortedEndCandidates = tabSteps.map((step) => toStringOrNull(step.expected_end_date || '') || toStringOrNull(step.expected_start_date || '')).filter((value): value is string => Boolean(value)).sort();
    return { start: sortedStartDates.length ? sortedStartDates[0] : null, end: sortedEndCandidates.length ? sortedEndCandidates[sortedEndCandidates.length - 1] : null };
  }, [stepPhaseBucket, steps]);

  const phaseDateRangeByTab = React.useMemo<Partial<Record<BuildTabId, PhaseDateRange>>>(() => {
    const next: Partial<Record<BuildTabId, PhaseDateRange>> = {};
    phaseDateRanges.forEach((range) => {
      const phaseTab = range.phase_tab as BuildTabId;
      if (!PHASE_PROGRESS_ORDER.includes(phaseTab)) {
        return;
      }
      next[phaseTab] = { start: toStringOrNull(range.start_date || ''), end: toStringOrNull(range.end_date || '') };
    });
    return next;
  }, [phaseDateRanges]);

  const resolvePhaseDateRange = React.useCallback((tabId: BuildTabId): PhaseDateRange => {
    const derived = derivePhaseDateRange(tabId);
    const override = phaseDateRangeByTab[tabId];
    return { start: toStringOrNull(override?.start || '') || derived.start, end: toStringOrNull(override?.end || '') || derived.end };
  }, [derivePhaseDateRange, phaseDateRangeByTab]);

  const activePhaseDateRange = React.useMemo<PhaseDateRange>(() => {
    if (!PHASE_PROGRESS_ORDER.includes(activeTab)) {
      return { start: null, end: null };
    }
    return resolvePhaseDateRange(activeTab);
  }, [activeTab, resolvePhaseDateRange]);

  const activePhaseHasStoredDateRange = React.useMemo(() => {
    if (!PHASE_PROGRESS_ORDER.includes(activeTab)) {
      return false;
    }
    const stored = phaseDateRangeByTab[activeTab];
    return Boolean(toStringOrNull(stored?.start || '') || toStringOrNull(stored?.end || ''));
  }, [activeTab, phaseDateRangeByTab]);

  const onPhaseDateRangeChange = React.useCallback((patch: Partial<PhaseDateRange>) => {
    if (!PHASE_PROGRESS_ORDER.includes(activeTab)) {
      return;
    }
    const current = resolvePhaseDateRange(activeTab);
    const nextStart = toStringOrNull((patch.start ?? current.start) || '');
    const nextEnd = toStringOrNull((patch.end ?? current.end) || '');
    if (nextStart && nextEnd && nextStart > nextEnd) {
      onToast?.({ tone: 'warning', message: 'Phase start date cannot be after phase end date.' });
      return;
    }
    const outOfRangeStep = steps.filter((step) => stepPhaseBucket(step) === activeTab).find((step) => {
      const stepStart = toStringOrNull(step.expected_start_date || '');
      const stepEnd = toStringOrNull(step.expected_end_date || '') || stepStart;
      if (nextStart && ((stepStart && stepStart < nextStart) || (stepEnd && stepEnd < nextStart))) {
        return true;
      }
      if (nextEnd && ((stepStart && stepStart > nextEnd) || (stepEnd && stepEnd > nextEnd))) {
        return true;
      }
      return false;
    });
    if (outOfRangeStep) {
      onToast?.({ tone: 'error', message: `Phase date range cannot exclude step "${outOfRangeStep.title}". Update that step's date range first.` });
      return;
    }
    void savePhaseDateRange(projectId, activeTab as 'land' | 'permits' | 'site' | 'framing' | 'mep' | 'finishes', nextStart, nextEnd);
  }, [activeTab, onToast, projectId, resolvePhaseDateRange, savePhaseDateRange, stepPhaseBucket, steps]);

  const onOpenMoveStepModal = React.useCallback((stepId: number) => {
    if (stepId <= 0) {
      return;
    }
    const step = stepById.get(stepId);
    if (!step) {
      return;
    }
    const tab = stepPhaseBucket(step);
    if (PHASE_PROGRESS_ORDER.includes(tab)) {
      setMoveStepModalTargetTab(tab);
    }
    setMoveStepModalStepId(stepId);
  }, [setMoveStepModalStepId, setMoveStepModalTargetTab, stepById, stepPhaseBucket]);

  const onMoveStepFromModal = React.useCallback(async () => {
    if (movingStep) {
      return;
    }
    const stepId = Number(moveStepModalStepId || 0);
    if (stepId <= 0) {
      onToast?.({ tone: 'warning', message: 'Choose a step to move.' });
      return;
    }
    const targetPhaseKey = String(TAB_DEFAULT_PHASE_KEY[moveStepModalTargetTab] || '').trim();
    if (!targetPhaseKey) {
      onToast?.({ tone: 'warning', message: 'Choose a valid target phase.' });
      return;
    }
    const step = stepById.get(stepId);
    if (!step) {
      onToast?.({ tone: 'warning', message: 'Selected step no longer exists.' });
      return;
    }
    if (String(step.phase_key || '').trim() === targetPhaseKey) {
      onToast?.({ tone: 'info', message: 'Step is already in that phase.' });
      return;
    }
    const startDate = toStringOrNull(step.expected_start_date || '');
    const endDate = toStringOrNull(step.expected_end_date || '');
    const patch: Partial<IBuildWizardStep> = { phase_key: targetPhaseKey, expected_start_date: startDate, expected_end_date: endDate, expected_duration_days: calculateDurationDays(startDate, endDate) ?? null };
    if (Number(step.parent_step_id || 0) > 0) {
      patch.parent_step_id = null;
    }
    setMovingStep(true);
    try {
      await updateStep(stepId, patch);
      setActiveTab(moveStepModalTargetTab);
      setMoveStepModalStepId(0);
      onToast?.({ tone: 'success', message: 'Step moved and re-placed on timeline.' });
    } finally {
      setMovingStep(false);
    }
  }, [moveStepModalStepId, moveStepModalTargetTab, movingStep, onToast, setActiveTab, setMoveStepModalStepId, setMovingStep, stepById, updateStep]);

  return { activePhaseDateRange, activePhaseHasStoredDateRange, onMoveStepFromModal, onOpenMoveStepModal, onPhaseDateRangeChange, resolvePhaseDateRange };
}
