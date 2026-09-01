import React from 'react';

import { IBuildWizardStep } from '../../types/buildWizard';
import { calculateDurationDays, formatDate, phaseKeysMatch, toStringOrNull } from '../../components/pages/build-wizard/buildWizardUtils';
import { formatCurrencyForInput, parseCurrencyText } from './buildWizardCurrencyAuditUtils';

interface UseBuildWizardStepUiActionsOptions {
  activeCurrencyInputKey: string;
  currencyInputByKey: Record<string, string>;
  reorderSteps: (phaseKey: string, orderedIds: number[]) => Promise<unknown>;
  setActiveCurrencyInputKey: React.Dispatch<React.SetStateAction<string>>;
  setCurrencyInputByKey: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setRefreshingActualCostByStepId: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setStepDrafts: React.Dispatch<React.SetStateAction<Record<number, IBuildWizardStep>>>;
  setStepEditModalStepId: React.Dispatch<React.SetStateAction<number>>;
  setVerifiedActualCostSignatureByStepId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  stepById: Map<number, IBuildWizardStep>;
  stepDrafts: Record<number, IBuildWizardStep>;
  stepEditModalStepId: number;
  steps: IBuildWizardStep[];
  updateStep: (stepId: number, patch: Partial<IBuildWizardStep>) => Promise<IBuildWizardStep | null | undefined>;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

export function useBuildWizardStepUiActions({
  activeCurrencyInputKey,
  currencyInputByKey,
  onToast,
  reorderSteps,
  setActiveCurrencyInputKey,
  setCurrencyInputByKey,
  setRefreshingActualCostByStepId,
  setStepDrafts,
  setStepEditModalStepId,
  setVerifiedActualCostSignatureByStepId,
  stepById,
  stepDrafts,
  stepEditModalStepId,
  steps,
  updateStep,
}: UseBuildWizardStepUiActionsOptions) {
  const updateStepDraft = React.useCallback((stepId: number, patch: Partial<IBuildWizardStep>) => {
    setStepDrafts((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] || ({} as IBuildWizardStep)),
        ...patch,
      },
    }));
  }, [setStepDrafts]);

  const clearStepDraft = React.useCallback((stepId: number) => {
    setStepDrafts((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, stepId)) {
        return prev;
      }
      const next = { ...prev };
      delete next[stepId];
      return next;
    });
  }, [setStepDrafts]);

  const openStepEditModal = React.useCallback((step: IBuildWizardStep) => {
    setStepDrafts((prev) => ({
      ...prev,
      [step.id]: { ...step },
    }));
    setStepEditModalStepId(step.id);
  }, [setStepDrafts, setStepEditModalStepId]);

  const closeStepEditModal = React.useCallback((stepId?: number) => {
    const targetStepId = typeof stepId === 'number' && stepId > 0 ? stepId : stepEditModalStepId;
    if (targetStepId > 0) {
      clearStepDraft(targetStepId);
    }
    setStepEditModalStepId(0);
  }, [clearStepDraft, setStepEditModalStepId, stepEditModalStepId]);

  const commitStep = React.useCallback(async (stepId: number, patch: Partial<IBuildWizardStep>) => {
    await updateStep(stepId, patch);
  }, [updateStep]);

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
      .filter((candidate) => phaseKeysMatch(candidate.phase_key, normalizedPhase))
      .sort((a, b) => compareStepsByTimeline(a, b, overridesByStepId));
    const orderedIds = phaseSteps.map((candidate) => candidate.id);
    if (orderedIds.length > 1) {
      await reorderSteps(normalizedPhase, orderedIds);
    }
  }, [compareStepsByTimeline, reorderSteps, steps]);

  const clearCurrencyEdit = React.useCallback((key: string): void => {
    if (activeCurrencyInputKey === key) {
      setActiveCurrencyInputKey('');
    }
    setCurrencyInputByKey((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, [activeCurrencyInputKey, setActiveCurrencyInputKey, setCurrencyInputByKey]);

  const markStepActualCostVerified = React.useCallback((stepId: number, signature: string) => {
    setVerifiedActualCostSignatureByStepId((prev) => ({ ...prev, [stepId]: signature }));
  }, [setVerifiedActualCostSignatureByStepId]);

  const onRefreshStepActualCost = React.useCallback(async (
    step: IBuildWizardStep,
    signature: string,
    nextActualCost: number | null,
  ) => {
    const stepId = step.id;
    if (stepId <= 0) {
      return;
    }
    setRefreshingActualCostByStepId((prev) => ({ ...prev, [stepId]: true }));
    try {
      const nextStep = await updateStep(stepId, { actual_cost: nextActualCost });
      if (!nextStep) {
        return;
      }
      updateStepDraft(stepId, { actual_cost: nextActualCost });
      clearCurrencyEdit(`step-${stepId}-actual_cost`);
      markStepActualCostVerified(stepId, signature);
      onToast?.({ tone: 'success', message: 'Actual cost refreshed from task totals.' });
    } finally {
      setRefreshingActualCostByStepId((prev) => {
        const next = { ...prev };
        delete next[stepId];
        return next;
      });
    }
  }, [clearCurrencyEdit, markStepActualCostVerified, onToast, setRefreshingActualCostByStepId, updateStep, updateStepDraft]);

  const onTimelineStepChange = React.useCallback((stepId: number, patch: {
    expected_start_date: string | null;
    expected_end_date: string | null;
    expected_duration_days: number | null;
  }) => {
    const step = stepById.get(stepId);
    if (!step || Number(step.is_completed) === 1) {
      return;
    }
    const nextStart = toStringOrNull(patch.expected_start_date || '');
    const nextEnd = toStringOrNull(patch.expected_end_date || '');
    const normalizedEnd = (nextStart && nextEnd && nextEnd < nextStart) ? nextStart : nextEnd;
    const nextPatch = {
      ...patch,
      expected_start_date: nextStart,
      expected_end_date: normalizedEnd,
      expected_duration_days: calculateDurationDays(nextStart, normalizedEnd) ?? patch.expected_duration_days,
    };
    updateStepDraft(stepId, nextPatch);
    void (async () => {
      await commitStep(stepId, nextPatch);
      const timelineOverrides = new Map<number, Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>>();
      timelineOverrides.set(step.id, { expected_start_date: nextStart, expected_end_date: normalizedEnd });
      await autoReorderPhaseByTimeline(step.phase_key, timelineOverrides);
    })();
  }, [autoReorderPhaseByTimeline, commitStep, stepById, updateStepDraft]);

  const noteEditedAtLabel = React.useCallback((note: { created_at: string; updated_at?: string | null }): string => {
    const createdAt = String(note.created_at || '').trim();
    const updatedAt = String(note.updated_at || '').trim();
    if (!createdAt || !updatedAt || createdAt === updatedAt) {
      return '';
    }
    return formatDate(updatedAt);
  }, []);

  const startCurrencyEdit = React.useCallback((key: string, value: number | null | undefined): void => {
    setActiveCurrencyInputKey(key);
    setCurrencyInputByKey((prev) => ({
      ...prev,
      [key]: value === null || typeof value === 'undefined' || Number.isNaN(Number(value))
        ? ''
        : String(value),
    }));
  }, [setActiveCurrencyInputKey, setCurrencyInputByKey]);

  const changeCurrencyEdit = React.useCallback((key: string, text: string): void => {
    setCurrencyInputByKey((prev) => ({ ...prev, [key]: text }));
  }, [setCurrencyInputByKey]);

  const finishCurrencyEdit = React.useCallback((key: string, onCommit: (value: number | null) => void): void => {
    const parsed = parseCurrencyText(currencyInputByKey[key] ?? '');
    onCommit(parsed);
    if (activeCurrencyInputKey === key) {
      setActiveCurrencyInputKey('');
    }
    setCurrencyInputByKey((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, [activeCurrencyInputKey, currencyInputByKey, setActiveCurrencyInputKey, setCurrencyInputByKey]);

  const renderCurrencyInputValue = React.useCallback((key: string, value: number | null | undefined): string => {
    if (activeCurrencyInputKey === key) {
      return currencyInputByKey[key] ?? (value === null || typeof value === 'undefined' ? '' : String(value));
    }
    return formatCurrencyForInput(value);
  }, [activeCurrencyInputKey, currencyInputByKey]);

  return {
    changeCurrencyEdit,
    clearStepDraft,
    closeStepEditModal,
    commitStep,
    finishCurrencyEdit,
    noteEditedAtLabel,
    onRefreshStepActualCost,
    onTimelineStepChange,
    openStepEditModal,
    renderCurrencyInputValue,
    startCurrencyEdit,
    updateStepDraft,
  };
}
