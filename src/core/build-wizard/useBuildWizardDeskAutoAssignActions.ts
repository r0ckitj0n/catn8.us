import React from 'react';

import { recommendPhaseKeyForStep, stepPhaseBucket } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardStep } from '../../types/buildWizard';

interface UseBuildWizardDeskAutoAssignActionsOptions {
  aiBusy: boolean;
  deskAutoAssignBusy: boolean;
  generateStepsFromAi: (mode: 'fill_missing') => Promise<{ steps?: IBuildWizardStep[] } | null | undefined>;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  setDeskAutoAssignBusy: React.Dispatch<React.SetStateAction<boolean>>;
  steps: IBuildWizardStep[];
  updateStep: (stepId: number, patch: Partial<IBuildWizardStep>) => Promise<unknown>;
}

export function useBuildWizardDeskAutoAssignActions({
  aiBusy,
  deskAutoAssignBusy,
  generateStepsFromAi,
  onToast,
  setDeskAutoAssignBusy,
  steps,
  updateStep,
}: UseBuildWizardDeskAutoAssignActionsOptions) {
  return React.useCallback(async () => {
    if (deskAutoAssignBusy || aiBusy) {
      return;
    }
    const initialDeskSteps = steps.filter((step) => stepPhaseBucket(step) === 'desk');
    if (!initialDeskSteps.length) {
      onToast?.({ tone: 'info', message: 'No Project Desk steps are waiting for timeline placement.' });
      return;
    }

    const normalizePhaseKey = (value: string | null | undefined): string => {
      const normalized = String(value || '').trim().toLowerCase();
      return normalized === '' ? 'general' : normalized;
    };
    const orderedPhaseKeys = ['design_preconstruction', 'site_preparation', 'framing_shell', 'mep_rough_in', 'interior_finishes', 'inspections_closeout'];
    const phaseRank = new Map<string, number>(orderedPhaseKeys.map((key, index) => [key, index]));
    setDeskAutoAssignBusy(true);
    let movedCount = 0;
    let aiPlacedCount = 0;

    try {
      let candidateSteps: IBuildWizardStep[] = steps;
      const aiResponse = await generateStepsFromAi('fill_missing');
      if (Array.isArray(aiResponse?.steps) && aiResponse.steps.length > 0) {
        candidateSteps = aiResponse.steps;
      }
      const deskSteps = candidateSteps.filter((step) => stepPhaseBucket(step) === 'desk');
      aiPlacedCount = Math.max(0, initialDeskSteps.length - deskSteps.length);
      if (!deskSteps.length) {
        onToast?.({ tone: 'success', message: `Placed ${aiPlacedCount} lost step${aiPlacedCount === 1 ? '' : 's'} on the build timeline with AI.` });
        return;
      }

      const stepById = new Map<number, IBuildWizardStep>(candidateSteps.map((step) => [step.id, step]));
      const dependentById = new Map<number, number[]>();
      candidateSteps.forEach((candidate) => {
        (Array.isArray(candidate.depends_on_step_ids) ? candidate.depends_on_step_ids : []).forEach((dependencyId) => {
          const list = dependentById.get(dependencyId) || [];
          list.push(candidate.id);
          dependentById.set(dependencyId, list);
        });
      });

      const sortedDeskSteps = [...deskSteps].sort((a, b) => (a.step_order - b.step_order) || (a.id - b.id));
      const assignedByStepId = new Map<number, string>();
      const inferFromRelatedSteps = (step: IBuildWizardStep): string | null => {
        const dependencyRanks: number[] = [];
        (Array.isArray(step.depends_on_step_ids) ? step.depends_on_step_ids : []).forEach((depId) => {
          const explicit = assignedByStepId.get(depId) || normalizePhaseKey(stepById.get(depId)?.phase_key);
          const explicitRank = phaseRank.get(explicit);
          if (typeof explicitRank === 'number') {
            dependencyRanks.push(explicitRank);
            return;
          }
          const hinted = recommendPhaseKeyForStep(stepById.get(depId) || ({} as IBuildWizardStep));
          const hintRank = hinted ? phaseRank.get(hinted) : undefined;
          if (typeof hintRank === 'number') dependencyRanks.push(hintRank);
        });
        if (dependencyRanks.length) return orderedPhaseKeys[Math.max(...dependencyRanks)];

        const dependentRanks: number[] = [];
        (dependentById.get(step.id) || []).forEach((childId) => {
          const explicit = assignedByStepId.get(childId) || normalizePhaseKey(stepById.get(childId)?.phase_key);
          const explicitRank = phaseRank.get(explicit);
          if (typeof explicitRank === 'number') {
            dependentRanks.push(explicitRank);
            return;
          }
          const hinted = recommendPhaseKeyForStep(stepById.get(childId) || ({} as IBuildWizardStep));
          const hintRank = hinted ? phaseRank.get(hinted) : undefined;
          if (typeof hintRank === 'number') dependentRanks.push(hintRank);
        });
        if (dependentRanks.length) return orderedPhaseKeys[Math.max(0, Math.min(...dependentRanks) - 1)];
        return null;
      };
      const inferByOrderFallback = (step: IBuildWizardStep): string => {
        const sortedAll = [...candidateSteps].sort((a, b) => (a.step_order - b.step_order) || (a.id - b.id));
        const idx = Math.max(0, sortedAll.findIndex((candidate) => candidate.id === step.id));
        const ratio = sortedAll.length > 1 ? (idx / (sortedAll.length - 1)) : 0;
        if (ratio < 0.2) return 'design_preconstruction';
        if (ratio < 0.38) return 'site_preparation';
        if (ratio < 0.56) return 'framing_shell';
        if (ratio < 0.74) return 'mep_rough_in';
        if (ratio < 0.9) return 'interior_finishes';
        return 'inspections_closeout';
      };

      for (const step of sortedDeskSteps) {
        const suggestedPhaseKey = recommendPhaseKeyForStep(step) || inferFromRelatedSteps(step) || inferByOrderFallback(step);
        const currentPhaseKey = String(step.phase_key || '').trim().toLowerCase() || 'general';
        assignedByStepId.set(step.id, suggestedPhaseKey);
        if (currentPhaseKey !== suggestedPhaseKey) {
          await updateStep(step.id, { phase_key: suggestedPhaseKey });
          movedCount += 1;
        }
      }

      onToast?.({
        tone: 'success',
        message: `Placed ${movedCount + aiPlacedCount} lost step${movedCount + aiPlacedCount === 1 ? '' : 's'} on the build timeline.`,
      });
    } finally {
      setDeskAutoAssignBusy(false);
    }
  }, [aiBusy, deskAutoAssignBusy, generateStepsFromAi, onToast, setDeskAutoAssignBusy, steps, updateStep]);
}
