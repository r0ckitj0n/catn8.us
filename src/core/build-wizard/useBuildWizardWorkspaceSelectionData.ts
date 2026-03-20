import React from 'react';

import { BUILD_TABS, TAB_DEFAULT_PHASE_KEY } from '../../components/pages/build-wizard/buildWizardConstants';
import { getDefaultRange, prettyPhaseLabel, sortAlpha, tabLabelShort } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
import { BuildTabId } from '../../types/pages/buildWizardPage';

const PROJECT_OVERVIEW_TAB_ORDER: BuildTabId[] = ['land', 'permits', 'site', 'framing', 'mep', 'finishes', 'desk'];

interface UseBuildWizardWorkspaceSelectionDataOptions {
  activeTab: BuildTabId;
  docPhaseKey: string;
  documents: IBuildWizardDocument[];
  filteredTabSteps: IBuildWizardStep[];
  setFooterRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
  stepPhaseBucket: (step: IBuildWizardStep) => BuildTabId;
  steps: IBuildWizardStep[];
}

export function useBuildWizardWorkspaceSelectionData({
  activeTab,
  docPhaseKey,
  documents,
  filteredTabSteps,
  setFooterRange,
  stepPhaseBucket,
  steps,
}: UseBuildWizardWorkspaceSelectionDataOptions) {
  const footerTimelineSteps = React.useMemo(() => (
    activeTab === 'start' || activeTab === 'completed' || activeTab === 'overview' ? steps : filteredTabSteps
  ), [activeTab, filteredTabSteps, steps]);

  React.useEffect(() => {
    const next = getDefaultRange(footerTimelineSteps.length ? footerTimelineSteps : steps);
    setFooterRange(next);
  }, [footerTimelineSteps, setFooterRange, steps]);

  const compareStepsByTimeline = React.useCallback((left: IBuildWizardStep, right: IBuildWizardStep): number => {
    const leftStart = String(left.expected_start_date || '').trim() || null;
    const leftEnd = String(left.expected_end_date || '').trim() || null;
    const rightStart = String(right.expected_start_date || '').trim() || null;
    const rightEnd = String(right.expected_end_date || '').trim() || null;
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

  const selectableDocSteps = React.useMemo(() => {
    const filtered = !docPhaseKey || docPhaseKey === 'general' ? steps : steps.filter((step) => String(step.phase_key || 'general') === docPhaseKey);
    return [...filtered].sort((a, b) => {
      const phaseCmp = sortAlpha(prettyPhaseLabel(a.phase_key), prettyPhaseLabel(b.phase_key));
      if (phaseCmp !== 0) {
        return phaseCmp;
      }
      return compareStepsByTimeline(a, b);
    });
  }, [compareStepsByTimeline, docPhaseKey, steps]);

  const linkedStepOptions = React.useMemo(() => {
    const tabOrder = new Map<BuildTabId, number>();
    PROJECT_OVERVIEW_TAB_ORDER.forEach((tabId, index) => tabOrder.set(tabId, index));
    const stepsByTab = new Map<BuildTabId, IBuildWizardStep[]>();
    steps.forEach((step) => {
      const tabId = stepPhaseBucket(step);
      const bucket = stepsByTab.get(tabId) || [];
      bucket.push(step);
      stepsByTab.set(tabId, bucket);
    });
    const options: Array<{ step: IBuildWizardStep; displayNumber: number; sortKey: string; label: string }> = [];
    Array.from(stepsByTab.entries()).sort((a, b) => {
      const aOrder = tabOrder.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = tabOrder.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
      return aOrder !== bOrder ? aOrder - bOrder : sortAlpha(tabLabelShort(a[0]), tabLabelShort(b[0]));
    }).forEach(([tabId, tabSteps]) => {
      const ordered = [...tabSteps].sort(compareStepsByTimeline);
      const tabLabel = BUILD_TABS.find((candidate) => candidate.id === tabId)?.label || prettyPhaseLabel(TAB_DEFAULT_PHASE_KEY[tabId] || tabId);
      const phaseNumberMatch = tabLabel.match(/^(\d+)\./);
      const phasePrefix = phaseNumberMatch ? `Phase ${phaseNumberMatch[1]}` : (tabId === 'desk' ? 'Project Desk' : tabLabel);
      ordered.forEach((step, index) => {
        options.push({ step, displayNumber: index + 1, sortKey: `${String(tabOrder.get(tabId) ?? Number.MAX_SAFE_INTEGER).padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`, label: `${phasePrefix}, Step ${index + 1}: ${String(step.title || '').trim()}`.trim() });
      });
    });
    return options;
  }, [compareStepsByTimeline, stepPhaseBucket, steps]);

  const linkedStepDisplayNumberById = React.useMemo(() => {
    const next = new Map<number, number>();
    linkedStepOptions.forEach((option) => next.set(option.step.id, option.displayNumber));
    return next;
  }, [linkedStepOptions]);

  const attachableProjectDocuments = React.useMemo(() => documents.filter((doc) => String(doc.kind || '').trim() !== 'receipt_attachment').sort((a, b) => {
    const nameCmp = sortAlpha(String(a.original_name || ''), String(b.original_name || ''));
    if (nameCmp !== 0) {
      return nameCmp;
    }
    return Number(a.id || 0) - Number(b.id || 0);
  }), [documents]);

  return { attachableProjectDocuments, footerTimelineSteps, linkedStepDisplayNumberById, linkedStepOptions, selectableDocSteps };
}
