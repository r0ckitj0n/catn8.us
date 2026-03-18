import { IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';

const appendSearchTextParts = (target: string[], value: unknown, seen: WeakSet<object>): void => {
  if (value === null || typeof value === 'undefined') return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    target.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => appendSearchTextParts(target, entry, seen));
    return;
  }
  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    if (seen.has(objectValue)) return;
    seen.add(objectValue);
    Object.values(objectValue).forEach((entry) => appendSearchTextParts(target, entry, seen));
  }
};

export const buildSearchText = (...values: unknown[]): string => {
  const parts: string[] = [];
  const seen = new WeakSet<object>();
  values.forEach((value) => appendSearchTextParts(parts, value, seen));
  return parts.join(' ').toLowerCase();
};

export const STEP_COST_VERIFICATION_FIELDS: Array<keyof IBuildWizardStep> = [
  'phase_key', 'parent_step_id', 'depends_on_step_ids', 'step_type', 'title', 'description', 'permit_required', 'permit_document_id',
  'permit_name', 'permit_authority', 'permit_status', 'permit_application_url', 'purchase_category', 'purchase_brand', 'purchase_model',
  'purchase_sku', 'purchase_unit', 'purchase_qty', 'purchase_unit_price', 'purchase_vendor', 'purchase_url', 'expected_start_date',
  'expected_end_date', 'expected_duration_days', 'estimated_cost', 'actual_cost', 'is_completed', 'source_ref',
];

export const buildStepCostVerificationSignature = (
  step: IBuildWizardStep,
  draft: Partial<IBuildWizardStep> | undefined,
  stepDocuments: IBuildWizardDocument[],
  effectiveActualCost: number | null,
): string => {
  const stepState: Record<string, unknown> = {};
  STEP_COST_VERIFICATION_FIELDS.forEach((field) => {
    if (field === 'actual_cost') {
      stepState.actual_cost = effectiveActualCost;
      return;
    }
    const draftValue = draft && Object.prototype.hasOwnProperty.call(draft, field) ? draft[field] : undefined;
    const stepValue = draftValue !== undefined ? draftValue : step[field];
    stepState[field] = field === 'depends_on_step_ids' ? Array.isArray(stepValue) ? [...stepValue].map((id) => Number(id || 0)).sort((a, b) => a - b) : [] : stepValue ?? null;
  });
  const documentState = [...stepDocuments].sort((a, b) => {
    const kindCmp = String(a.kind || '').localeCompare(String(b.kind || ''));
    return kindCmp !== 0 ? kindCmp : a.id - b.id;
  }).map((doc) => ({
    id: doc.id,
    step_id: doc.step_id ?? null,
    receipt_parent_document_id: doc.receipt_parent_document_id ?? null,
    kind: doc.kind ?? '',
    caption: doc.caption ?? null,
    receipt_amount: doc.receipt_amount ?? null,
    receipt_title: doc.receipt_title ?? null,
    receipt_vendor: doc.receipt_vendor ?? null,
    receipt_date: doc.receipt_date ?? null,
    receipt_notes: doc.receipt_notes ?? null,
    original_name: doc.original_name ?? '',
  }));
  return JSON.stringify({ step: stepState, documents: documentState });
};

export const isTextLikeMime = (mime: string): boolean => {
  const normalized = String(mime || '').trim().toLowerCase();
  if (!normalized) return false;
  return normalized.startsWith('text/') || normalized.includes('json') || normalized.includes('xml') || normalized.includes('yaml') || normalized.includes('csv') || normalized.includes('javascript');
};
