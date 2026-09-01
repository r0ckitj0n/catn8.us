import React from 'react';

import { phaseKeysMatch } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardStep } from '../../types/buildWizard';

interface UseBuildWizardStepDragActionsOptions {
  activeTabTreeRows: Array<{ step: IBuildWizardStep }>;
  clampStepDatesWithinRange: (
    step: Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>,
    minDate?: string | null,
    maxDate?: string | null,
  ) => Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date' | 'expected_duration_days'> | null;
  draggingStepId: number;
  setDragOverInsertIndex: React.Dispatch<React.SetStateAction<number>>;
  setDragOverParentStepId: React.Dispatch<React.SetStateAction<number>>;
  setDraggingStepId: React.Dispatch<React.SetStateAction<number>>;
  stepById: Map<number, IBuildWizardStep>;
  steps: IBuildWizardStep[];
  updateStep: (stepId: number, patch: Partial<IBuildWizardStep>) => Promise<IBuildWizardStep | null | undefined>;
  reorderSteps: (phaseKey: string, orderedIds: number[]) => Promise<unknown>;
}

export function useBuildWizardStepDragActions({
  activeTabTreeRows,
  clampStepDatesWithinRange,
  draggingStepId,
  reorderSteps,
  setDragOverInsertIndex,
  setDragOverParentStepId,
  setDraggingStepId,
  stepById,
  steps,
  updateStep,
}: UseBuildWizardStepDragActionsOptions) {
  const clearStepDragState = React.useCallback(() => {
    setDraggingStepId(0);
    setDragOverInsertIndex(-1);
    setDragOverParentStepId(0);
  }, [setDragOverInsertIndex, setDragOverParentStepId, setDraggingStepId]);

  const beginStepDrag = React.useCallback((e: React.DragEvent<HTMLElement>, stepId: number, stepReadOnly: boolean): void => {
    if (stepReadOnly || stepId <= 0) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(stepId));
    setDraggingStepId(stepId);
  }, [setDraggingStepId]);

  const buildPhaseReorderIds = React.useCallback((phaseKey: string, preferredIds: number[], movedStepId: number, movedStepPhaseKey: string): number[] => {
    const normalizedPhase = String(phaseKey || '').trim();
    if (!normalizedPhase) return [];
    const phaseMembers = [...steps].filter((candidate) => candidate.id === movedStepId ? phaseKeysMatch(movedStepPhaseKey, normalizedPhase) : phaseKeysMatch(candidate.phase_key, normalizedPhase)).sort((a, b) => (a.step_order - b.step_order) || (a.id - b.id)).map((candidate) => candidate.id);
    const memberSet = new Set(phaseMembers);
    const preferredUnique: number[] = [];
    preferredIds.forEach((id) => {
      const stepId = Number(id || 0);
      if (stepId > 0 && memberSet.has(stepId) && !preferredUnique.includes(stepId)) preferredUnique.push(stepId);
    });
    return [...preferredUnique, ...phaseMembers.filter((id) => !preferredUnique.includes(id))];
  }, [steps]);

  const onDropReorder = React.useCallback(async (insertIndex: number) => {
    if (draggingStepId <= 0) {
      clearStepDragState();
      return;
    }
    const flatIds = activeTabTreeRows.map((row) => row.step.id);
    if (!flatIds.includes(draggingStepId)) {
      clearStepDragState();
      return;
    }
    const draggedStep = stepById.get(draggingStepId);
    if (!draggedStep) {
      clearStepDragState();
      return;
    }
    const withoutDragged = flatIds.filter((id) => id !== draggingStepId);
    const boundedInsertIndex = Math.max(0, Math.min(insertIndex, withoutDragged.length));
    withoutDragged.splice(boundedInsertIndex, 0, draggingStepId);
    const previousVisibleStep = boundedInsertIndex > 0 ? (stepById.get(withoutDragged[boundedInsertIndex - 1]) || null) : null;
    const nextVisibleStep = boundedInsertIndex < (withoutDragged.length - 1) ? (stepById.get(withoutDragged[boundedInsertIndex + 1]) || null) : null;
    const destinationPhaseKey = previousVisibleStep?.phase_key || nextVisibleStep?.phase_key || draggedStep.phase_key || '';
    if (!destinationPhaseKey) {
      clearStepDragState();
      return;
    }
    const preferredPhaseOrder = withoutDragged.filter((id) => id === draggingStepId || phaseKeysMatch(stepById.get(id)?.phase_key, destinationPhaseKey));
    const phaseOrderedIds = buildPhaseReorderIds(destinationPhaseKey, preferredPhaseOrder, draggingStepId, destinationPhaseKey);
    try {
      if (!phaseKeysMatch(draggedStep.phase_key, destinationPhaseKey) || Number(draggedStep.parent_step_id || 0) > 0) {
        await updateStep(draggingStepId, { phase_key: destinationPhaseKey, parent_step_id: null });
      }
      if (phaseOrderedIds.length > 0) {
        await reorderSteps(destinationPhaseKey, phaseOrderedIds);
        const movedIndex = phaseOrderedIds.indexOf(draggingStepId);
        const prevPhaseStep = movedIndex > 0 ? (stepById.get(phaseOrderedIds[movedIndex - 1]) || null) : null;
        const nextPhaseStep = movedIndex >= 0 && movedIndex < (phaseOrderedIds.length - 1) ? (stepById.get(phaseOrderedIds[movedIndex + 1]) || null) : null;
        const datePatch = clampStepDatesWithinRange(
          draggedStep,
          prevPhaseStep?.expected_end_date || prevPhaseStep?.expected_start_date || null,
          nextPhaseStep?.expected_start_date || nextPhaseStep?.expected_end_date || null,
        );
        if (datePatch) await updateStep(draggingStepId, datePatch);
      }
    } finally {
      clearStepDragState();
    }
  }, [activeTabTreeRows, buildPhaseReorderIds, clampStepDatesWithinRange, clearStepDragState, draggingStepId, reorderSteps, stepById, updateStep]);

  const onDropMakeChild = React.useCallback(async (targetStepId: number) => {
    if (draggingStepId <= 0 || targetStepId <= 0 || draggingStepId === targetStepId) {
      clearStepDragState();
      return;
    }
    const flatIds = activeTabTreeRows.map((row) => row.step.id);
    if (!flatIds.includes(draggingStepId) || !flatIds.includes(targetStepId)) {
      clearStepDragState();
      return;
    }
    const draggedStep = stepById.get(draggingStepId);
    const targetStep = stepById.get(targetStepId);
    const targetPhaseKey = targetStep?.phase_key || '';
    if (!draggedStep || !targetStep || !targetPhaseKey) {
      clearStepDragState();
      return;
    }
    const withoutDragged = flatIds.filter((id) => id !== draggingStepId);
    const targetIndex = withoutDragged.indexOf(targetStepId);
    withoutDragged.splice(targetIndex >= 0 ? targetIndex + 1 : withoutDragged.length, 0, draggingStepId);
    const preferredPhaseOrder = withoutDragged.filter((id) => id === draggingStepId || phaseKeysMatch(stepById.get(id)?.phase_key, targetPhaseKey));
    const phaseOrderedIds = buildPhaseReorderIds(targetPhaseKey, preferredPhaseOrder, draggingStepId, targetPhaseKey);
    try {
      if (!phaseKeysMatch(draggedStep.phase_key, targetPhaseKey)) await updateStep(draggingStepId, { phase_key: targetPhaseKey });
      await updateStep(draggingStepId, { ...(clampStepDatesWithinRange(draggedStep, targetStep.expected_start_date, targetStep.expected_end_date) || {}), parent_step_id: targetStepId });
      if (phaseOrderedIds.length > 0) await reorderSteps(targetPhaseKey, phaseOrderedIds);
    } finally {
      clearStepDragState();
    }
  }, [activeTabTreeRows, buildPhaseReorderIds, clampStepDatesWithinRange, clearStepDragState, draggingStepId, reorderSteps, stepById, updateStep]);

  return { beginStepDrag, clearStepDragState, onDropMakeChild, onDropReorder };
}
