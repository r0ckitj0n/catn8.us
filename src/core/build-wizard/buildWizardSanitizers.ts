import { IBuildWizardStep } from '../../types/buildWizard';

const IMPORT_FILE_TOKEN_REGEX = /\b[\w .-]+\.(?:xlsx|xls|csv)\b\s*>\s*/gi;
const IMPORT_BUCKET_TOKEN_REGEX = /\b(?:current\s+plan|past|future)\b(?:\s*[<>]\s*\d{2,14})?/gi;
const IMPORT_DATE_SUFFIX_REGEX = /\s*[<>]\s*\d{2,14}\b/g;
const IMPORT_PURCHASE_PREFIX_REGEX = /\bpurchase item from\b/gi;

function looksLikeImportedSourceTrail(raw: string): boolean {
  return (
    /\.(?:xlsx|xls|csv)\b/i.test(raw)
    || /\b(?:current\s+plan|past|future)\b\s*[<>]\s*\d{2,14}\b/i.test(raw)
    || />\s*(?:current\s+plan|past|future)\b/i.test(raw)
  );
}

export function sanitizeBuildWizardArtifactText(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw || !looksLikeImportedSourceTrail(raw)) {
    return raw;
  }

  return raw
    .replace(IMPORT_FILE_TOKEN_REGEX, ' ')
    .replace(IMPORT_PURCHASE_PREFIX_REGEX, ' ')
    .replace(IMPORT_BUCKET_TOKEN_REGEX, ' ')
    .replace(IMPORT_DATE_SUFFIX_REGEX, ' ')
    .replace(/\s*>\s*/g, ' ')
    .replace(/\s*\|\s*/g, ' ')
    .replace(/\s+\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-:|>]+|[\s\-:|>]+$/g, '')
    .replace(/\s*[.]+$/g, '')
    .trim();
}

function fallbackStepTitle(stepType: string): string {
  if (stepType === 'purchase') {
    return 'Purchase Item';
  }
  if (stepType === 'utility') {
    return 'Utility Task';
  }
  if (stepType === 'delivery') {
    return 'Delivery Task';
  }
  return 'Project Step';
}

export function sanitizeBuildWizardStepTitle(value: unknown, stepType: string = ''): string {
  const cleaned = sanitizeBuildWizardArtifactText(value);
  if (cleaned) {
    return cleaned;
  }
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  return fallbackStepTitle(String(stepType || '').trim().toLowerCase());
}

export function normalizeBuildWizardStep(step: IBuildWizardStep): IBuildWizardStep {
  if (!step || typeof step !== 'object') {
    return step;
  }
  const nextTitle = sanitizeBuildWizardStepTitle(step.title, step.step_type || '');
  const nextDescription = sanitizeBuildWizardArtifactText(step.description || '');
  const nextPurchaseCategory = sanitizeBuildWizardArtifactText(step.purchase_category || '');
  const nextSourceRef = sanitizeBuildWizardArtifactText(step.source_ref || '');

  if (
    nextTitle === String(step.title || '').trim()
    && nextDescription === String(step.description || '').trim()
    && nextPurchaseCategory === String(step.purchase_category || '').trim()
    && nextSourceRef === String(step.source_ref || '').trim()
  ) {
    return step;
  }

  return {
    ...step,
    title: nextTitle,
    description: nextDescription,
    purchase_category: nextPurchaseCategory || null,
    source_ref: nextSourceRef || null,
  };
}

export function normalizeBuildWizardSteps(steps: IBuildWizardStep[]): IBuildWizardStep[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    return [];
  }
  return steps.map((step) => normalizeBuildWizardStep(step));
}
