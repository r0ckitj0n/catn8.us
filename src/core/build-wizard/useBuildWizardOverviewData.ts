import React from 'react';

import { BUILD_TABS, PHASE_PROGRESS_ORDER, TAB_PHASE_COLORS } from '../../components/pages/build-wizard/buildWizardConstants';
import { calculateDurationDays, getDefaultRange, parseDate, stepDateRange, tabLabelShort, toIsoDate } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardStep } from '../../types/buildWizard';
import { BuildTabId } from '../../types/pages/buildWizardPage';
import { ProjectOverviewPhaseSection, ProjectOverviewStepRow } from './buildWizardPageRenderTypes';

const PROJECT_OVERVIEW_TAB_ORDER: BuildTabId[] = [...PHASE_PROGRESS_ORDER, 'desk'];

interface UseBuildWizardOverviewDataOptions {
  activeTab: BuildTabId;
  documents: Array<{ step_id?: number | null }>;
  filteredTabSteps: IBuildWizardStep[];
  getStepActualExcludingQuotes: (step: IBuildWizardStep) => number;
  getStepEstimatedExcludingQuotes: (step: IBuildWizardStep) => number;
  isAiEstimatedField: (step: IBuildWizardStep, field: string) => boolean;
  project: { target_start_date?: string | null; target_completion_date?: string | null } | null;
  stepAssigneesByStepId: Map<number, unknown[]>;
  stepPhaseBucket: (step: IBuildWizardStep) => BuildTabId;
  steps: IBuildWizardStep[];
}

