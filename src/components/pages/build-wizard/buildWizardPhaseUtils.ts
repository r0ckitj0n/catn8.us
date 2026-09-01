import { IBuildWizardStep } from '../../../types/buildWizard';
import { BuildTabId } from '../../../types/pages/buildWizardPage';
import { BUILD_TABS } from './buildWizardConstants';

const CANONICAL_PHASE_KEYS = new Set([
  'design_preconstruction',
  'site_preparation',
  'framing_shell',
  'mep_rough_in',
  'interior_finishes',
  'inspections_closeout',
  'general',
]);

const PHASE_KEY_ALIASES: Record<string, string> = {
  land_due_diligence: 'design_preconstruction',
  design_preconstruction: 'design_preconstruction',
  dawson_county_permits: 'design_preconstruction',
  permits: 'design_preconstruction',
  land: 'design_preconstruction',
  planning: 'design_preconstruction',
  preconstruction: 'design_preconstruction',
  site_preparation: 'site_preparation',
  sitework: 'site_preparation',
  foundation: 'site_preparation',
  site_prep: 'site_preparation',
  framing_shell: 'framing_shell',
  framing: 'framing_shell',
  enclosure: 'framing_shell',
  roofing: 'framing_shell',
  site: 'framing_shell',
  mep_rough_in: 'mep_rough_in',
  plumbing: 'mep_rough_in',
  electrical: 'mep_rough_in',
  hvac: 'mep_rough_in',
  interior_finishes: 'interior_finishes',
  interior: 'interior_finishes',
  move_in: 'interior_finishes',
  mep: 'interior_finishes',
  inspections_closeout: 'inspections_closeout',
  closeout: 'inspections_closeout',
  finishes: 'inspections_closeout',
  general: 'general',
  desk: 'general',
};

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function slugPhaseKey(rawPhaseKey: string | null | undefined): string {
  return String(rawPhaseKey || '').trim().toLowerCase().replace(/\s+/g, '_');
}

export function canonicalPhaseKey(rawPhaseKey: string | null | undefined): string {
  const phaseKey = slugPhaseKey(rawPhaseKey);
  if (!phaseKey) {
    return 'general';
  }
  return PHASE_KEY_ALIASES[phaseKey] || phaseKey;
}

export function phaseKeysMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  return canonicalPhaseKey(left) === canonicalPhaseKey(right);
}

export function isBuildWizardTaskDocumentKind(kind: string | null | undefined): boolean {
  const value = String(kind || '').trim().toLowerCase();
  return value === 'receipt' || value === 'event' || value === 'events';
}

function normalizePhaseKeyHint(rawPhaseKey: string | null | undefined): string | null {
  const phaseKey = slugPhaseKey(rawPhaseKey);
  if (!phaseKey) {
    return null;
  }
  const mapped = PHASE_KEY_ALIASES[phaseKey] || (CANONICAL_PHASE_KEYS.has(phaseKey) ? phaseKey : null);
  if (!mapped || mapped === 'general') {
    return null;
  }
  return mapped;
}

export function tabLabelShort(tabId: BuildTabId): string {
  const label = BUILD_TABS.find((tab) => tab.id === tabId)?.label || tabId;
  return label.replace(/^\d+\.\s*/, '');
}

export function recommendPhaseKeyForStep(step: IBuildWizardStep): string | null {
  const phaseKey = String(step.phase_key || '').trim().toLowerCase();
  const mappedPhaseKey = normalizePhaseKeyHint(phaseKey);
  if (mappedPhaseKey) {
    return mappedPhaseKey;
  }

  const haystack = `${phaseKey} ${String(step.step_type || '').toLowerCase()} ${String(step.title || '').toLowerCase()} ${String(step.description || '').toLowerCase()}`
    .replace(/\s+/g, ' ')
    .trim();

  if (!haystack) {
    return null;
  }

  if (step.step_type === 'permit' || includesAny(haystack, [' permit ', 'permit', 'approval', 'application', 'zoning', 'setback', 'survey', 'engineering', 'blueprint'])) {
    return 'design_preconstruction';
  }
  if (step.step_type === 'closeout' || includesAny(haystack, ['closeout', 'final inspection', 'finals', 'certificate of occupancy', 'occupancy', 'co ', 'warranty', 'punch', 'handoff', 'move in'])) {
    return 'inspections_closeout';
  }
  if (includesAny(haystack, ['interior', 'finish', 'fixture', 'cabinet', 'trim', 'paint', 'drywall', 'floor', 'tile', 'countertop', 'siding', 'landscap'])) {
    return 'interior_finishes';
  }
  if (step.step_type === 'utility' || includesAny(haystack, ['mep', 'plumb', 'elect', 'hvac', 'mechanical', 'rough in', 'rough-in', 'breaker panel', 'service panel', 'duct'])) {
    return 'mep_rough_in';
  }
  if (includesAny(haystack, ['framing', 'frame', 'shell', 'dry in', 'dry-in', 'roof', 'sheathing', 'window install', 'door install', 'weather barrier'])) {
    return 'framing_shell';
  }
  if (includesAny(haystack, ['site prep', 'site_preparation', 'foundation', 'footing', 'slab', 'grade', 'grading', 'excavat', 'erosion', 'concrete', 'clearing', 'stakeout'])) {
    return 'site_preparation';
  }
  if (includesAny(haystack, ['land_due_diligence', 'design_preconstruction', 'permit', 'approval', 'application', 'survey', 'soil', 'zoning', 'setback', 'engineering', 'blueprint', 'plan set', 'preconstruction', 'contract'])) {
    return 'design_preconstruction';
  }
  return null;
}

export function stepPhaseBucket(step: IBuildWizardStep): BuildTabId {
  const recommendedPhaseKey = recommendPhaseKeyForStep(step);
  if (recommendedPhaseKey === 'design_preconstruction') return 'land';
  if (recommendedPhaseKey === 'site_preparation') return 'permits';
  if (recommendedPhaseKey === 'framing_shell') return 'site';
  if (recommendedPhaseKey === 'mep_rough_in') return 'framing';
  if (recommendedPhaseKey === 'interior_finishes') return 'mep';
  if (recommendedPhaseKey === 'inspections_closeout') return 'finishes';
  return 'desk';
}

export function prettyPhaseLabel(phaseKey: string | null | undefined): string {
  const raw = String(phaseKey || '').trim();
  if (!raw) {
    return 'General';
  }
  return raw
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
