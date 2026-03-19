import { STEP_TYPE_OPTIONS } from '../../components/pages/build-wizard/buildWizardConstants';
import { BuildWizardTaskMeta, BuildWizardTaskType } from './buildWizardPageRenderTypes';

export const LIGHTBOX_ZOOM_MIN = 0.5;
export const LIGHTBOX_ZOOM_MAX = 3;
export const LIGHTBOX_ZOOM_STEP = 0.1;
export const LIGHTBOX_ZOOM_STEP_FAST = 0.2;

export const clampLightboxZoom = (value: number): number => {
  return Math.max(LIGHTBOX_ZOOM_MIN, Math.min(LIGHTBOX_ZOOM_MAX, Number(value.toFixed(2))));
};

export const LIGHTBOX_TEXT_PREVIEW_MAX_CHARS = 120000;

export const TASK_META_FIELD_LABELS: Record<keyof BuildWizardTaskMeta, string> = {
  task_type: 'Task Type',
  manual_date_override: 'Manual Date Override',
  permit_document_id: 'Permit Document',
  permit_name: 'Permit Name',
  permit_authority: 'Permit Authority',
  permit_status: 'Permit Status',
  permit_application_url: 'Permit URL',
  purchase_category: 'Purchase Category',
  purchase_brand: 'Brand',
  purchase_model: 'Model',
  purchase_sku: 'SKU',
  purchase_unit: 'Unit',
  purchase_qty: 'Quantity',
  purchase_unit_price: 'Unit Price',
  purchase_vendor: 'Vendor',
  purchase_url: 'Purchase URL',
  source_ref: 'Source Ref',
};

export const TASK_TYPE_OPTIONS: Array<{ value: BuildWizardTaskType; label: string }> = [
  ...STEP_TYPE_OPTIONS.map((option): { value: BuildWizardTaskType; label: string } => ({
    value: option.value as BuildWizardTaskType,
    label: option.label,
  })),
  { value: 'quote', label: 'Quote' },
];

TASK_TYPE_OPTIONS.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

export const allowedTaskTypes = TASK_TYPE_OPTIONS.map((option) => option.value);
