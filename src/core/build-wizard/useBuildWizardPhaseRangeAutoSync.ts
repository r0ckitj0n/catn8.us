import React from 'react';

import { IBuildWizardStep } from '../../types/buildWizard';
import { BuildTabId } from '../../types/pages/buildWizardPage';

interface UseBuildWizardPhaseRangeAutoSyncOptions {
  projectId: number;
  resolvePhaseDateRange: (tab: BuildTabId) => { start: string | null; end: string | null };
  savePhaseDateRange: (
    projectId: number,
    phaseKey: 'land' | 'permits' | 'site' | 'framing' | 'mep' | 'finishes',
    start: string | null,
    end: string | null,
  ) => Promise<unknown>;
  stepPhaseBucket: (step: IBuildWizardStep) => BuildTabId;
  steps: IBuildWizardStep[];
  toStringOrNull: (value: unknown) => string | null;
}

const AUTO_SYNC_PHASES: BuildTabId[] = ['land', 'permits', 'site', 'framing', 'mep', 'finishes'];

export function useBuildWizardPhaseRangeAutoSync({
  projectId,
  resolvePhaseDateRange,
  savePhaseDateRange,
  stepPhaseBucket,
  steps,
  toStringOrNull,
}: UseBuildWizardPhaseRangeAutoSyncOptions) {
  React.useEffect(() => {
    if (projectId <= 0 || steps.length === 0) {
      return;
    }
    void (async () => {
      const phaseTabs = Array.from(new Set(steps.map((step) => stepPhaseBucket(step)).filter((tab) => AUTO_SYNC_PHASES.includes(tab))));
      for (const phaseTab of phaseTabs) {
        const phaseSteps = steps.filter((step) => stepPhaseBucket(step) === phaseTab);
        const phaseAnchors = phaseSteps
          .map((step) => {
            const start = toStringOrNull(step.expected_start_date || '');
            const end = toStringOrNull(step.expected_end_date || '') || start;
            return { start, end };
          })
          .filter((entry) => entry.start || entry.end);
        if (phaseAnchors.length === 0) {
          continue;
        }
        const minStepDate = phaseAnchors
          .map((entry) => entry.start || entry.end)
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => a.localeCompare(b))[0] || null;
        const maxStepDate = phaseAnchors
          .map((entry) => entry.end || entry.start)
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => a.localeCompare(b))
          .pop() || null;
        const current = resolvePhaseDateRange(phaseTab);
        const nextStart = minStepDate
          ? (current.start ? (minStepDate < current.start ? minStepDate : current.start) : minStepDate)
          : current.start;
        const nextEnd = maxStepDate
          ? (current.end ? (maxStepDate > current.end ? maxStepDate : current.end) : maxStepDate)
          : current.end;
        if (nextStart !== current.start || nextEnd !== current.end) {
          await savePhaseDateRange(projectId, phaseTab as 'land' | 'permits' | 'site' | 'framing' | 'mep' | 'finishes', nextStart, nextEnd);
        }
      }
    })();
  }, [projectId, resolvePhaseDateRange, savePhaseDateRange, stepPhaseBucket, steps, toStringOrNull]);
}
