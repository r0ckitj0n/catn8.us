import { IBuildWizardStep } from '../../../types/buildWizard';
import { BuildTabId, StepType } from '../../../types/pages/buildWizardPage';

export const BUILD_TABS: Array<{ id: BuildTabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'start', label: '1. Start' },
  { id: 'land', label: '2. Planning & Pre-Construction' },
  { id: 'permits', label: '3. Site Prep & Foundation' },
  { id: 'site', label: '4. Framing & Exterior' },
  { id: 'framing', label: '5. MEP & Rough-Ins' },
  { id: 'mep', label: '6. Finishes & Fixtures' },
  { id: 'finishes', label: '7. Final Inspections & Closeout' },
  { id: 'desk', label: 'Project Desk' },
  { id: 'completed', label: '8. Completed' },
];

export const PHASE_PROGRESS_ORDER: BuildTabId[] = ['land', 'permits', 'site', 'framing', 'mep', 'finishes'];

export const TAB_PHASE_COLORS: Record<BuildTabId, string> = {
  overview: 'var(--catn8-bw-overview-color)',
  start: 'var(--catn8-bw-start-color)',
  land: 'var(--catn8-bw-land-color)',
  permits: 'var(--catn8-bw-permits-color)',
  site: 'var(--catn8-bw-site-color)',
  framing: 'var(--catn8-bw-framing-color)',
  mep: 'var(--catn8-bw-mep-color)',
  finishes: 'var(--catn8-bw-finishes-color)',
  desk: 'var(--catn8-bw-desk-color)',
  completed: 'var(--catn8-bw-completed-color)',
};

export const TAB_DEFAULT_PHASE_KEY: Partial<Record<BuildTabId, string>> = {
  land: 'design_preconstruction',
  permits: 'site_preparation',
  site: 'framing_shell',
  framing: 'mep_rough_in',
  mep: 'interior_finishes',
  finishes: 'inspections_closeout',
  desk: 'general',
};

export const STEP_TYPE_OPTIONS: Array<{ value: StepType; label: string }> = [
  { value: 'blueprints', label: 'Blueprints' },
  { value: 'closeout', label: 'Closeout' },
  { value: 'construction', label: 'Construction' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'other', label: 'Other' },
  { value: 'permit', label: 'Permit' },
  { value: 'photos', label: 'Photos' },
  { value: 'purchase', label: 'Supplies' },
  { value: 'utility', label: 'Utility' },
];
STEP_TYPE_OPTIONS.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

export const SQFT_PER_ACRE = 43560;

export function stepCostTotal(step: IBuildWizardStep): number {
  const actual = Number(step.actual_cost);
  if (Number.isFinite(actual) && actual > 0) {
    return actual;
  }
  const estimated = Number(step.estimated_cost);
  if (Number.isFinite(estimated) && estimated > 0) {
    return estimated;
  }
  return 0;
}

export function isAiEstimatedField(step: IBuildWizardStep, field: string): boolean {
  const fields = Array.isArray(step.ai_estimated_fields) ? step.ai_estimated_fields : [];
  return fields.includes(field);
}