export function useBuildWizardOverviewData({
  activeTab,
  documents,
  filteredTabSteps,
  getStepActualExcludingQuotes,
  getStepEstimatedExcludingQuotes,
  isAiEstimatedField,
  project,
  stepAssigneesByStepId,
  stepPhaseBucket,
  steps,
}: UseBuildWizardOverviewDataOptions) {
  const stepCostTotalExcludingQuotes = React.useCallback((step: IBuildWizardStep): number => {
    const actual = getStepActualExcludingQuotes(step);
    return actual > 0 ? actual : getStepEstimatedExcludingQuotes(step);
  }, [getStepActualExcludingQuotes, getStepEstimatedExcludingQuotes]);

  const phaseTotals = React.useMemo(() => {
    if (!PHASE_PROGRESS_ORDER.includes(activeTab)) {
      return { phaseTotal: 0, projectToDateTotal: 0 };
    }
    const phaseOrderIndex = PHASE_PROGRESS_ORDER.indexOf(activeTab);
    const phaseTotal = filteredTabSteps.reduce((sum, step) => sum + stepCostTotalExcludingQuotes(step), 0);
    const projectToDateTotal = steps.reduce((sum, step) => {
      const stepOrderIndex = PHASE_PROGRESS_ORDER.indexOf(stepPhaseBucket(step));
      return stepOrderIndex >= 0 && stepOrderIndex <= phaseOrderIndex ? sum + stepCostTotalExcludingQuotes(step) : sum;
    }, 0);
    return { phaseTotal, projectToDateTotal };
  }, [activeTab, filteredTabSteps, stepCostTotalExcludingQuotes, stepPhaseBucket, steps]);

  const stepDocumentCountByStepId = React.useMemo(() => {
    const map = new Map<number, number>();
    documents.forEach((documentItem) => {
      const linkedStepId = Number(documentItem.step_id || 0);
      if (linkedStepId > 0) {
        map.set(linkedStepId, (map.get(linkedStepId) || 0) + 1);
      }
    });
    return map;
  }, [documents]);

  const projectOverviewRange = React.useMemo(() => getDefaultRange(steps), [steps]);

  const projectOverviewSections = React.useMemo<ProjectOverviewPhaseSection[]>(() => {
    const rangeStartDate = parseDate(projectOverviewRange.start);
    const rangeEndDate = parseDate(projectOverviewRange.end);
    const hasRange = Boolean(rangeStartDate && rangeEndDate && rangeEndDate.getTime() >= rangeStartDate.getTime());
    const totalDays = hasRange ? Math.max(1, Math.round((rangeEndDate!.getTime() - rangeStartDate!.getTime()) / 86400000) + 1) : 1;

    return PROJECT_OVERVIEW_TAB_ORDER.map((tabId) => {
      const phaseSteps = steps.filter((step) => stepPhaseBucket(step) === tabId).sort((a, b) => (a.step_order - b.step_order) || (a.id - b.id));
      const rows: ProjectOverviewStepRow[] = phaseSteps.map((step, index) => {
        const range = stepDateRange(step);
        const startIso = range.start ? toIsoDate(range.start) : null;
        const endIso = range.end ? toIsoDate(range.end) : null;
        const hasTimeline = Boolean(startIso && endIso && hasRange);
        let leftPercent = 0;
        let widthPercent = 0;
        if (hasTimeline && rangeStartDate && range.start && range.end) {
          const clampedStartMs = Math.max(rangeStartDate.getTime(), range.start.getTime());
          const clampedEndMs = Math.min(rangeEndDate!.getTime(), range.end.getTime());
          if (clampedEndMs >= clampedStartMs) {
            const leftDays = Math.max(0, Math.round((clampedStartMs - rangeStartDate.getTime()) / 86400000));
            const widthDays = Math.max(1, Math.round((clampedEndMs - clampedStartMs) / 86400000) + 1);
            leftPercent = (leftDays / totalDays) * 100;
            widthPercent = (widthDays / totalDays) * 100;
          }
        }
        const actualCost = Number(step.actual_cost);
        const estimatedCost = Number(step.estimated_cost);
        const costMode: ProjectOverviewStepRow['costMode'] = Number.isFinite(actualCost) && actualCost > 0 ? 'actual' : (Number.isFinite(estimatedCost) && estimatedCost > 0 ? 'estimated' : 'missing');
        return {
          stepId: step.id,
          displayOrder: index + 1,
          title: step.title,
          stepType: step.step_type,
          startIso,
          endIso,
          durationDays: calculateDurationDays(startIso, endIso),
          totalCost: stepCostTotalExcludingQuotes(step),
          costMode,
          assigneeCount: (stepAssigneesByStepId.get(step.id) || []).length,
          documentCount: stepDocumentCountByStepId.get(step.id) || 0,
          isCompleted: Number(step.is_completed) === 1,
          hasTimeline,
          leftPercent,
          widthPercent,
        };
      });

      const rowStarts = rows.map((row) => row.startIso).filter((value): value is string => Boolean(value)).sort();
      const rowEnds = rows.map((row) => row.endIso).filter((value): value is string => Boolean(value)).sort();
      return {
        tabId,
        label: tabLabelShort(tabId),
        phaseColor: TAB_PHASE_COLORS[tabId],
        stepCount: rows.length,
        completedCount: rows.filter((row) => row.isCompleted).length,
        totalCost: rows.reduce((sum, row) => sum + row.totalCost, 0),
        startIso: rowStarts.length ? rowStarts[0] : null,
        endIso: rowEnds.length ? rowEnds[rowEnds.length - 1] : null,
        rows,
      };
    }).filter((section) => section.stepCount > 0);
  }, [projectOverviewRange.end, projectOverviewRange.start, stepAssigneesByStepId, stepCostTotalExcludingQuotes, stepDocumentCountByStepId, stepPhaseBucket, steps]);

  const projectOverviewTotals = React.useMemo(() => (
    projectOverviewSections.reduce((totals, section) => {
      totals.stepCount += section.stepCount;
      totals.completedCount += section.completedCount;
      totals.totalCost += section.totalCost;
      return totals;
    }, { stepCount: 0, completedCount: 0, totalCost: 0 })
  ), [projectOverviewSections]);

  const projectTotals = React.useMemo(() => {
    const totalEstimated = steps.reduce((sum, step) => sum + getStepEstimatedExcludingQuotes(step), 0);
    const totalActual = steps.reduce((sum, step) => sum + getStepActualExcludingQuotes(step), 0);
    const doneCount = steps.filter((step) => Number(step.is_completed) === 1).length;
    return { totalEstimated, totalActual, doneCount, totalCount: steps.length };
  }, [getStepActualExcludingQuotes, getStepEstimatedExcludingQuotes, steps]);

  const overviewMetrics = React.useMemo(() => {
    const today = new Date();
    const todayIso = toIsoDate(today);
    const projectStart = parseDate(project?.target_start_date || null);
    const timelineStart = steps.map((step) => parseDate(step.expected_start_date) || parseDate(step.expected_end_date)).filter(Boolean).sort((a, b) => (a!.getTime() - b!.getTime()))[0] || null;
    const startDate = projectStart || timelineStart;
    const startCountdownDays = startDate ? Math.round((startDate.getTime() - parseDate(todayIso)!.getTime()) / 86400000) : null;
    const projectEnd = parseDate(project?.target_completion_date || null);
    const timelineEnd = steps.map((step) => parseDate(step.expected_end_date) || parseDate(step.expected_start_date)).filter(Boolean).sort((a, b) => (a!.getTime() - b!.getTime())).pop() || null;
    const endDate = projectEnd || timelineEnd;
    const endCountdownDays = endDate ? Math.round((endDate.getTime() - parseDate(todayIso)!.getTime()) / 86400000) : null;
    const nextStepBase = steps.filter((step) => Number(step.is_completed) !== 1).map((step) => ({ step, start: parseDate(step.expected_start_date), end: parseDate(step.expected_end_date) })).filter((row) => row.start || row.end).sort((a, b) => ((a.start || a.end)!.getTime() - (b.start || b.end)!.getTime()))[0] || null;
    const nextStep = nextStepBase ? (() => {
      const phaseTabId = stepPhaseBucket(nextStepBase.step);
      const phaseLabel = BUILD_TABS.find((tab) => tab.id === phaseTabId)?.label || tabLabelShort(phaseTabId);
      const phaseStepNumber = steps.filter((step) => stepPhaseBucket(step) === phaseTabId).sort((a, b) => Number(a.step_order) - Number(b.step_order)).findIndex((step) => step.id === nextStepBase.step.id) + 1;
      return { ...nextStepBase, phaseLabel, phaseStepNumber: phaseStepNumber > 0 ? phaseStepNumber : null };
    })() : null;
    const spentActual = steps.reduce((sum, step) => sum + getStepActualExcludingQuotes(step), 0);
    const projectedTotal = steps.reduce((sum, step) => sum + (getStepActualExcludingQuotes(step) > 0 ? getStepActualExcludingQuotes(step) : getStepEstimatedExcludingQuotes(step)), 0);
    return {
      startDate: startDate ? toIsoDate(startDate) : null,
      startCountdownDays,
      endDate: endDate ? toIsoDate(endDate) : null,
      endCountdownDays,
      nextStep,
      spentActual,
      projectedTotal,
      remainingProjected: Math.max(0, projectedTotal - spentActual),
      aiEstimatedCostSteps: steps.filter((step) => isAiEstimatedField(step, 'estimated_cost')).length,
      missingEstimateCount: steps.filter((step) => Number(step.actual_cost ?? 0) <= 0 && Number(step.estimated_cost ?? 0) <= 0).length,
      missingTimelineCount: steps.filter((step) => !step.expected_start_date || !step.expected_end_date).length,
    };
  }, [getStepActualExcludingQuotes, getStepEstimatedExcludingQuotes, isAiEstimatedField, project?.target_completion_date, project?.target_start_date, stepPhaseBucket, steps]);

  return {
    overviewMetrics,
    phaseTotals,
    projectOverviewRange,
    projectOverviewSections,
    projectOverviewTotals,
    projectTotals,
    stepCostTotalExcludingQuotes,
  };
}
