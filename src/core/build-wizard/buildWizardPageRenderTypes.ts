import { IBuildWizardContact, IBuildWizardContentSearchResult, IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
import { BuildTabId, StepType } from '../../types/pages/buildWizardPage';

export type SpreadsheetPreviewSheet = {
  name: string;
  rows: string[][];
};

export type TaskDocumentField = {
  label: string;
  value: string;
};

export type TaskDocumentPreview = {
  summaryFields: TaskDocumentField[];
  noteLines: string[];
  metaFields: TaskDocumentField[];
  systemLines: string[];
};

export type LightboxPreview =
  | { mode: 'image'; src: string; title: string; document: IBuildWizardDocument }
  | { mode: 'embed'; src: string; title: string; document: IBuildWizardDocument }
  | { mode: 'loading'; src: string; title: string; document: IBuildWizardDocument }
  | { mode: 'spreadsheet'; src: string; title: string; document: IBuildWizardDocument; sheets: SpreadsheetPreviewSheet[]; truncated: boolean }
  | { mode: 'plan'; src: string; title: string; document: IBuildWizardDocument; text: string; truncated: boolean; format: 'text' | 'hex' }
  | { mode: 'text'; src: string; title: string; document: IBuildWizardDocument; text: string; truncated: boolean; taskPreview: TaskDocumentPreview | null }
  | { mode: 'error'; src: string; title: string; document: IBuildWizardDocument; message: string };

export type BuildWizardSearchResult =
  | { id: string; score: number; kind: 'phase'; title: string; subtitle: string; phaseId: BuildTabId }
  | { id: string; score: number; kind: 'step'; title: string; subtitle: string; stepId: number; phaseId: BuildTabId }
  | { id: string; score: number; kind: 'document'; title: string; subtitle: string; document: IBuildWizardDocument; linkedStepId: number; linkedPhaseId: BuildTabId | null };

export type BuildWizardConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmButtonClass: string;
  resolve: (confirmed: boolean) => void;
};

export type PhaseDateRange = {
  start: string | null;
  end: string | null;
};

export type ProjectOverviewStepRow = {
  stepId: number;
  displayOrder: number;
  title: string;
  stepType: StepType;
  startIso: string | null;
  endIso: string | null;
  durationDays: number | null;
  totalCost: number;
  costMode: 'actual' | 'estimated' | 'missing';
  assigneeCount: number;
  documentCount: number;
  isCompleted: boolean;
  hasTimeline: boolean;
  leftPercent: number;
  widthPercent: number;
};

export type ProjectOverviewPhaseSection = {
  tabId: BuildTabId;
  label: string;
  phaseColor: string;
  stepCount: number;
  completedCount: number;
  totalCost: number;
  startIso: string | null;
  endIso: string | null;
  rows: ProjectOverviewStepRow[];
};

export type BuildWizardContactType = 'contact' | 'vendor' | 'authority';
export type BuildWizardTaskType = StepType | 'quote';

export type BuildWizardTaskMeta = {
  task_type: BuildWizardTaskType;
  is_completed: boolean;
  manual_date_override: boolean;
  permit_document_id: number | null;
  permit_name: string | null;
  permit_authority: string | null;
  permit_status: string | null;
  permit_application_url: string | null;
  purchase_category: string | null;
  purchase_brand: string | null;
  purchase_model: string | null;
  purchase_sku: string | null;
  purchase_unit: string | null;
  purchase_qty: number | null;
  purchase_unit_price: number | null;
  purchase_vendor: string | null;
  purchase_url: string | null;
  source_ref: string | null;
};

export type InlineReceiptField = 'vendor' | 'type' | 'date' | 'amount';

export const normalizeContactType = (contact: Pick<IBuildWizardContact, 'contact_type' | 'is_vendor'>): BuildWizardContactType => {
  const raw = String(contact.contact_type || '').trim().toLowerCase();
  if (raw === 'vendor' || raw === 'authority' || raw === 'contact') return raw;
  return Number(contact.is_vendor) === 1 ? 'vendor' : 'contact';
};

export const contactTypeLabel = (contactType: BuildWizardContactType): string => {
  if (contactType === 'vendor') return 'Vendor';
  if (contactType === 'authority') return 'Authority';
  return 'Contact';
};

export const contactTypeChipClass = (contactType: BuildWizardContactType): string => {
  if (contactType === 'vendor') return 'is-vendor';
  if (contactType === 'authority') return 'is-authority';
  return 'is-contact';
};
