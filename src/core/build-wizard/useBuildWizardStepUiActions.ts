import React from 'react';

import { IBuildWizardStep } from '../../types/buildWizard';
import { calculateDurationDays, formatDate, toStringOrNull } from '../../components/pages/build-wizard/buildWizardUtils';
import { formatCurrencyForInput, parseCurrencyText } from './buildWizardCurrencyAuditUtils';

interface UseBuildWizardStepUiActionsOptions {
  activeCurrencyInputKey: string;
  currencyInputByKey: Record<string, string>;
  setActiveCurrencyInputKey: React.Dispatch<React.SetStateAction<string>>;
  setCurrencyInputByKey: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setRefreshingActualCostByStepId: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setStepDrafts: React.Dispatch<React.SetStateAction<Record<number, IBuildWizardStep>>>;
  setStepEditModalStepId: React.Dispatch<React.SetStateAction<number>>;
  setVerifiedActualCostSignatureByStepId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  stepById: Map<number, IBuildWizardStep>;
  stepDrafts: Record<number, IBuildWizardStep>;
  stepEditModalStepId: number;
  updateStep: (stepId: number, patch: Partial<IBuildWizardStep>) => Promise<IBuildWizardStep | null | undefined>;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

export function useBuildWizardStepUiActions({
  activeCurrencyInputKey,
  currencyInputByKey,
  onToast,
  setActiveCurrencyInputKey,
  setCurrencyInputByKey,
  setRefreshingActualCostByStepId,
  setStepDrafts,
  setStepEditModalStepId,
  setVerifiedActualCostSignatureByStepId,
  stepById,
  stepDrafts,
  stepEditModalStepId,
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
    void commitStep(stepId, nextPatch);
  }, [commitStep, stepById, updateStepDraft]);

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
