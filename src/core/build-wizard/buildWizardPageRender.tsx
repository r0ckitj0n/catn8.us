import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';
import { StandardIconLink } from '../../components/common/StandardIconLink';
import { WebpImage } from '../../components/common/WebpImage';
import { ApiClient } from '../ApiClient';
import { useBuildWizard } from '../../hooks/useBuildWizard';
import {
  IBuildWizardContact,
  IBuildWizardContactAssignment,
  IBuildWizardContentSearchResult,
  IBuildWizardDocument,
  IBuildWizardStep,
} from '../../types/buildWizard';
import { IBuildWizardDropdownSettings } from '../../types/buildWizardDropdowns';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { BuildTabId, DocumentDraftMap, LotSizeUnit, StepDraftMap, StepType, WizardView } from '../../types/pages/buildWizardPage';
import { read, utils } from 'xlsx';
import {
  buildWizardTokenLabel,
  BUILD_WIZARD_DROPDOWN_SETTINGS_UPDATED_EVENT,
  DEFAULT_BUILD_WIZARD_DROPDOWN_SETTINGS,
  fetchBuildWizardDropdownSettings,
} from '../buildWizardDropdownSettings';
import {
  BUILD_TABS,
  PHASE_PROGRESS_ORDER,
  STEP_TYPE_OPTIONS,
  TAB_DEFAULT_PHASE_KEY,
  TAB_PHASE_COLORS,
  isAiEstimatedField,
} from '../../components/pages/build-wizard/buildWizardConstants';
import {
  calculateDurationDays,
  detectLotSizeUnit,
  fileExtensionFromName,
  formatCurrency,
  formatDate,
  formatTimelineDate,
  getDefaultRange,
  getStepPastelColor,
  isPdfDocument,
  lotSizeInputToSqftAuto,
  lotSizeSqftToDisplayInput,
  parseDate,
  parseUrlState,
  prettyPhaseLabel,
  pushUrlState,
  recommendPhaseKeyForStep,
  sortAlpha,
  tabLabelShort,
  stepDateRange,
  stepPhaseBucket,
  thumbnailKindLabel,
  toIsoDate,
  toNumberOrNull,
  toStringOrNull,
  withDownloadFlag,
} from '../../components/pages/build-wizard/buildWizardUtils';
import { DateRangeChart, FooterPhaseTimeline } from '../../components/pages/build-wizard/BuildWizardTimeline';
import '../../components/pages/BuildWizardPage.css';

interface BuildWizardPageProps extends AppShellPageProps {
  isAdmin?: boolean;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

type SpreadsheetPreviewSheet = {
  name: string;
  rows: string[][];
};

type TaskDocumentField = {
  label: string;
  value: string;
};

type TaskDocumentPreview = {
  summaryFields: TaskDocumentField[];
  noteLines: string[];
  metaFields: TaskDocumentField[];
  systemLines: string[];
};

type LightboxPreview =
  | { mode: 'image'; src: string; title: string }
  | { mode: 'embed'; src: string; title: string }
  | { mode: 'loading'; src: string; title: string }
  | { mode: 'spreadsheet'; src: string; title: string; sheets: SpreadsheetPreviewSheet[]; truncated: boolean }
  | { mode: 'plan'; src: string; title: string; text: string; truncated: boolean; format: 'text' | 'hex' }
  | { mode: 'text'; src: string; title: string; text: string; truncated: boolean; taskPreview: TaskDocumentPreview | null }
  | { mode: 'error'; src: string; title: string; message: string };

type BuildWizardSearchResult =
  | {
      id: string;
      score: number;
      kind: 'phase';
      title: string;
      subtitle: string;
      phaseId: BuildTabId;
    }
  | {
      id: string;
      score: number;
      kind: 'step';
      title: string;
      subtitle: string;
      stepId: number;
      phaseId: BuildTabId;
    }
  | {
      id: string;
      score: number;
      kind: 'document';
      title: string;
      subtitle: string;
      document: IBuildWizardDocument;
      linkedStepId: number;
      linkedPhaseId: BuildTabId | null;
    };

type BuildWizardConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmButtonClass: string;
  resolve: (confirmed: boolean) => void;
};

type PhaseDateRange = {
  start: string | null;
  end: string | null;
};

type ProjectOverviewStepRow = {
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

type ProjectOverviewPhaseSection = {
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

const LIGHTBOX_ZOOM_MIN = 0.5;
const LIGHTBOX_ZOOM_MAX = 3;
const LIGHTBOX_ZOOM_STEP = 0.1;
const LIGHTBOX_ZOOM_STEP_FAST = 0.2;
const PROJECT_OVERVIEW_TAB_ORDER: BuildTabId[] = [...PHASE_PROGRESS_ORDER, 'desk'];

const clampLightboxZoom = (value: number): number => {
  return Math.max(LIGHTBOX_ZOOM_MIN, Math.min(LIGHTBOX_ZOOM_MAX, Number(value.toFixed(2))));
};

type BuildWizardContactType = 'contact' | 'vendor' | 'authority';

const normalizeContactType = (contact: Pick<IBuildWizardContact, 'contact_type' | 'is_vendor'>): BuildWizardContactType => {
  const raw = String(contact.contact_type || '').trim().toLowerCase();
  if (raw === 'vendor' || raw === 'authority' || raw === 'contact') {
    return raw;
  }
  return Number(contact.is_vendor) === 1 ? 'vendor' : 'contact';
};

const contactTypeLabel = (contactType: BuildWizardContactType): string => {
  if (contactType === 'vendor') {
    return 'Vendor';
  }
  if (contactType === 'authority') {
    return 'Authority';
  }
  return 'Contact';
};

const contactTypeChipClass = (contactType: BuildWizardContactType): string => {
  if (contactType === 'vendor') {
    return 'is-vendor';
  }
  if (contactType === 'authority') {
    return 'is-authority';
  }
  return 'is-contact';
};

type BuildWizardTaskType = StepType | 'quote';

type BuildWizardTaskMeta = {
  task_type: BuildWizardTaskType;
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
type InlineReceiptField = 'vendor' | 'type' | 'date' | 'amount';

const BUILD_WIZARD_TASK_META_PREFIX = '[task_meta_json]';
const LIGHTBOX_TEXT_PREVIEW_MAX_CHARS = 120000;
const TEXT_PREVIEW_EXTENSIONS = new Set(['TXT', 'MD', 'JSON', 'CSV', 'LOG', 'XML', 'YAML', 'YML']);

const TASK_META_FIELD_LABELS: Record<keyof BuildWizardTaskMeta, string> = {
  task_type: 'Task Type',
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

const TASK_TYPE_OPTIONS: Array<{ value: BuildWizardTaskType; label: string }> = [
  ...STEP_TYPE_OPTIONS.map((option): { value: BuildWizardTaskType; label: string } => ({
    value: option.value as BuildWizardTaskType,
    label: option.label,
  })),
  { value: 'quote', label: 'Quote' },
];
TASK_TYPE_OPTIONS.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

const defaultTaskMeta = (taskType: BuildWizardTaskType = 'construction'): BuildWizardTaskMeta => ({
  task_type: taskType,
  permit_document_id: null,
  permit_name: null,
  permit_authority: null,
  permit_status: null,
  permit_application_url: null,
  purchase_category: null,
  purchase_brand: null,
  purchase_model: null,
  purchase_sku: null,
  purchase_unit: null,
  purchase_qty: null,
  purchase_unit_price: null,
  purchase_vendor: null,
  purchase_url: null,
  source_ref: null,
});

const parseTaskMetaFromReceiptNotes = (notes: string | null | undefined): { taskMeta: BuildWizardTaskMeta; plainNotes: string } => {
  const raw = String(notes || '');
  const trimmed = raw.trim();
  if (!trimmed.startsWith(BUILD_WIZARD_TASK_META_PREFIX)) {
    return {
      taskMeta: defaultTaskMeta(),
      plainNotes: raw,
    };
  }
  const newlineIndex = trimmed.indexOf('\n');
  const jsonPart = (newlineIndex >= 0 ? trimmed.slice(BUILD_WIZARD_TASK_META_PREFIX.length, newlineIndex) : trimmed.slice(BUILD_WIZARD_TASK_META_PREFIX.length)).trim();
  const plainNotes = newlineIndex >= 0 ? trimmed.slice(newlineIndex + 1) : '';
  try {
    const decoded = JSON.parse(jsonPart);
    const seed = defaultTaskMeta();
    if (!decoded || typeof decoded !== 'object') {
      return { taskMeta: seed, plainNotes };
    }
    const taskType = String((decoded as Record<string, unknown>).task_type || '').trim() as BuildWizardTaskType;
    return {
      taskMeta: {
        ...seed,
        ...(decoded as Partial<BuildWizardTaskMeta>),
        task_type: (TASK_TYPE_OPTIONS.some((option) => option.value === taskType) ? taskType : 'construction'),
      },
      plainNotes,
    };
  } catch (_err) {
    return {
      taskMeta: defaultTaskMeta(),
      plainNotes: raw,
    };
  }
};

const composeReceiptNotesWithTaskMeta = (taskMeta: BuildWizardTaskMeta, plainNotes: string): string => {
  const json = JSON.stringify(taskMeta);
  const notes = plainNotes.trim();
  return notes ? `${BUILD_WIZARD_TASK_META_PREFIX}${json}\n${notes}` : `${BUILD_WIZARD_TASK_META_PREFIX}${json}`;
};

const isTextLikeMime = (mime: string): boolean => {
  const normalized = String(mime || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return normalized.startsWith('text/')
    || normalized.includes('json')
    || normalized.includes('xml')
    || normalized.includes('yaml')
    || normalized.includes('csv')
    || normalized.includes('javascript');
};

const normalizeTaskMetaValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return '';
};

const parseTaskDocumentPreview = (text: string): TaskDocumentPreview | null => {
  const normalized = String(text || '').replace(/\r\n?/g, '\n');
  if (!normalized.trim()) {
    return null;
  }

  const lines = normalized.split('\n');
  const summaryFields: TaskDocumentField[] = [];
  const summaryPrefixes: Array<{ label: string; regex: RegExp }> = [
    { label: 'Task', regex: /^Task:\s*(.+)\s*$/i },
    { label: 'Vendor', regex: /^Vendor:\s*(.+)\s*$/i },
    { label: 'Date', regex: /^Date:\s*(.+)\s*$/i },
    { label: 'Amount', regex: /^Amount:\s*(.+)\s*$/i },
  ];
  summaryPrefixes.forEach(({ label, regex }) => {
    const match = lines.find((line) => regex.test(line));
    if (!match) {
      return;
    }
    const value = (match.match(regex)?.[1] || '').trim();
    if (value) {
      summaryFields.push({ label, value });
    }
  });

  const notesStart = lines.findIndex((line) => /^Notes:\s*$/i.test(line.trim()));
  const trailingLines = notesStart >= 0 ? lines.slice(notesStart + 1) : [];
  const noteLines: string[] = [];
  const systemLines: string[] = [];
  let decodedMeta: Partial<BuildWizardTaskMeta> | null = null;

  trailingLines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    if (trimmed.startsWith(BUILD_WIZARD_TASK_META_PREFIX)) {
      const metaJson = trimmed.slice(BUILD_WIZARD_TASK_META_PREFIX.length).trim();
      if (!metaJson) {
        return;
      }
      try {
        const parsed = JSON.parse(metaJson);
        if (parsed && typeof parsed === 'object') {
          decodedMeta = parsed as Partial<BuildWizardTaskMeta>;
        }
      } catch {
        noteLines.push(trimmed);
      }
      return;
    }
    if (/^Imported from mapped note\b/i.test(trimmed) || /^Generated repair document\b/i.test(trimmed)) {
      systemLines.push(trimmed);
      return;
    }
    noteLines.push(trimmed);
  });

  const metaFields: TaskDocumentField[] = decodedMeta
    ? (Object.keys(TASK_META_FIELD_LABELS) as Array<keyof BuildWizardTaskMeta>)
      .map((fieldKey): TaskDocumentField | null => {
        const rawValue = normalizeTaskMetaValue(decodedMeta?.[fieldKey]);
        if (!rawValue) {
          return null;
        }
        return {
          label: TASK_META_FIELD_LABELS[fieldKey],
          value: rawValue,
        };
      })
      .filter((entry): entry is TaskDocumentField => entry !== null)
    : [];

  if (!summaryFields.length && !noteLines.length && !metaFields.length && !systemLines.length) {
    return null;
  }
  return {
    summaryFields,
    noteLines,
    metaFields,
    systemLines,
  };
};

const appendSearchTextParts = (
  target: string[],
  value: unknown,
  seen: WeakSet<object>,
): void => {
  if (value === null || typeof value === 'undefined') {
    return;
  }
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
    if (seen.has(objectValue)) {
      return;
    }
    seen.add(objectValue);
    Object.values(objectValue).forEach((entry) => appendSearchTextParts(target, entry, seen));
  }
};

const buildSearchText = (...values: unknown[]): string => {
  const parts: string[] = [];
  const seen = new WeakSet<object>();
  values.forEach((value) => appendSearchTextParts(parts, value, seen));
  return parts.join(' ').toLowerCase();
};

export function renderBuildWizardPage({ onToast, isAdmin }: BuildWizardPageProps) {
  const {
    saving,
    aiBusy,
    recoveryBusy,
    projectId,
    projects,
    project,
    questionnaire,
    updateProject,
    steps,
    documents,
    contacts,
    contactAssignments,
    phaseDateRanges,
    aiPromptText,
    aiPayloadJson,
    openProject,
    createProject,
    toggleStep,
    updateStep,
    addStep,
    reorderSteps,
    deleteStep,
    deleteProject,
    addStepNote,
    updateStepNote,
    deleteStepNote,
    createStepReceipt,
    uploadDocument,
    replaceDocument,
    deleteDocument,
    updateDocument,
    packageForAi,
    generateStepsFromAi,
    recoverSingletreeDocuments,
    fetchSingletreeRecoveryStatus,
    stageSingletreeSourceFiles,
    searchContent,
    saveContact,
    deleteContact,
    addContactAssignment,
    deleteContactAssignment,
    savePhaseDateRange,
  } = useBuildWizard(onToast);

  const initialUrlState = React.useMemo(() => parseUrlState(), []);
  const [view, setView] = React.useState<WizardView>(initialUrlState.view);
  const [buildEntryPoint, setBuildEntryPoint] = React.useState<'launcher' | 'template_editor'>(
    initialUrlState.view === 'template_editor' ? 'template_editor' : 'launcher',
  );
  const [activeTab, setActiveTab] = React.useState<BuildTabId>('start');
  const [newHomeWastewaterKind, setNewHomeWastewaterKind] = React.useState<'septic' | 'public_sewer'>('septic');
  const [newHomeWaterKind, setNewHomeWaterKind] = React.useState<'county_water' | 'private_well'>('county_water');
  const [docKind, setDocKind] = React.useState<string>('blueprint');
  const [docPhaseKey, setDocPhaseKey] = React.useState<string>('general');
  const [docStepId, setDocStepId] = React.useState<number>(0);
  const [dropdownSettings, setDropdownSettings] = React.useState<IBuildWizardDropdownSettings>(DEFAULT_BUILD_WIZARD_DROPDOWN_SETTINGS);
  const [projectDraft, setProjectDraft] = React.useState(questionnaire);
  const [lotSizeInput, setLotSizeInput] = React.useState<string>(lotSizeSqftToDisplayInput(questionnaire.lot_size_sqft));
  const [stepDrafts, setStepDrafts] = React.useState<StepDraftMap>({});
  const [noteDraftByStep, setNoteDraftByStep] = React.useState<Record<number, string>>({});
  const [editingNoteTextById, setEditingNoteTextById] = React.useState<Record<number, string>>({});
  const [savingNoteId, setSavingNoteId] = React.useState<number>(0);
  const [deletingNoteId, setDeletingNoteId] = React.useState<number>(0);
  const [dependencyCandidateByStepId, setDependencyCandidateByStepId] = React.useState<Record<number, string>>({});
  const [attachExistingDocByStepId, setAttachExistingDocByStepId] = React.useState<Record<number, string>>({});
  const [attachExistingDocByReceiptId, setAttachExistingDocByReceiptId] = React.useState<Record<number, string>>({});
  const [attachExistingDocFilterByStepId, setAttachExistingDocFilterByStepId] = React.useState<Record<number, string>>({});
  const [attachExistingDocFilterByReceiptId, setAttachExistingDocFilterByReceiptId] = React.useState<Record<number, string>>({});
  const [attachExistingPickerOpenByStepId, setAttachExistingPickerOpenByStepId] = React.useState<Record<number, boolean>>({});
  const [attachExistingPickerOpenByReceiptId, setAttachExistingPickerOpenByReceiptId] = React.useState<Record<number, boolean>>({});
  const [noteEditorOpenByStep, setNoteEditorOpenByStep] = React.useState<Record<number, boolean>>({});
  const [footerRange, setFooterRange] = React.useState<{ start: string; end: string }>({ start: '', end: '' });
  const [lightboxDoc, setLightboxDoc] = React.useState<LightboxPreview | null>(null);
  const [lightboxSpreadsheetSheetIndex, setLightboxSpreadsheetSheetIndex] = React.useState<number>(0);
  const [lightboxZoom, setLightboxZoom] = React.useState<number>(1);
  const [documentManagerKindFilter, setDocumentManagerKindFilter] = React.useState<string>('all');
  const [documentManagerPhaseFilter, setDocumentManagerPhaseFilter] = React.useState<string>('all');
  const [documentManagerStepFilter, setDocumentManagerStepFilter] = React.useState<string>('all');
  const [documentUploadModalOpen, setDocumentUploadModalOpen] = React.useState<boolean>(false);
  const [documentUploadFile, setDocumentUploadFile] = React.useState<File | null>(null);
  const [documentUploadBusy, setDocumentUploadBusy] = React.useState<boolean>(false);
  const [projectDeskOpen, setProjectDeskOpen] = React.useState<boolean>(false);
  const [aiToolsOpen, setAiToolsOpen] = React.useState<boolean>(false);
  const [projectOverviewOpen, setProjectOverviewOpen] = React.useState<boolean>(false);
  const [deskSelectedContactId, setDeskSelectedContactId] = React.useState<number>(0);
  const [deskCreateMode, setDeskCreateMode] = React.useState<boolean>(false);
  const [deskContactQuery, setDeskContactQuery] = React.useState<string>('');
  const [deskContactTypeFilter, setDeskContactTypeFilter] = React.useState<'all' | BuildWizardContactType>('all');
  const [deskContactDraft, setDeskContactDraft] = React.useState<{
    contact_id?: number;
    display_name: string;
    email: string;
    phone: string;
    company: string;
    role_title: string;
    notes: string;
    contact_type: BuildWizardContactType;
    is_vendor: number;
    is_project_only: number;
    vendor_type: string;
    vendor_license: string;
    vendor_trade: string;
    vendor_website: string;
  }>({
    display_name: '',
    email: '',
    phone: '',
    company: '',
    role_title: '',
    notes: '',
    contact_type: 'contact',
    is_vendor: 0,
    is_project_only: 1,
    vendor_type: '',
    vendor_license: '',
    vendor_trade: '',
    vendor_website: '',
  });
  const [deskAssignmentPhaseKey, setDeskAssignmentPhaseKey] = React.useState<string>('general');
  const [deskAssignmentStepId, setDeskAssignmentStepId] = React.useState<number>(0);
  const [deskAutoAssignBusy, setDeskAutoAssignBusy] = React.useState<boolean>(false);
  const [documentDrafts, setDocumentDrafts] = React.useState<DocumentDraftMap>({});
  const [receiptEditorOpenByStep, setReceiptEditorOpenByStep] = React.useState<Record<number, boolean>>({});
  const [editingReceiptDocumentIdByStep, setEditingReceiptDocumentIdByStep] = React.useState<Record<number, number>>({});
  const [receiptDraftByStep, setReceiptDraftByStep] = React.useState<Record<number, {
    receipt_title: string;
    receipt_vendor: string;
    receipt_date: string;
    receipt_amount: string;
    receipt_notes: string;
    task_meta: BuildWizardTaskMeta;
  }>>({});
  const [receiptAttachmentDraftByStep, setReceiptAttachmentDraftByStep] = React.useState<Record<number, File[]>>({});
  const [inlineEditingReceiptFieldByDocId, setInlineEditingReceiptFieldByDocId] = React.useState<Record<number, InlineReceiptField | null>>({});
  const [inlineReceiptDraftByDocId, setInlineReceiptDraftByDocId] = React.useState<Record<number, {
    vendor: string;
    date: string;
    amount: string;
    taskType: BuildWizardTaskType;
    plainNotes: string;
    taskMeta: BuildWizardTaskMeta;
  }>>({});
  const [pendingScrollReceiptId, setPendingScrollReceiptId] = React.useState<number>(0);
  const [documentSavingId, setDocumentSavingId] = React.useState<number>(0);
  const [unlinkingDocumentId, setUnlinkingDocumentId] = React.useState<number>(0);
  const [deletingDocumentId, setDeletingDocumentId] = React.useState<number>(0);
  const [deletingProjectId, setDeletingProjectId] = React.useState<number>(0);
  const [recoveryReportOpen, setRecoveryReportOpen] = React.useState<boolean>(false);
  const [recoveryReportJson, setRecoveryReportJson] = React.useState<string>('');
  const [recoveryJobId, setRecoveryJobId] = React.useState<string>('');
  const [recoveryStatus, setRecoveryStatus] = React.useState<string>('');
  const [recoveryPolling, setRecoveryPolling] = React.useState<boolean>(false);
  const [recoveryUploadBusy, setRecoveryUploadBusy] = React.useState<boolean>(false);
  const [recoveryUploadToken, setRecoveryUploadToken] = React.useState<string>('');
  const [recoveryStagedRoot, setRecoveryStagedRoot] = React.useState<string>('');
  const [recoveryStagedCount, setRecoveryStagedCount] = React.useState<number>(0);
  const [stickyTopOffset, setStickyTopOffset] = React.useState<number>(8);
  const [stickyHeadHeight, setStickyHeadHeight] = React.useState<number>(0);
  const [draggingStepId, setDraggingStepId] = React.useState<number>(0);
  const [dragOverInsertIndex, setDragOverInsertIndex] = React.useState<number>(-1);
  const [dragOverParentStepId, setDragOverParentStepId] = React.useState<number>(0);
  const [expandedStepById, setExpandedStepById] = React.useState<Record<number, boolean>>({});
  const [stepInfoModalStepId, setStepInfoModalStepId] = React.useState<number>(0);
  const [topbarSearchQuery, setTopbarSearchQuery] = React.useState<string>('');
  const [topbarSearchOpen, setTopbarSearchOpen] = React.useState<boolean>(false);
  const [topbarSearchLoading, setTopbarSearchLoading] = React.useState<boolean>(false);
  const [topbarSearchDocumentResults, setTopbarSearchDocumentResults] = React.useState<IBuildWizardContentSearchResult[]>([]);
  const [topbarSearchFocusStepId, setTopbarSearchFocusStepId] = React.useState<number>(0);
  const [documentManagerQuery, setDocumentManagerQuery] = React.useState<string>('');
  const [documentManagerSearchLoading, setDocumentManagerSearchLoading] = React.useState<boolean>(false);
  const [documentManagerSearchResults, setDocumentManagerSearchResults] = React.useState<IBuildWizardContentSearchResult[]>([]);
  const [stepCardAssigneeTypeFilter, setStepCardAssigneeTypeFilter] = React.useState<'all' | BuildWizardContactType>('all');
  const [stepCardAssigneeIdFilter, setStepCardAssigneeIdFilter] = React.useState<number>(0);
  const [stepCardTextFilter, setStepCardTextFilter] = React.useState<string>('');
  const [moveStepModalStepId, setMoveStepModalStepId] = React.useState<number>(0);
  const [moveStepModalTargetTab, setMoveStepModalTargetTab] = React.useState<BuildTabId>('land');
  const [movingStep, setMovingStep] = React.useState<boolean>(false);
  const [stepContactPickerOpenByStepId, setStepContactPickerOpenByStepId] = React.useState<Record<number, boolean>>({});
  const [stepContactCandidateByStepId, setStepContactCandidateByStepId] = React.useState<Record<number, string>>({});
  const [currencyInputByKey, setCurrencyInputByKey] = React.useState<Record<string, string>>({});
  const [activeCurrencyInputKey, setActiveCurrencyInputKey] = React.useState<string>('');
  const recoveryUploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const replaceFileInputByDocId = React.useRef<Record<number, HTMLInputElement | null>>({});
  const receiptEditorRefByStepId = React.useRef<Record<number, HTMLDivElement | null>>({});
  const receiptRowRefByDocId = React.useRef<Record<number, HTMLDivElement | null>>({});
  const timelineReconciledProjectIdsRef = React.useRef<Set<number>>(new Set());
  const stickyHeadRef = React.useRef<HTMLDivElement | null>(null);
  const topbarSearchBoxRef = React.useRef<HTMLDivElement | null>(null);
  const [replacingDocumentId, setReplacingDocumentId] = React.useState<number>(0);
  const [confirmState, setConfirmState] = React.useState<BuildWizardConfirmState | null>(null);

  const closeLightbox = React.useCallback(() => {
    setLightboxDoc(null);
    setLightboxSpreadsheetSheetIndex(0);
    setLightboxZoom(1);
  }, []);

  const zoomLightboxBy = React.useCallback((delta: number) => {
    setLightboxZoom((prev) => clampLightboxZoom(prev + delta));
  }, []);

  const resetLightboxZoom = React.useCallback(() => {
    setLightboxZoom(1);
  }, []);

  React.useEffect(() => {
    if (initialUrlState.view === 'build' && initialUrlState.projectId && initialUrlState.projectId !== projectId) {
      void openProject(initialUrlState.projectId);
      setActiveTab('overview');
    }
  }, [initialUrlState.view, initialUrlState.projectId, projectId, openProject]);

  React.useEffect(() => {
    const updateStickyOffset = () => {
      const nav = document.querySelector<HTMLElement>('.navbar.sticky-top, .navbar.fixed-top');
      if (!nav) {
        setStickyTopOffset(8);
        return;
      }
      const navRect = nav.getBoundingClientRect();
      const navStyle = window.getComputedStyle(nav);
      const marginBottom = Number.parseFloat(navStyle.marginBottom || '0') || 0;
      setStickyTopOffset(Math.max(8, Math.ceil(navRect.height + marginBottom + 8)));
    };
    updateStickyOffset();
    window.addEventListener('resize', updateStickyOffset);
    return () => window.removeEventListener('resize', updateStickyOffset);
  }, []);

  React.useEffect(() => {
    const node = stickyHeadRef.current;
    if (!node) {
      setStickyHeadHeight(0);
      return;
    }

    const measure = () => setStickyHeadHeight(Math.ceil(node.getBoundingClientRect().height));
    measure();
    window.addEventListener('resize', measure);

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', measure);
      };
    }

    return () => {
      window.removeEventListener('resize', measure);
    };
  }, [activeTab, projectId, view]);

  React.useEffect(() => {
    const onPopState = () => {
      const state = parseUrlState();
      setView(state.view);
      if (state.view === 'template_editor') {
        setBuildEntryPoint('template_editor');
      } else if (state.view === 'launcher') {
        setBuildEntryPoint('launcher');
      }
      if (state.view === 'build' && state.projectId && state.projectId !== projectId) {
        void openProject(state.projectId);
        setActiveTab('overview');
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [openProject, projectId]);

  React.useEffect(() => {
    let cancelled = false;
    void fetchBuildWizardDropdownSettings()
      .then((loaded) => {
        if (!cancelled) {
          setDropdownSettings(loaded);
        }
      })
      .catch((err: any) => {
        if (Number(err?.status || 0) === 403) {
          return;
        }
        onToast?.({ tone: 'warning', message: err?.message || 'Failed to load Build Wizard dropdown settings' });
      });
    return () => {
      cancelled = true;
    };
  }, [onToast]);

  React.useEffect(() => {
    const onSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<IBuildWizardDropdownSettings>;
      if (customEvent?.detail) {
        setDropdownSettings(customEvent.detail);
      }
    };
    window.addEventListener(BUILD_WIZARD_DROPDOWN_SETTINGS_UPDATED_EVENT, onSettingsUpdated as EventListener);
    return () => window.removeEventListener(BUILD_WIZARD_DROPDOWN_SETTINGS_UPDATED_EVENT, onSettingsUpdated as EventListener);
  }, []);

  React.useEffect(() => {
    setProjectDraft(questionnaire);
    setLotSizeInput(lotSizeSqftToDisplayInput(questionnaire.lot_size_sqft));
  }, [questionnaire]);

  const lotSizeDetectedUnit = React.useMemo<LotSizeUnit>(() => detectLotSizeUnit(lotSizeInput), [lotSizeInput]);

  const permitStatusOptions = React.useMemo(() => {
    return dropdownSettings.permit_statuses || [];
  }, [dropdownSettings.permit_statuses]);

  const purchaseUnitOptions = React.useMemo(() => {
    return dropdownSettings.purchase_units || [];
  }, [dropdownSettings.purchase_units]);

  const docKindOptions = React.useMemo(() => {
    return (dropdownSettings.document_kinds || []).map((value) => ({
      value,
      label: buildWizardTokenLabel(value, 'Other'),
    }));
  }, [dropdownSettings.document_kinds]);

  React.useEffect(() => {
    if (!docKindOptions.length) {
      return;
    }
    const validValues = new Set(docKindOptions.map((opt) => opt.value));
    if (!validValues.has(docKind)) {
      setDocKind(docKindOptions[0].value);
    }
  }, [docKind, docKindOptions]);

  React.useEffect(() => {
    setStepDrafts((prev) => {
      const next: StepDraftMap = { ...prev };
      const validIds = new Set<number>();
      steps.forEach((s) => {
        validIds.add(s.id);
        next[s.id] = { ...s };
      });
      Object.keys(next).forEach((idText) => {
        const n = Number(idText);
        if (!validIds.has(n)) {
          delete next[n];
        }
      });
      return next;
    });
  }, [steps]);

  React.useEffect(() => {
    const validIds = new Set(steps.map((step) => step.id));
    setDependencyCandidateByStepId((prev) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((idText) => {
        const stepId = Number(idText);
        if (validIds.has(stepId)) {
          next[stepId] = prev[stepId];
        }
      });
      return next;
    });
    setAttachExistingDocFilterByStepId((prev) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((idText) => {
        const stepId = Number(idText);
        if (validIds.has(stepId)) {
          next[stepId] = prev[stepId];
        }
      });
      return next;
    });
    setAttachExistingPickerOpenByStepId((prev) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((idText) => {
        const stepId = Number(idText);
        if (validIds.has(stepId) && prev[stepId]) {
          next[stepId] = true;
        }
      });
      return next;
    });
    setReceiptEditorOpenByStep((prev) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((idText) => {
        const stepId = Number(idText);
        if (validIds.has(stepId) && prev[stepId]) {
          next[stepId] = true;
        }
      });
      return next;
    });
    setReceiptDraftByStep((prev) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((idText) => {
        const stepId = Number(idText);
        if (validIds.has(stepId)) {
          next[stepId] = prev[stepId];
        }
      });
      return next;
    });
    setReceiptAttachmentDraftByStep((prev) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((idText) => {
        const stepId = Number(idText);
        if (validIds.has(stepId)) {
          next[stepId] = prev[stepId];
        }
      });
      return next;
    });
  }, [steps]);

  React.useEffect(() => {
    setExpandedStepById((prev) => {
      const next: Record<number, boolean> = {};
      const validIds = new Set(steps.map((step) => step.id));
      Object.keys(prev).forEach((idText) => {
        const id = Number(idText);
        if (validIds.has(id) && prev[id]) {
          next[id] = true;
        }
      });
      return next;
    });
    if (stepInfoModalStepId > 0 && !steps.some((step) => step.id === stepInfoModalStepId)) {
      setStepInfoModalStepId(0);
    }
  }, [stepInfoModalStepId, steps]);

  React.useEffect(() => {
    const validDocumentIds = new Set<number>(documents.map((doc) => doc.id));
    setAttachExistingDocFilterByReceiptId((prev) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((idText) => {
        const documentId = Number(idText);
        if (validDocumentIds.has(documentId)) {
          next[documentId] = prev[documentId];
        }
      });
      return next;
    });
    setAttachExistingPickerOpenByReceiptId((prev) => {
      const next: typeof prev = {};
      Object.keys(prev).forEach((idText) => {
        const documentId = Number(idText);
        if (validDocumentIds.has(documentId) && prev[documentId]) {
          next[documentId] = true;
        }
      });
      return next;
    });
  }, [documents]);

  React.useEffect(() => {
    if (!topbarSearchOpen) {
      return;
    }
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !topbarSearchBoxRef.current || topbarSearchBoxRef.current.contains(target)) {
        return;
      }
      setTopbarSearchOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [topbarSearchOpen]);

  React.useEffect(() => {
    if (!topbarSearchFocusStepId || !steps.length) {
      return;
    }
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`build-wizard-step-${topbarSearchFocusStepId}`);
      if (!el) {
        return;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [topbarSearchFocusStepId, activeTab, steps.length]);

  React.useEffect(() => {
    const query = topbarSearchQuery.trim();
    if (query.length < 2 || projectId <= 0) {
      setTopbarSearchLoading(false);
      setTopbarSearchDocumentResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setTopbarSearchLoading(true);
      void searchContent(query, 25)
        .then((res) => {
          if (cancelled) {
            return;
          }
          setTopbarSearchDocumentResults(Array.isArray(res?.results) ? res.results : []);
        })
        .finally(() => {
          if (!cancelled) {
            setTopbarSearchLoading(false);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [projectId, searchContent, topbarSearchQuery]);

  React.useEffect(() => {
    const query = documentManagerQuery.trim();
    if (query.length < 2 || projectId <= 0) {
      setDocumentManagerSearchLoading(false);
      setDocumentManagerSearchResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setDocumentManagerSearchLoading(true);
      void searchContent(query, 200)
        .then((res) => {
          if (cancelled) {
            return;
          }
          setDocumentManagerSearchResults(Array.isArray(res?.results) ? res.results : []);
        })
        .finally(() => {
          if (!cancelled) {
            setDocumentManagerSearchLoading(false);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [documentManagerQuery, projectId, searchContent]);

  const completedSteps = React.useMemo(() => {
    return steps
      .filter((s) => Number(s.is_completed) === 1)
      .sort((a, b) => {
        const ad = parseDate(a.completed_at)?.getTime() || 0;
        const bd = parseDate(b.completed_at)?.getTime() || 0;
        return bd - ad;
      });
  }, [steps]);

  const filteredTabSteps = React.useMemo(() => {
    if (activeTab === 'completed' || activeTab === 'start' || activeTab === 'overview') {
      return [] as IBuildWizardStep[];
    }
    return steps.filter((step) => stepPhaseBucket(step) === activeTab);
  }, [steps, activeTab]);

  const stepById = React.useMemo(() => {
    const map = new Map<number, IBuildWizardStep>();
    steps.forEach((step) => {
      map.set(step.id, step);
    });
    return map;
  }, [steps]);

  const activeTabTreeRows = React.useMemo(() => {
    const stepIdsInTab = new Set(filteredTabSteps.map((step) => step.id));
    const childrenByParent = new Map<number, IBuildWizardStep[]>();
    const roots: IBuildWizardStep[] = [];
    const sortedTabSteps = [...filteredTabSteps].sort((a, b) => {
      if (a.step_order !== b.step_order) {
        return a.step_order - b.step_order;
      }
      return a.id - b.id;
    });

    sortedTabSteps.forEach((step) => {
      const parentStepId = Number(step.parent_step_id || 0);
      if (parentStepId > 0 && stepIdsInTab.has(parentStepId)) {
        const siblings = childrenByParent.get(parentStepId) || [];
        siblings.push(step);
        childrenByParent.set(parentStepId, siblings);
      } else {
        roots.push(step);
      }
    });

    const rows: Array<{ step: IBuildWizardStep; level: number }> = [];
    const visited = new Set<number>();
    const walk = (node: IBuildWizardStep, level: number) => {
      if (visited.has(node.id)) {
        return;
      }
      visited.add(node.id);
      rows.push({ step: node, level });
      const children = childrenByParent.get(node.id) || [];
      children.forEach((child) => walk(child, level + 1));
    };
    roots.forEach((root) => walk(root, 0));
    sortedTabSteps.forEach((step) => {
      if (!visited.has(step.id)) {
        walk(step, 0);
      }
    });
    return rows;
  }, [filteredTabSteps]);

  const activeTabStepNumbers = React.useMemo(() => {
    const map = new Map<number, number>();
    activeTabTreeRows.forEach((row, idx) => {
      map.set(row.step.id, idx + 1);
    });
    return map;
  }, [activeTabTreeRows]);

  const incompleteDescendantCountByStepId = React.useMemo(() => {
    const childrenByParent = new Map<number, number[]>();
    filteredTabSteps.forEach((step) => {
      const parentStepId = Number(step.parent_step_id || 0);
      if (parentStepId > 0) {
        const children = childrenByParent.get(parentStepId) || [];
        children.push(step.id);
        childrenByParent.set(parentStepId, children);
      }
    });

    const completionById = new Map<number, boolean>();
    filteredTabSteps.forEach((step) => {
      completionById.set(step.id, Number(step.is_completed) === 1);
    });

    const countMap = new Map<number, number>();
    const countIncompleteDescendants = (stepId: number, stack: Set<number> = new Set()): number => {
      if (countMap.has(stepId)) {
        return countMap.get(stepId) || 0;
      }
      if (stack.has(stepId)) {
        return 0;
      }
      stack.add(stepId);
      let count = 0;
      const children = childrenByParent.get(stepId) || [];
      children.forEach((childId) => {
        if (!(completionById.get(childId) || false)) {
          count += 1;
        }
        count += countIncompleteDescendants(childId, stack);
      });
      stack.delete(stepId);
      countMap.set(stepId, count);
      return count;
    };

    filteredTabSteps.forEach((step) => {
      countIncompleteDescendants(step.id);
    });
    return countMap;
  }, [filteredTabSteps]);

  const projectDeskSteps = React.useMemo(() => {
    return steps.filter((step) => stepPhaseBucket(step) === 'desk');
  }, [steps]);

  const deskContacts = React.useMemo(() => {
    return [...contacts].sort((a, b) => {
      return sortAlpha(String(a.display_name || ''), String(b.display_name || ''));
    });
  }, [contacts]);

  const selectedDeskContact = React.useMemo(() => {
    if (deskSelectedContactId <= 0) {
      return null;
    }
    return deskContacts.find((contact) => contact.id === deskSelectedContactId) || null;
  }, [deskContacts, deskSelectedContactId]);

  const stepByIdMap = React.useMemo(() => {
    const map = new Map<number, IBuildWizardStep>();
    steps.forEach((step) => map.set(step.id, step));
    return map;
  }, [steps]);

  const stepInfoModalStep = React.useMemo(() => {
    if (stepInfoModalStepId <= 0) {
      return null;
    }
    return stepByIdMap.get(stepInfoModalStepId) || null;
  }, [stepInfoModalStepId, stepByIdMap]);

  const moveStepModalStep = React.useMemo(() => {
    if (moveStepModalStepId <= 0) {
      return null;
    }
    return stepByIdMap.get(moveStepModalStepId) || null;
  }, [moveStepModalStepId, stepByIdMap]);

  const selectedContactAssignments = React.useMemo(() => {
    if (!selectedDeskContact) {
      return [] as IBuildWizardContactAssignment[];
    }
    return contactAssignments
      .filter((assignment) => assignment.contact_id === selectedDeskContact.id)
      .sort((a, b) => a.id - b.id);
  }, [contactAssignments, selectedDeskContact]);

  const deskContactAssignmentCountById = React.useMemo(() => {
    const map = new Map<number, number>();
    contactAssignments.forEach((assignment) => {
      map.set(assignment.contact_id, (map.get(assignment.contact_id) || 0) + 1);
    });
    return map;
  }, [contactAssignments]);

  const filteredDeskContacts = React.useMemo(() => {
    const query = deskContactQuery.trim().toLowerCase();
    return deskContacts.filter((contact) => {
      const contactType = normalizeContactType(contact);
      if (deskContactTypeFilter !== 'all' && contactType !== deskContactTypeFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        contact.display_name,
        contact.company,
        contact.role_title,
        contact.email,
        contact.phone,
      ].map((value) => String(value || '').toLowerCase()).join(' ');
      return haystack.includes(query);
    });
  }, [deskContactQuery, deskContactTypeFilter, deskContacts]);

  const authorityContacts = React.useMemo(() => {
    return contacts
      .filter((contact) => normalizeContactType(contact) === 'authority')
      .sort((a, b) => sortAlpha(String(a.display_name || ''), String(b.display_name || '')));
  }, [contacts]);

  const stepAssigneesByStepId = React.useMemo(() => {
    const normalizePhaseKey = (value: string | null | undefined): string => String(value || '').trim().toLowerCase();
    const contactMap = new Map<number, typeof contacts[number]>();
    contacts.forEach((contact) => {
      contactMap.set(contact.id, contact);
    });
    const byStep = new Map<number, Array<{ contact: typeof contacts[number]; source: 'step' | 'phase' }>>();

    steps.forEach((step) => {
      const phaseKey = normalizePhaseKey(step.phase_key || 'general');
      const dedupByContact = new Map<number, { contact: typeof contacts[number]; source: 'step' | 'phase' }>();

      contactAssignments.forEach((assignment) => {
        const assignmentStepId = Number(assignment.step_id || 0);
        const assignmentPhaseKey = normalizePhaseKey(assignment.phase_key || '');
        const isStepMatch = assignmentStepId > 0 && assignmentStepId === step.id;
        const isPhaseMatch = assignmentStepId <= 0 && assignmentPhaseKey !== '' && assignmentPhaseKey === phaseKey;
        if (!isStepMatch && !isPhaseMatch) {
          return;
        }
        const contact = contactMap.get(assignment.contact_id);
        if (!contact) {
          return;
        }
        const nextSource: 'step' | 'phase' = isStepMatch ? 'step' : 'phase';
        const existing = dedupByContact.get(contact.id);
        if (!existing || (existing.source === 'phase' && nextSource === 'step')) {
          dedupByContact.set(contact.id, { contact, source: nextSource });
        }
      });

      if (dedupByContact.size > 0) {
        byStep.set(
          step.id,
          Array.from(dedupByContact.values()).sort((a, b) => sortAlpha(String(a.contact.display_name || ''), String(b.contact.display_name || ''))),
        );
      }
    });

    return byStep;
  }, [contactAssignments, contacts, steps]);

  const stepDirectAssigneesByStepId = React.useMemo(() => {
    const contactMap = new Map<number, IBuildWizardContact>();
    contacts.forEach((contact) => {
      contactMap.set(contact.id, contact);
    });

    const byStep = new Map<number, Array<{ assignment: IBuildWizardContactAssignment; contact: IBuildWizardContact }>>();
    contactAssignments.forEach((assignment) => {
      const stepId = Number(assignment.step_id || 0);
      if (stepId <= 0) {
        return;
      }
      const contact = contactMap.get(assignment.contact_id);
      if (!contact) {
        return;
      }
      const rows = byStep.get(stepId) || [];
      rows.push({ assignment, contact });
      byStep.set(stepId, rows);
    });

    byStep.forEach((rows, stepId) => {
      const sortedRows = [...rows].sort((a, b) => sortAlpha(String(a.contact.display_name || ''), String(b.contact.display_name || '')));
      byStep.set(stepId, sortedRows);
    });

    return byStep;
  }, [contactAssignments, contacts]);

  const stepFilterContactOptions = React.useMemo(() => {
    const inTabContactIds = new Set<number>();
    filteredTabSteps.forEach((step) => {
      const assignees = stepAssigneesByStepId.get(step.id) || [];
      assignees.forEach((entry) => inTabContactIds.add(entry.contact.id));
    });
    return contacts
      .filter((contact) => inTabContactIds.has(contact.id))
      .sort((a, b) => sortAlpha(String(a.display_name || ''), String(b.display_name || '')));
  }, [contacts, filteredTabSteps, stepAssigneesByStepId]);

  const moveStepPhaseTabOptions = React.useMemo(() => {
    return PHASE_PROGRESS_ORDER.map((tabId) => {
      const tab = BUILD_TABS.find((candidate) => candidate.id === tabId);
      return {
        value: tabId,
        label: tab?.label || prettyPhaseLabel(TAB_DEFAULT_PHASE_KEY[tabId] || tabId),
      };
    });
  }, []);

  const stepCardTextFilterTokens = React.useMemo(() => {
    return stepCardTextFilter
      .trim()
      .toLowerCase()
      .split(/\s+/g)
      .filter(Boolean);
  }, [stepCardTextFilter]);

  const stepSearchTextById = React.useMemo(() => {
    const documentsByStepId = new Map<number, IBuildWizardDocument[]>();
    documents.forEach((documentItem) => {
      const stepId = Number(documentItem.step_id || 0);
      if (stepId <= 0) {
        return;
      }
      const rows = documentsByStepId.get(stepId) || [];
      rows.push(documentItem);
      documentsByStepId.set(stepId, rows);
    });

    const byId = new Map<number, string>();
    steps.forEach((step) => {
      const stepDocuments = documentsByStepId.get(step.id) || [];
      const stepAssignees = stepAssigneesByStepId.get(step.id) || [];
      const parsedReceiptData = stepDocuments
        .filter((documentItem) => String(documentItem.kind || '').trim() === 'receipt')
        .map((documentItem) => parseTaskMetaFromReceiptNotes(documentItem.receipt_notes));
      byId.set(
        step.id,
        buildSearchText(
          step,
          stepDocuments,
          stepAssignees.map((entry) => entry.contact),
          parsedReceiptData,
          prettyPhaseLabel(step.phase_key),
        ),
      );
    });
    return byId;
  }, [documents, stepAssigneesByStepId, steps]);

  const receiptMetricsByStepId = React.useMemo(() => {
    const map = new Map<number, {
      allCount: number;
      nonQuoteCount: number;
      quoteCount: number;
      allTotal: number;
      nonQuoteTotal: number;
      quoteTotal: number;
    }>();
    documents.forEach((documentItem) => {
      if (String(documentItem.kind || '').trim() !== 'receipt') {
        return;
      }
      const stepId = Number(documentItem.step_id || 0);
      if (stepId <= 0) {
        return;
      }
      const existing = map.get(stepId) || {
        allCount: 0,
        nonQuoteCount: 0,
        quoteCount: 0,
        allTotal: 0,
        nonQuoteTotal: 0,
        quoteTotal: 0,
      };
      const parsed = parseTaskMetaFromReceiptNotes(documentItem.receipt_notes || '');
      const isQuote = parsed.taskMeta.task_type === 'quote';
      const amount = Number(documentItem.receipt_amount || 0);
      const normalizedAmount = Number.isFinite(amount) ? amount : 0;
      existing.allCount += 1;
      existing.allTotal += normalizedAmount;
      if (isQuote) {
        existing.quoteCount += 1;
        existing.quoteTotal += normalizedAmount;
      } else {
        existing.nonQuoteCount += 1;
        existing.nonQuoteTotal += normalizedAmount;
      }
      map.set(stepId, existing);
    });
    return map;
  }, [documents]);

  const getStepQuoteTotal = React.useCallback((stepId: number): number => {
    return receiptMetricsByStepId.get(stepId)?.quoteTotal || 0;
  }, [receiptMetricsByStepId]);

  const getStepActualExcludingQuotes = React.useCallback((step: IBuildWizardStep): number => {
    const actual = Number(step.actual_cost);
    const normalizedActual = Number.isFinite(actual) && actual > 0 ? actual : 0;
    return Math.max(0, normalizedActual - getStepQuoteTotal(step.id));
  }, [getStepQuoteTotal]);

  const getStepEstimatedExcludingQuotes = React.useCallback((step: IBuildWizardStep): number => {
    const estimated = Number(step.estimated_cost);
    const normalizedEstimated = Number.isFinite(estimated) && estimated > 0 ? estimated : 0;
    return Math.max(0, normalizedEstimated - getStepQuoteTotal(step.id));
  }, [getStepQuoteTotal]);

  const stepCostTotalExcludingQuotes = React.useCallback((step: IBuildWizardStep): number => {
    const actual = getStepActualExcludingQuotes(step);
    if (actual > 0) {
      return actual;
    }
    return getStepEstimatedExcludingQuotes(step);
  }, [getStepActualExcludingQuotes, getStepEstimatedExcludingQuotes]);

  const phaseTotals = React.useMemo(() => {
    if (!PHASE_PROGRESS_ORDER.includes(activeTab)) {
      return { phaseTotal: 0, projectToDateTotal: 0 };
    }

    const phaseOrderIndex = PHASE_PROGRESS_ORDER.indexOf(activeTab);
    const phaseTotal = filteredTabSteps.reduce((sum, step) => sum + stepCostTotalExcludingQuotes(step), 0);
    const projectToDateTotal = steps.reduce((sum, step) => {
      const stepPhase = stepPhaseBucket(step);
      const stepOrderIndex = PHASE_PROGRESS_ORDER.indexOf(stepPhase);
      if (stepOrderIndex >= 0 && stepOrderIndex <= phaseOrderIndex) {
        return sum + stepCostTotalExcludingQuotes(step);
      }
      return sum;
    }, 0);

    return { phaseTotal, projectToDateTotal };
  }, [activeTab, filteredTabSteps, stepCostTotalExcludingQuotes, steps]);

  const stepDocumentCountByStepId = React.useMemo(() => {
    const map = new Map<number, number>();
    documents.forEach((documentItem) => {
      const linkedStepId = Number(documentItem.step_id || 0);
      if (linkedStepId <= 0) {
        return;
      }
      map.set(linkedStepId, (map.get(linkedStepId) || 0) + 1);
    });
    return map;
  }, [documents]);

  const projectOverviewRange = React.useMemo(() => getDefaultRange(steps), [steps]);

  const projectOverviewSections = React.useMemo<ProjectOverviewPhaseSection[]>(() => {
    const rangeStartDate = parseDate(projectOverviewRange.start);
    const rangeEndDate = parseDate(projectOverviewRange.end);
    const hasRange = Boolean(rangeStartDate && rangeEndDate && rangeEndDate.getTime() >= rangeStartDate.getTime());
    const totalDays = hasRange
      ? Math.max(1, Math.round((rangeEndDate!.getTime() - rangeStartDate!.getTime()) / 86400000) + 1)
      : 1;

    return PROJECT_OVERVIEW_TAB_ORDER.map((tabId) => {
      const phaseSteps = steps
        .filter((step) => stepPhaseBucket(step) === tabId)
        .sort((a, b) => {
          if (a.step_order !== b.step_order) {
            return a.step_order - b.step_order;
          }
          return a.id - b.id;
        });

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
        const costMode: ProjectOverviewStepRow['costMode'] = Number.isFinite(actualCost) && actualCost > 0
          ? 'actual'
          : (Number.isFinite(estimatedCost) && estimatedCost > 0 ? 'estimated' : 'missing');
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
  }, [projectOverviewRange.end, projectOverviewRange.start, stepAssigneesByStepId, stepCostTotalExcludingQuotes, stepDocumentCountByStepId, steps]);

  const projectOverviewTotals = React.useMemo(() => {
    return projectOverviewSections.reduce(
      (totals, section) => {
        totals.stepCount += section.stepCount;
        totals.completedCount += section.completedCount;
        totals.totalCost += section.totalCost;
        return totals;
      },
      { stepCount: 0, completedCount: 0, totalCost: 0 },
    );
  }, [projectOverviewSections]);

  const derivePhaseDateRange = React.useCallback((tabId: BuildTabId): PhaseDateRange => {
    const tabSteps = steps.filter((step) => stepPhaseBucket(step) === tabId);
    const sortedStartDates = tabSteps
      .map((step) => toStringOrNull(step.expected_start_date || ''))
      .filter((value): value is string => Boolean(value))
      .sort();
    const sortedEndCandidates = tabSteps
      .map((step) => toStringOrNull(step.expected_end_date || '') || toStringOrNull(step.expected_start_date || ''))
      .filter((value): value is string => Boolean(value))
      .sort();
    return {
      start: sortedStartDates.length ? sortedStartDates[0] : null,
      end: sortedEndCandidates.length ? sortedEndCandidates[sortedEndCandidates.length - 1] : null,
    };
  }, [steps]);

  const phaseDateRangeByTab = React.useMemo<Partial<Record<BuildTabId, PhaseDateRange>>>(() => {
    const map: Partial<Record<BuildTabId, PhaseDateRange>> = {};
    phaseDateRanges.forEach((range) => {
      const phaseTab = range.phase_tab as BuildTabId;
      if (!PHASE_PROGRESS_ORDER.includes(phaseTab)) {
        return;
      }
      map[phaseTab] = {
        start: toStringOrNull(range.start_date || ''),
        end: toStringOrNull(range.end_date || ''),
      };
    });
    return map;
  }, [phaseDateRanges]);

  const resolvePhaseDateRange = React.useCallback((tabId: BuildTabId): PhaseDateRange => {
    const derived = derivePhaseDateRange(tabId);
    const override = phaseDateRangeByTab[tabId];
    return {
      start: toStringOrNull(override?.start || '') || derived.start,
      end: toStringOrNull(override?.end || '') || derived.end,
    };
  }, [derivePhaseDateRange, phaseDateRangeByTab]);

  const activePhaseDateRange = React.useMemo<PhaseDateRange>(() => {
    if (!PHASE_PROGRESS_ORDER.includes(activeTab)) {
      return { start: null, end: null };
    }
    return resolvePhaseDateRange(activeTab);
  }, [activeTab, resolvePhaseDateRange]);

  const activePhaseHasStoredDateRange = React.useMemo<boolean>(() => {
    if (!PHASE_PROGRESS_ORDER.includes(activeTab)) {
      return false;
    }
    const stored = phaseDateRangeByTab[activeTab];
    return Boolean(toStringOrNull(stored?.start || '') || toStringOrNull(stored?.end || ''));
  }, [activeTab, phaseDateRangeByTab]);

  const clampDateToRange = React.useCallback((value: string | null | undefined, min: string | null, max: string | null): string | null => {
    const next = toStringOrNull(value || '');
    if (!next) {
      return null;
    }
    if (min && next < min) {
      return min;
    }
    if (max && next > max) {
      return max;
    }
    return next;
  }, []);

  const mergeDateMin = React.useCallback((a: string | null | undefined, b: string | null | undefined): string | undefined => {
    const left = toStringOrNull(a || '');
    const right = toStringOrNull(b || '');
    if (!left && !right) {
      return undefined;
    }
    if (!left) {
      return right || undefined;
    }
    if (!right) {
      return left || undefined;
    }
    return left > right ? left : right;
  }, []);

  const mergeDateMax = React.useCallback((a: string | null | undefined, b: string | null | undefined): string | undefined => {
    const left = toStringOrNull(a || '');
    const right = toStringOrNull(b || '');
    if (!left && !right) {
      return undefined;
    }
    if (!left) {
      return right || undefined;
    }
    if (!right) {
      return left || undefined;
    }
    return left < right ? left : right;
  }, []);

  const onPhaseDateRangeChange = React.useCallback((patch: Partial<PhaseDateRange>) => {
    if (!PHASE_PROGRESS_ORDER.includes(activeTab)) {
      return;
    }
    const current = resolvePhaseDateRange(activeTab);
    let nextStart = toStringOrNull((patch.start ?? current.start) || '');
    let nextEnd = toStringOrNull((patch.end ?? current.end) || '');
    if (nextStart && nextEnd && nextStart > nextEnd) {
      onToast?.({ tone: 'warning', message: 'Phase start date cannot be after phase end date.' });
      return;
    }

    const phaseSteps = steps.filter((step) => stepPhaseBucket(step) === activeTab);
    const outOfRangeStep = phaseSteps.find((step) => {
      const stepStart = toStringOrNull(step.expected_start_date || '');
      const stepEnd = toStringOrNull(step.expected_end_date || '') || stepStart;
      if (nextStart && ((stepStart && stepStart < nextStart) || (stepEnd && stepEnd < nextStart))) {
        return true;
      }
      if (nextEnd && ((stepStart && stepStart > nextEnd) || (stepEnd && stepEnd > nextEnd))) {
        return true;
      }
      return false;
    });
    if (outOfRangeStep) {
      onToast?.({
        tone: 'error',
        message: `Phase date range cannot exclude step "${outOfRangeStep.title}". Update that step or its task dates first.`,
      });
      return;
    }
    void savePhaseDateRange(projectId, activeTab as 'land' | 'permits' | 'site' | 'framing' | 'mep' | 'finishes', nextStart, nextEnd);
  }, [activeTab, onToast, projectId, resolvePhaseDateRange, savePhaseDateRange, steps]);

  const onOpenMoveStepModal = React.useCallback((stepId: number) => {
    if (stepId <= 0) {
      return;
    }
    const step = stepById.get(stepId);
    if (!step) {
      return;
    }
    const tab = stepPhaseBucket(step);
    if (PHASE_PROGRESS_ORDER.includes(tab)) {
      setMoveStepModalTargetTab(tab);
    }
    setMoveStepModalStepId(stepId);
  }, [stepById]);

  const onMoveStepFromModal = React.useCallback(async () => {
    if (movingStep) {
      return;
    }
    const stepId = Number(moveStepModalStepId || 0);
    if (stepId <= 0) {
      onToast?.({ tone: 'warning', message: 'Choose a step to move.' });
      return;
    }
    const targetPhaseKey = String(TAB_DEFAULT_PHASE_KEY[moveStepModalTargetTab] || '').trim();
    if (!targetPhaseKey) {
      onToast?.({ tone: 'warning', message: 'Choose a valid target phase.' });
      return;
    }
    const step = stepById.get(stepId);
    if (!step) {
      onToast?.({ tone: 'warning', message: 'Selected step no longer exists.' });
      return;
    }
    if (String(step.phase_key || '').trim() === targetPhaseKey) {
      onToast?.({ tone: 'info', message: 'Step is already in that phase.' });
      return;
    }

    const startDate = toStringOrNull(step.expected_start_date || '');
    const endDate = toStringOrNull(step.expected_end_date || '');
    const patch: Partial<IBuildWizardStep> = {
      phase_key: targetPhaseKey,
      expected_start_date: startDate,
      expected_end_date: endDate,
      expected_duration_days: calculateDurationDays(startDate, endDate) ?? null,
    };
    if (Number(step.parent_step_id || 0) > 0) {
      patch.parent_step_id = null;
    }

    setMovingStep(true);
    try {
      await updateStep(stepId, patch);
      setActiveTab(moveStepModalTargetTab);
      setMoveStepModalStepId(0);
      onToast?.({ tone: 'success', message: 'Step moved and re-placed on timeline.' });
    } finally {
      setMovingStep(false);
    }
  }, [moveStepModalStepId, moveStepModalTargetTab, movingStep, onToast, stepById, updateStep]);

  const footerTimelineSteps = React.useMemo(() => {
    if (activeTab === 'start' || activeTab === 'completed' || activeTab === 'overview') {
      return steps;
    }
    return filteredTabSteps;
  }, [activeTab, steps, filteredTabSteps]);

  React.useEffect(() => {
    const next = getDefaultRange(footerTimelineSteps.length ? footerTimelineSteps : steps);
    setFooterRange(next);
  }, [steps, footerTimelineSteps]);

  const projectTotals = React.useMemo(() => {
    const totalEstimated = steps.reduce((sum, s) => sum + getStepEstimatedExcludingQuotes(s), 0);
    const totalActual = steps.reduce((sum, s) => sum + getStepActualExcludingQuotes(s), 0);
    const doneCount = steps.filter((s) => Number(s.is_completed) === 1).length;
    return {
      totalEstimated,
      totalActual,
      doneCount,
      totalCount: steps.length,
    };
  }, [getStepActualExcludingQuotes, getStepEstimatedExcludingQuotes, steps]);

  const overviewMetrics = React.useMemo(() => {
    const today = new Date();
    const todayIso = toIsoDate(today);
    const projectStart = parseDate(project?.target_start_date || null);
    const timelineStart = steps
      .map((s) => parseDate(s.expected_start_date) || parseDate(s.expected_end_date))
      .filter(Boolean)
      .sort((a, b) => (a!.getTime() - b!.getTime()))[0] || null;
    const startDate = projectStart || timelineStart;
    const startCountdownDays = startDate ? Math.round((startDate.getTime() - parseDate(todayIso)!.getTime()) / 86400000) : null;

    const projectEnd = parseDate(project?.target_completion_date || null);
    const timelineEnd = steps
      .map((s) => parseDate(s.expected_end_date) || parseDate(s.expected_start_date))
      .filter(Boolean)
      .sort((a, b) => (a!.getTime() - b!.getTime()))
      .pop() || null;
    const endDate = projectEnd || timelineEnd;
    const endCountdownDays = endDate ? Math.round((endDate.getTime() - parseDate(todayIso)!.getTime()) / 86400000) : null;

    const nextStep = steps
      .filter((s) => Number(s.is_completed) !== 1)
      .map((s) => ({ step: s, start: parseDate(s.expected_start_date), end: parseDate(s.expected_end_date) }))
      .filter((r) => r.start || r.end)
      .sort((a, b) => {
        const aStart = (a.start || a.end)!.getTime();
        const bStart = (b.start || b.end)!.getTime();
        return aStart - bStart;
      })[0] || null;

    const spentActual = steps.reduce((sum, s) => sum + getStepActualExcludingQuotes(s), 0);
    const projectedTotal = steps.reduce((sum, s) => {
      const actual = getStepActualExcludingQuotes(s);
      if (actual > 0) {
        return sum + actual;
      }
      return sum + getStepEstimatedExcludingQuotes(s);
    }, 0);
    const remainingProjected = Math.max(0, projectedTotal - spentActual);

    const aiEstimatedCostSteps = steps.filter((s) => isAiEstimatedField(s, 'estimated_cost')).length;
    const missingEstimateCount = steps.filter((s) => Number(s.actual_cost ?? 0) <= 0 && Number(s.estimated_cost ?? 0) <= 0).length;
    const missingTimelineCount = steps.filter((s) => !s.expected_start_date || !s.expected_end_date).length;

    return {
      startDate: startDate ? toIsoDate(startDate) : null,
      startCountdownDays,
      endDate: endDate ? toIsoDate(endDate) : null,
      endCountdownDays,
      nextStep,
      spentActual,
      projectedTotal,
      remainingProjected,
      aiEstimatedCostSteps,
      missingEstimateCount,
      missingTimelineCount,
    };
  }, [getStepActualExcludingQuotes, getStepEstimatedExcludingQuotes, project?.target_completion_date, project?.target_start_date, steps]);

  const projectDocuments = React.useMemo(() => {
    return documents.filter((d) => !d.step_id || Number(d.step_id) <= 0);
  }, [documents]);

  const permitDocuments = React.useMemo(() => {
    return documents
      .filter((d) => String(d.kind || '') === 'permit')
      .sort((a, b) => sortAlpha(String(a.original_name || ''), String(b.original_name || '')));
  }, [documents]);

  const primaryPhotoChoices = React.useMemo(() => {
    return documents
      .filter((doc) => {
        const kind = String(doc.kind || '');
        return Number(doc.is_image) === 1 && (kind === 'photo' || kind === 'site_photo' || kind === 'home_photo' || kind === 'progress_photo');
      })
      .sort((a, b) => sortAlpha(String(a.original_name || ''), String(b.original_name || '')));
  }, [documents]);

  const primaryBlueprintChoices = React.useMemo(() => {
    return documents
      .filter((doc) => String(doc.kind || '') === 'blueprint')
      .sort((a, b) => sortAlpha(String(a.original_name || ''), String(b.original_name || '')));
  }, [documents]);

  const phaseOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string }> = [{ value: 'general', label: 'General' }];
    steps.forEach((step) => {
      const key = String(step.phase_key || '').trim() || 'general';
      if (seen.has(key) || key === 'general') {
        return;
      }
      seen.add(key);
      options.push({ value: key, label: prettyPhaseLabel(key) });
    });
    return options.sort((a, b) => sortAlpha(a.label, b.label));
  }, [steps]);

  const selectableDocSteps = React.useMemo(() => {
    const filtered = !docPhaseKey || docPhaseKey === 'general'
      ? steps
      : steps.filter((step) => String(step.phase_key || 'general') === docPhaseKey);

    return [...filtered].sort((a, b) => {
      const aLabel = `${prettyPhaseLabel(a.phase_key)} ${a.title}`;
      const bLabel = `${prettyPhaseLabel(b.phase_key)} ${b.title}`;
      return sortAlpha(aLabel, bLabel);
    });
  }, [steps, docPhaseKey]);

  const linkedStepOptions = React.useMemo(() => {
    const ordered = [...steps].sort((a, b) => {
      const aRawOrder = Number(a.step_order) || 0;
      const bRawOrder = Number(b.step_order) || 0;
      const aHasOrder = aRawOrder > 0;
      const bHasOrder = bRawOrder > 0;
      if (aHasOrder && bHasOrder && aRawOrder !== bRawOrder) {
        return aRawOrder - bRawOrder;
      }
      if (aHasOrder !== bHasOrder) {
        return aHasOrder ? -1 : 1;
      }
      return a.id - b.id;
    });

    const numberWidth = Math.max(2, String(ordered.length).length);
    return ordered.map((step, index) => ({
      step,
      displayNumber: index + 1,
      sortKey: `#${String(index + 1).padStart(numberWidth, '0')} ${String(step.title || '')}`.trim(),
      label: `#${index + 1} ${String(step.title || '').trim()} (${prettyPhaseLabel(step.phase_key)})`.trim(),
    })).sort((a, b) => sortAlpha(a.sortKey, b.sortKey));
  }, [steps]);

  const linkedStepDisplayNumberById = React.useMemo(() => {
    const map = new Map<number, number>();
    linkedStepOptions.forEach((option) => {
      map.set(option.step.id, option.displayNumber);
    });
    return map;
  }, [linkedStepOptions]);

  const attachableProjectDocuments = React.useMemo(() => {
    return documents
      .filter((doc) => String(doc.kind || '').trim() !== 'receipt_attachment')
      .sort((a, b) => {
      const nameCmp = sortAlpha(String(a.original_name || ''), String(b.original_name || ''));
      if (nameCmp !== 0) {
        return nameCmp;
      }
      return a.id - b.id;
    });
  }, [documents]);

  const documentManagerKindOptions = React.useMemo(() => {
    const fromDocs = documents
      .filter((doc) => String(doc.kind || '').trim() !== 'receipt_attachment')
      .map((doc) => String(doc.kind || '').trim())
      .filter(Boolean);
    const fromSettings = docKindOptions
      .map((opt) => String(opt.value || '').trim())
      .filter(Boolean);
    return Array.from(new Set([...fromSettings, ...fromDocs])).sort((a, b) => sortAlpha(a, b));
  }, [documents, docKindOptions]);

  const documentManagerPhaseOptions = React.useMemo(() => {
    const keys = new Set<string>();
    keys.add('general');
    steps.forEach((step) => {
      const key = String(step.phase_key || '').trim() || 'general';
      keys.add(key);
    });
    documents.forEach((doc) => {
      const key = String(doc.step_phase_key || '').trim();
      if (key) {
        keys.add(key);
      }
    });
    return Array.from(keys).sort((a, b) => sortAlpha(prettyPhaseLabel(a), prettyPhaseLabel(b)));
  }, [documents, steps]);

  const documentManagerLinkedStepFilterOptions = React.useMemo(() => {
    const linkedIds = new Set<number>();
    documents.forEach((doc) => {
      const stepId = Number(doc.step_id || 0);
      if (stepId > 0) {
        linkedIds.add(stepId);
      }
    });
    return linkedStepOptions.filter((option) => linkedIds.has(option.step.id));
  }, [documents, linkedStepOptions]);

  const documentManagerSearchIds = React.useMemo(() => {
    const ids = new Set<number>();
    documentManagerSearchResults.forEach((doc) => {
      if (Number(doc.id) > 0) {
        ids.add(Number(doc.id));
      }
    });
    return ids;
  }, [documentManagerSearchResults]);

  const documentManagerSearchResultById = React.useMemo(() => {
    const map = new Map<number, IBuildWizardContentSearchResult>();
    documentManagerSearchResults.forEach((doc) => {
      if (Number(doc.id) > 0) {
        map.set(Number(doc.id), doc);
      }
    });
    return map;
  }, [documentManagerSearchResults]);

  const filteredDocumentManagerDocs = React.useMemo(() => {
    const query = documentManagerQuery.trim();
    return documents.filter((doc) => {
      const docKindValue = String(doc.kind || '').trim();
      if (docKindValue === 'receipt_attachment') {
        return false;
      }
      if (documentManagerKindFilter !== 'all' && docKindValue !== documentManagerKindFilter) {
        return false;
      }
      const docPhaseValue = String(doc.step_phase_key || '').trim() || 'general';
      if (documentManagerPhaseFilter !== 'all' && docPhaseValue !== documentManagerPhaseFilter) {
        return false;
      }
      if (documentManagerStepFilter === 'unlinked' && Number(doc.step_id || 0) > 0) {
        return false;
      }
      if (
        documentManagerStepFilter !== 'all'
        && documentManagerStepFilter !== 'unlinked'
        && Number(doc.step_id || 0) !== Number(documentManagerStepFilter)
      ) {
        return false;
      }
      if (query.length >= 2 && !documentManagerSearchIds.has(Number(doc.id))) {
        return false;
      }
      return true;
    });
  }, [documents, documentManagerKindFilter, documentManagerPhaseFilter, documentManagerQuery, documentManagerSearchIds, documentManagerStepFilter]);

  const topbarSearchResults = React.useMemo<BuildWizardSearchResult[]>(() => {
    const query = topbarSearchQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }
    const tokens = query.split(/\s+/g).filter(Boolean);
    if (!tokens.length) {
      return [];
    }
    const includesAll = (haystack: string): boolean => tokens.every((token) => haystack.includes(token));
    const rank = (haystack: string): number => {
      let score = 0;
      if (haystack.includes(query)) {
        score += 20;
      }
      tokens.forEach((token) => {
        if (haystack.includes(token)) {
          score += 5;
        }
      });
      return score;
    };

    const results: BuildWizardSearchResult[] = [];

    BUILD_TABS.filter((tab) => tab.id !== 'desk').forEach((tab) => {
      const normalized = `${String(tab.label || '').toLowerCase()} ${String(prettyPhaseLabel(tab.id)).toLowerCase()}`;
      if (!includesAll(normalized)) {
        return;
      }
      results.push({
        id: `phase:${tab.id}`,
        score: 90 + rank(normalized),
        kind: 'phase',
        title: tab.label,
        subtitle: 'Build Wizard phase',
        phaseId: tab.id,
      });
    });

    steps.forEach((step) => {
      const phaseId = stepPhaseBucket(step);
      const notesText = (step.notes || []).map((note) => String(note.note_text || '')).join(' ');
      const normalized = [
        step.title,
        step.description,
        step.phase_key,
        prettyPhaseLabel(step.phase_key),
        step.step_type,
        notesText,
      ].map((v) => String(v || '').toLowerCase()).join(' ');
      if (!includesAll(normalized)) {
        return;
      }
      results.push({
        id: `step:${step.id}`,
        score: 70 + rank(normalized),
        kind: 'step',
        title: `#${step.step_order} ${step.title}`,
        subtitle: `${prettyPhaseLabel(step.phase_key)} phase`,
        stepId: step.id,
        phaseId,
      });
    });

    topbarSearchDocumentResults.forEach((doc) => {
      const normalized = [
        doc.original_name,
        doc.caption,
        doc.kind,
        doc.step_title,
        doc.step_phase_key,
        prettyPhaseLabel(doc.step_phase_key || 'general'),
        doc.snippet,
      ].map((v) => String(v || '').toLowerCase()).join(' ');
      if (!includesAll(normalized)) {
        return;
      }
      const linkedStepId = Number(doc.step_id || 0);
      const linkedStep = linkedStepId > 0 ? stepById.get(linkedStepId) : null;
      const linkedPhaseId = linkedStep ? stepPhaseBucket(linkedStep) : null;
      results.push({
        id: `document:${doc.id}`,
        score: 60 + rank(normalized),
        kind: 'document',
        title: doc.original_name || `Document #${doc.id}`,
        subtitle: linkedStepId > 0
          ? `${buildWizardTokenLabel(doc.kind, 'Other')} | Linked to ${doc.step_title || `step #${linkedStepId}`}${doc.snippet ? ` | ${doc.snippet}` : ''}`
          : `${buildWizardTokenLabel(doc.kind, 'Other')} | Project document${doc.snippet ? ` | ${doc.snippet}` : ''}`,
        document: doc,
        linkedStepId,
        linkedPhaseId,
      });
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }, [stepById, steps, topbarSearchDocumentResults, topbarSearchQuery]);

  React.useEffect(() => {
    if (docStepId <= 0) {
      return;
    }
    const exists = selectableDocSteps.some((step) => step.id === docStepId);
    if (!exists) {
      setDocStepId(0);
    }
  }, [docStepId, selectableDocSteps]);

  React.useEffect(() => {
    if (!projectDeskOpen) {
      setDeskCreateMode(false);
    }
  }, [projectDeskOpen]);

  React.useEffect(() => {
    if (!projectDeskOpen) {
      return;
    }
    const nextDrafts: DocumentDraftMap = {};
    documents.forEach((doc) => {
      nextDrafts[doc.id] = {
        kind: doc.kind || 'other',
        caption: doc.caption || '',
        step_id: Number(doc.step_id || 0),
        receipt_amount: doc.receipt_amount !== null && Number.isFinite(Number(doc.receipt_amount))
          ? String(doc.receipt_amount)
          : '',
        receipt_title: doc.receipt_title || '',
        receipt_vendor: doc.receipt_vendor || '',
        receipt_date: doc.receipt_date || '',
        receipt_notes: doc.receipt_notes || '',
      };
    });
    setDocumentDrafts(nextDrafts);
    setDocumentManagerKindFilter('all');
    setDocumentManagerPhaseFilter('all');
    setDocumentManagerStepFilter('all');
    setDocumentManagerQuery('');
    setDocumentUploadModalOpen(false);
    setDocumentUploadFile(null);

    if (deskCreateMode) {
      return;
    }
    if (deskSelectedContactId > 0 && deskContacts.some((contact) => contact.id === deskSelectedContactId)) {
      return;
    }
    setDeskSelectedContactId(deskContacts[0]?.id || 0);
  }, [projectDeskOpen, documents, deskContacts, deskSelectedContactId, deskCreateMode]);

  React.useEffect(() => {
    if (documentManagerStepFilter === 'all' || documentManagerStepFilter === 'unlinked') {
      return;
    }
    const selectedStepId = Number(documentManagerStepFilter);
    if (selectedStepId <= 0) {
      setDocumentManagerStepFilter('all');
      return;
    }
    const stillValid = documentManagerLinkedStepFilterOptions.some((option) => option.step.id === selectedStepId);
    if (!stillValid) {
      setDocumentManagerStepFilter('all');
    }
  }, [documentManagerStepFilter, documentManagerLinkedStepFilterOptions]);

  React.useEffect(() => {
    if (!projectDeskOpen || deskCreateMode || deskSelectedContactId <= 0) {
      return;
    }
    if (filteredDeskContacts.length === 0) {
      return;
    }
    if (filteredDeskContacts.some((contact) => contact.id === deskSelectedContactId)) {
      return;
    }
    setDeskSelectedContactId(filteredDeskContacts[0].id);
  }, [projectDeskOpen, filteredDeskContacts, deskSelectedContactId, deskCreateMode]);

  React.useEffect(() => {
    if (!projectDeskOpen) {
      return;
    }
    if (!selectedDeskContact) {
      if (deskCreateMode) {
        return;
      }
      setDeskContactDraft({
        display_name: '',
        email: '',
        phone: '',
        company: '',
        role_title: '',
        notes: '',
        contact_type: 'contact',
        is_vendor: 0,
        is_project_only: 1,
        vendor_type: '',
        vendor_license: '',
        vendor_trade: '',
        vendor_website: '',
      });
      return;
    }
    setDeskCreateMode(false);
    setDeskContactDraft({
      contact_id: selectedDeskContact.id,
      display_name: selectedDeskContact.display_name || '',
      email: selectedDeskContact.email || '',
      phone: selectedDeskContact.phone || '',
      company: selectedDeskContact.company || '',
      role_title: selectedDeskContact.role_title || '',
      notes: selectedDeskContact.notes || '',
      contact_type: normalizeContactType(selectedDeskContact),
      is_vendor: normalizeContactType(selectedDeskContact) === 'vendor' ? 1 : 0,
      is_project_only: selectedDeskContact.project_id ? 1 : 0,
      vendor_type: selectedDeskContact.vendor_type || '',
      vendor_license: selectedDeskContact.vendor_license || '',
      vendor_trade: selectedDeskContact.vendor_trade || '',
      vendor_website: selectedDeskContact.vendor_website || '',
    });
  }, [projectDeskOpen, selectedDeskContact, deskCreateMode]);

  React.useEffect(() => {
    if (stepCardAssigneeIdFilter <= 0) {
      return;
    }
    const exists = stepFilterContactOptions.some((contact) => contact.id === stepCardAssigneeIdFilter);
    if (!exists) {
      setStepCardAssigneeIdFilter(0);
    }
  }, [stepCardAssigneeIdFilter, stepFilterContactOptions]);

  React.useEffect(() => {
    if (moveStepModalStepId <= 0) {
      return;
    }
    const selected = stepById.get(moveStepModalStepId);
    if (!selected) {
      setMoveStepModalStepId(0);
      return;
    }
    const tab = stepPhaseBucket(selected);
    if (PHASE_PROGRESS_ORDER.includes(tab)) {
      setMoveStepModalTargetTab(tab);
    }
  }, [moveStepModalStepId, stepById]);

  const launcherProjects = React.useMemo(() => {
    return projects.filter((candidate) => Number(candidate.is_template || 0) !== 1);
  }, [projects]);

  const templateProjects = React.useMemo(() => {
    return projects.filter((candidate) => Number(candidate.is_template || 0) === 1);
  }, [projects]);

  const isTemplateProject = Number(project?.is_template || 0) === 1;

  const openBuild = async (nextProjectId: number, source: 'launcher' | 'template_editor' = 'launcher') => {
    await openProject(nextProjectId);
    setActiveTab('overview');
    setBuildEntryPoint(source);
    setView('build');
    pushUrlState('build', nextProjectId);
  };

  const onCreateNewBuild = async () => {
    const today = toIsoDate(new Date());
    const nextId = await createProject(`New Home Plan ${today}`, 'blank', newHomeWastewaterKind, newHomeWaterKind);
    if (nextId > 0) {
      setActiveTab('start');
      setBuildEntryPoint('launcher');
      setView('build');
      pushUrlState('build', nextId);
    }
  };

  const onOpenTemplateEditor = async () => {
    if (templateProjects.length === 0) {
      await createProject('Build a House Template', 'blank', 'septic', 'county_water', true);
    }
    setBuildEntryPoint('template_editor');
    setView('template_editor');
    pushUrlState('template_editor', null);
  };

  const onCreateTemplate = async () => {
    const today = toIsoDate(new Date());
    const nextId = await createProject(`New Template ${today}`, 'blank', 'septic', 'county_water', true);
    if (nextId > 0) {
      setActiveTab('start');
      setBuildEntryPoint('template_editor');
      setView('build');
      pushUrlState('build', nextId);
    }
  };

  const onBackToLauncher = () => {
    setView('launcher');
    setBuildEntryPoint('launcher');
    pushUrlState('launcher', null);
  };

  const onBackFromWorkspace = () => {
    if (isTemplateProject || buildEntryPoint === 'template_editor') {
      setView('template_editor');
      setBuildEntryPoint('template_editor');
      pushUrlState('template_editor', null);
      return;
    }
    onBackToLauncher();
  };

  const onSaveTemplate = async () => {
    if (projectId <= 0) {
      return;
    }
    await updateProject({ is_template: 1 });
  };

  const onCloseWizard = React.useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const fallbackUrl = '/';
    const referrer = String(window.document.referrer || '').trim();
    if (!referrer) {
      window.location.assign(fallbackUrl);
      return;
    }
    try {
      const refUrl = new URL(referrer);
      const refHost = String(refUrl.hostname || '').toLowerCase();
      const isCatn8Domain = refHost === 'catn8.us' || refHost.endsWith('.catn8.us');
      if (isCatn8Domain) {
        window.location.assign(refUrl.toString());
        return;
      }
    } catch (_) {
      // Ignore malformed referrer and use default fallback.
    }
    window.location.assign(fallbackUrl);
  }, []);

  const updateStepDraft = (stepId: number, patch: Partial<IBuildWizardStep>) => {
    setStepDrafts((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] || ({} as IBuildWizardStep)),
        ...patch,
      },
    }));
  };

  const commitStep = async (stepId: number, patch: Partial<IBuildWizardStep>) => {
    await updateStep(stepId, patch);
  };

  const onTimelineStepChange = React.useCallback((stepId: number, patch: {
    expected_start_date: string | null;
    expected_end_date: string | null;
    expected_duration_days: number | null;
  }) => {
    const step = stepById.get(stepId);
    if (!step || Number(step.is_completed) === 1) {
      return;
    }
    const nextStart = toStringOrNull(patch.expected_start_date || '');
    const nextEnd = toStringOrNull(patch.expected_end_date || '');
    const normalizedEnd = (nextStart && nextEnd && nextEnd < nextStart) ? nextStart : nextEnd;
    const nextPatch = {
      ...patch,
      expected_start_date: nextStart,
      expected_end_date: normalizedEnd,
      expected_duration_days: calculateDurationDays(nextStart, normalizedEnd) ?? patch.expected_duration_days,
    };
    updateStepDraft(stepId, nextPatch);
    void commitStep(stepId, nextPatch);
  }, [stepById]);

  const onSubmitNote = async (step: IBuildWizardStep): Promise<boolean> => {
    const draft = String(noteDraftByStep[step.id] || '').trim();
    if (!draft) {
      return false;
    }
    await addStepNote(step.id, draft);
    setNoteDraftByStep((prev) => ({ ...prev, [step.id]: '' }));
    return true;
  };

  const noteEditedAtLabel = React.useCallback((note: { created_at: string; updated_at?: string | null }): string => {
    const createdAt = String(note.created_at || '').trim();
    const updatedAt = String(note.updated_at || '').trim();
    if (!createdAt || !updatedAt || createdAt === updatedAt) {
      return '';
    }
    return formatDate(updatedAt);
  }, []);

  const requestConfirmation = React.useCallback((config: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmButtonClass?: string;
  }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        title: config.title,
        message: config.message,
        confirmLabel: config.confirmLabel || 'Confirm',
        cancelLabel: config.cancelLabel || 'Cancel',
        confirmButtonClass: config.confirmButtonClass || 'btn btn-danger',
        resolve,
      });
    });
  }, []);

  const closeConfirmation = React.useCallback((confirmed: boolean) => {
    setConfirmState((current) => {
      if (current) {
        current.resolve(confirmed);
      }
      return null;
    });
  }, []);

  const onStartEditNote = (noteId: number, noteText: string) => {
    setEditingNoteTextById((prev) => ({ ...prev, [noteId]: noteText }));
  };

  const onCancelEditNote = (noteId: number) => {
    setEditingNoteTextById((prev) => {
      const next = { ...prev };
      delete next[noteId];
      return next;
    });
  };

  const onSaveEditedNote = async (stepId: number, noteId: number) => {
    if (savingNoteId === noteId) {
      return;
    }
    const draft = String(editingNoteTextById[noteId] || '').trim();
    if (!draft) {
      onToast?.({ tone: 'warning', message: 'Note cannot be empty.' });
      return;
    }
    setSavingNoteId(noteId);
    try {
      const ok = await updateStepNote(stepId, noteId, draft);
      if (ok) {
        onCancelEditNote(noteId);
      }
    } finally {
      setSavingNoteId(0);
    }
  };

  const onDeleteStepNoteById = async (stepId: number, noteId: number) => {
    if (deletingNoteId === noteId) {
      return;
    }
    const confirmed = await requestConfirmation({
      title: 'Delete Note?',
      message: 'Delete this note?\n\nThis cannot be undone.',
      confirmLabel: 'Delete',
      confirmButtonClass: 'btn btn-danger',
    });
    if (!confirmed) {
      return;
    }
    setDeletingNoteId(noteId);
    try {
      await deleteStepNote(stepId, noteId);
      onCancelEditNote(noteId);
    } finally {
      setDeletingNoteId(0);
    }
  };

  const onDeleteDocument = async (docId: number, docName: string) => {
    if (docId <= 0 || deletingDocumentId === docId) {
      return;
    }
    const confirmed = await requestConfirmation({
      title: 'Delete Document?',
      message: `Delete "${docName}"?\n\nThis cannot be undone.`,
      confirmLabel: 'Delete',
      confirmButtonClass: 'btn btn-danger',
    });
    if (!confirmed) {
      return;
    }
    setDeletingDocumentId(docId);
    try {
      await deleteDocument(docId);
    } finally {
      setDeletingDocumentId(0);
    }
  };

  const onRemoveDocumentFromStep = async (docId: number, docName: string) => {
    if (docId <= 0 || unlinkingDocumentId === docId) {
      return;
    }
    setUnlinkingDocumentId(docId);
    try {
      await updateDocument(docId, { step_id: null });
    } finally {
      setUnlinkingDocumentId(0);
    }
  };

  const onReplaceDocumentFile = async (doc: IBuildWizardDocument, file: File | null) => {
    if (!file || replacingDocumentId === doc.id) {
      return;
    }
    setReplacingDocumentId(doc.id);
    try {
      await replaceDocument(doc.id, file);
    } finally {
      setReplacingDocumentId(0);
    }
  };

  const isSpreadsheetPreviewDoc = React.useCallback((doc: IBuildWizardDocument): boolean => {
    const ext = fileExtensionFromName(doc.original_name);
    if (ext === 'XLSX' || ext === 'XLSM' || ext === 'XLS') {
      return true;
    }
    const mime = String(doc.mime_type || '').toLowerCase();
    return mime.includes('spreadsheet') || mime.includes('excel');
  }, []);

  const isPlanPreviewDoc = React.useCallback((doc: IBuildWizardDocument): boolean => {
    return fileExtensionFromName(doc.original_name) === 'PLAN';
  }, []);

  const isTextPreviewDoc = React.useCallback((doc: IBuildWizardDocument): boolean => {
    const ext = fileExtensionFromName(doc.original_name);
    if (TEXT_PREVIEW_EXTENSIONS.has(ext)) {
      return true;
    }
    return isTextLikeMime(doc.mime_type || '');
  }, []);

  const openDocumentPreview = React.useCallback(async (doc: IBuildWizardDocument) => {
    const src = String(doc.public_url || '').trim();
    const title = String(doc.original_name || 'Document');
    if (!src) {
      onToast?.({ tone: 'error', message: `Unable to open ${title}` });
      return;
    }

    if (Number(doc.is_image) === 1) {
      setLightboxZoom(1);
      setLightboxDoc({ mode: 'image', src, title });
      return;
    }

    if (isPdfDocument(doc)) {
      setLightboxDoc({ mode: 'embed', src, title });
      return;
    }

    setLightboxZoom(1);
    setLightboxDoc({ mode: 'loading', src, title });
    setLightboxSpreadsheetSheetIndex(0);

    try {
      if (!isSpreadsheetPreviewDoc(doc) && !isPlanPreviewDoc(doc) && !isTextPreviewDoc(doc)) {
        setLightboxDoc({ mode: 'embed', src, title });
        return;
      }

      const blob = await ApiClient.getBlob(src);

      if (isSpreadsheetPreviewDoc(doc)) {
        const bytes = await blob.arrayBuffer();
        const workbook = read(bytes, { type: 'array' });
        const maxRows = 120;
        const maxCols = 24;
        let truncated = false;

        const sheets: SpreadsheetPreviewSheet[] = workbook.SheetNames.map((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rawRows = utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
            header: 1,
            raw: false,
            blankrows: false,
            defval: '',
          });
          const boundedRows = rawRows.slice(0, maxRows).map((row) => {
            const hasExtraCols = row.length > maxCols;
            if (hasExtraCols) {
              truncated = true;
            }
            return row.slice(0, maxCols).map((cell) => String(cell ?? ''));
          });
          if (rawRows.length > maxRows) {
            truncated = true;
          }
          return {
            name: sheetName,
            rows: boundedRows,
          };
        });

        if (!sheets.length) {
          throw new Error('Spreadsheet has no visible sheets');
        }

        setLightboxDoc({ mode: 'spreadsheet', src, title, sheets, truncated });
        return;
      }

      if (isPlanPreviewDoc(doc)) {
        const textRaw = await blob.text();
        const text = textRaw.replace(/\u0000/g, '').trim();
        if (!text) {
          throw new Error('Plan file appears empty');
        }

        const sample = text.slice(0, 2000);
        const nonPrintableCount = sample.replace(/[\t\r\n\x20-\x7E]/g, '').length;
        if (sample.length > 0 && nonPrintableCount / sample.length > 0.2) {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const maxBytes = 4096;
          const bounded = bytes.slice(0, maxBytes);
          const lines: string[] = [];
          for (let offset = 0; offset < bounded.length; offset += 16) {
            const chunk = bounded.slice(offset, offset + 16);
            const hex = Array.from(chunk).map((b) => b.toString(16).padStart(2, '0')).join(' ');
            const ascii = Array.from(chunk).map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
            lines.push(`${offset.toString(16).padStart(6, '0')}  ${hex.padEnd(47, ' ')}  ${ascii}`);
          }
          setLightboxDoc({
            mode: 'plan',
            src,
            title,
            text: lines.join('\n'),
            truncated: bytes.length > maxBytes,
            format: 'hex',
          });
          return;
        }

        const maxChars = 60000;
        const truncated = text.length > maxChars;
        setLightboxDoc({
          mode: 'plan',
          src,
          title,
          text: truncated ? `${text.slice(0, maxChars)}\n\n...truncated for preview...` : text,
          truncated,
          format: 'text',
        });
        return;
      }

      const textRaw = await blob.text();
      const cleanedText = textRaw.replace(/\u0000/g, '');
      if (!cleanedText.trim()) {
        throw new Error('Text file appears empty');
      }
      const truncated = cleanedText.length > LIGHTBOX_TEXT_PREVIEW_MAX_CHARS;
      const boundedText = truncated
        ? `${cleanedText.slice(0, LIGHTBOX_TEXT_PREVIEW_MAX_CHARS)}\n\n...truncated for preview...`
        : cleanedText;
      setLightboxDoc({
        mode: 'text',
        src,
        title,
        text: boundedText,
        truncated,
        taskPreview: parseTaskDocumentPreview(boundedText),
      });
    } catch (err: any) {
      const detail = String(err?.message || '').trim() || 'Failed to load file preview';
      setLightboxDoc({
        mode: 'error',
        src,
        title,
        message: detail,
      });
      onToast?.({ tone: 'warning', message: `${title}: ${detail}` });
    }
  }, [isPlanPreviewDoc, isSpreadsheetPreviewDoc, isTextPreviewDoc, onToast]);

  const lightboxSupportsZoom = Boolean(lightboxDoc && (lightboxDoc.mode === 'image' || lightboxDoc.mode === 'spreadsheet' || lightboxDoc.mode === 'plan'));

  const onLightboxWheelZoom = React.useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!lightboxSupportsZoom) {
      return;
    }
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    const delta = (e.shiftKey ? LIGHTBOX_ZOOM_STEP_FAST : LIGHTBOX_ZOOM_STEP) * direction;
    setLightboxZoom((prev) => clampLightboxZoom(prev + delta));
  }, [lightboxSupportsZoom]);

  const selectTopbarSearchResult = React.useCallback((result: BuildWizardSearchResult) => {
    setTopbarSearchOpen(false);

    if (result.kind === 'phase') {
      setActiveTab(result.phaseId);
      return;
    }

    if (result.kind === 'step') {
      setActiveTab(result.phaseId);
      setExpandedStepById((prev) => ({ ...prev, [result.stepId]: true }));
      setTopbarSearchFocusStepId(0);
      window.setTimeout(() => setTopbarSearchFocusStepId(result.stepId), 0);
      return;
    }

    if (result.linkedPhaseId) {
      setActiveTab(result.linkedPhaseId);
    }
    if (result.linkedStepId > 0) {
      setExpandedStepById((prev) => ({ ...prev, [result.linkedStepId]: true }));
      setTopbarSearchFocusStepId(0);
      window.setTimeout(() => setTopbarSearchFocusStepId(result.linkedStepId), 0);
      return;
    }
    void openDocumentPreview(result.document);
  }, [openDocumentPreview]);

  const onDeleteProject = async (projectSummary: { id: number; title: string }) => {
    if (deletingProjectId === projectSummary.id || projectSummary.id <= 0) {
      return;
    }
    const confirmed = await requestConfirmation({
      title: 'Delete Project?',
      message: `Delete "${projectSummary.title}"?\n\nThis will permanently purge this project and all related records from the database.`,
      confirmLabel: 'Delete Project',
      confirmButtonClass: 'btn btn-danger',
    });
    if (!confirmed) {
      return;
    }
    setDeletingProjectId(projectSummary.id);
    try {
      await deleteProject(projectSummary.id);
    } finally {
      setDeletingProjectId(0);
    }
  };

  const onStartNewDeskContact = React.useCallback(() => {
    setDeskCreateMode(true);
    setDeskSelectedContactId(0);
    setDeskContactDraft({
      display_name: '',
      email: '',
      phone: '',
      company: '',
      role_title: '',
      notes: '',
      contact_type: 'contact',
      is_vendor: 0,
      is_project_only: 1,
      vendor_type: '',
      vendor_license: '',
      vendor_trade: '',
      vendor_website: '',
    });
  }, []);

  const onSaveDeskContact = React.useCallback(async () => {
    if (projectId <= 0) {
      return;
    }
    const next = await saveContact({
      project_id: projectId,
      contact_id: deskContactDraft.contact_id,
      display_name: deskContactDraft.display_name,
      contact_type: deskContactDraft.contact_type,
      email: toStringOrNull(deskContactDraft.email),
      phone: toStringOrNull(deskContactDraft.phone),
      company: toStringOrNull(deskContactDraft.company),
      role_title: toStringOrNull(deskContactDraft.role_title),
      notes: toStringOrNull(deskContactDraft.notes),
      is_vendor: deskContactDraft.contact_type === 'vendor' ? 1 : 0,
      is_project_only: deskContactDraft.is_project_only,
      vendor_type: toStringOrNull(deskContactDraft.vendor_type),
      vendor_license: toStringOrNull(deskContactDraft.vendor_license),
      vendor_trade: toStringOrNull(deskContactDraft.vendor_trade),
      vendor_website: toStringOrNull(deskContactDraft.vendor_website),
    });
    if (next?.id) {
      setDeskCreateMode(false);
      setDeskSelectedContactId(next.id);
    }
  }, [deskContactDraft, projectId, saveContact]);

  const onDeleteDeskContact = React.useCallback(async () => {
    if (projectId <= 0 || !selectedDeskContact) {
      return;
    }
    const confirmed = await requestConfirmation({
      title: 'Delete Contact?',
      message: `Delete contact "${selectedDeskContact.display_name}"?`,
      confirmLabel: 'Delete Contact',
      confirmButtonClass: 'btn btn-danger',
    });
    if (!confirmed) {
      return;
    }
    const didDelete = await deleteContact(projectId, selectedDeskContact.id);
    if (!didDelete) {
      return;
    }
    const fallback = deskContacts.find((contact) => contact.id !== selectedDeskContact.id);
    setDeskSelectedContactId(fallback?.id || 0);
  }, [deleteContact, deskContacts, projectId, requestConfirmation, selectedDeskContact]);

  const onAddDeskPhaseAssignment = React.useCallback(async () => {
    if (projectId <= 0 || !selectedDeskContact) {
      return;
    }
    await addContactAssignment({
      project_id: projectId,
      contact_id: selectedDeskContact.id,
      phase_key: deskAssignmentPhaseKey,
    });
  }, [addContactAssignment, deskAssignmentPhaseKey, projectId, selectedDeskContact]);

  const onAddDeskStepAssignment = React.useCallback(async () => {
    if (projectId <= 0 || !selectedDeskContact || deskAssignmentStepId <= 0) {
      return;
    }
    await addContactAssignment({
      project_id: projectId,
      contact_id: selectedDeskContact.id,
      step_id: deskAssignmentStepId,
    });
  }, [addContactAssignment, deskAssignmentStepId, projectId, selectedDeskContact]);

  const onAddContactToStep = React.useCallback(async (stepId: number, contactId: number) => {
    if (projectId <= 0 || stepId <= 0 || contactId <= 0) {
      return;
    }
    const saved = await addContactAssignment({
      project_id: projectId,
      contact_id: contactId,
      step_id: stepId,
    });
    if (saved) {
      setStepContactCandidateByStepId((prev) => ({ ...prev, [stepId]: '' }));
      setStepContactPickerOpenByStepId((prev) => ({ ...prev, [stepId]: false }));
    }
  }, [addContactAssignment, projectId]);

  const onAutoAssignDeskStepsToTimeline = React.useCallback(async () => {
    if (deskAutoAssignBusy || aiBusy) {
      return;
    }
    const initialDeskSteps = steps.filter((step) => stepPhaseBucket(step) === 'desk');
    if (!initialDeskSteps.length) {
      onToast?.({ tone: 'info', message: 'No Project Desk steps are waiting for timeline placement.' });
      return;
    }

    const normalizePhaseKey = (value: string | null | undefined): string => {
      const normalized = String(value || '').trim().toLowerCase();
      return normalized === '' ? 'general' : normalized;
    };
    const orderedPhaseKeys = [
      'design_preconstruction',
      'site_preparation',
      'framing_shell',
      'mep_rough_in',
      'interior_finishes',
      'inspections_closeout',
    ];
    const phaseRank = new Map<string, number>(orderedPhaseKeys.map((key, index) => [key, index]));
    setDeskAutoAssignBusy(true);
    let movedCount = 0;
    let aiPlacedCount = 0;

    try {
      let candidateSteps: IBuildWizardStep[] = steps;
      const aiResponse = await generateStepsFromAi('fill_missing');
      if (Array.isArray(aiResponse?.steps) && aiResponse.steps.length > 0) {
        candidateSteps = aiResponse.steps;
      }
      const deskSteps = candidateSteps.filter((step) => stepPhaseBucket(step) === 'desk');
      aiPlacedCount = Math.max(0, initialDeskSteps.length - deskSteps.length);
      if (!deskSteps.length) {
        onToast?.({
          tone: 'success',
          message: `Placed ${aiPlacedCount} lost step${aiPlacedCount === 1 ? '' : 's'} on the build timeline with AI.`,
        });
        return;
      }
      const stepById = new Map<number, IBuildWizardStep>(candidateSteps.map((step) => [step.id, step]));
      const dependentById = new Map<number, number[]>();
      candidateSteps.forEach((candidate) => {
        (Array.isArray(candidate.depends_on_step_ids) ? candidate.depends_on_step_ids : []).forEach((dependencyId) => {
          const list = dependentById.get(dependencyId) || [];
          list.push(candidate.id);
          dependentById.set(dependencyId, list);
        });
      });
      const sortedDeskSteps = [...deskSteps].sort((a, b) => {
        if (a.step_order !== b.step_order) {
          return a.step_order - b.step_order;
        }
        return a.id - b.id;
      });
      const assignedByStepId = new Map<number, string>();

      const inferFromRelatedSteps = (step: IBuildWizardStep): string | null => {
        const dependencyRanks: number[] = [];
        (Array.isArray(step.depends_on_step_ids) ? step.depends_on_step_ids : []).forEach((depId) => {
          const explicit = assignedByStepId.get(depId) || normalizePhaseKey(stepById.get(depId)?.phase_key);
          const explicitRank = phaseRank.get(explicit);
          if (typeof explicitRank === 'number') {
            dependencyRanks.push(explicitRank);
            return;
          }
          const hinted = recommendPhaseKeyForStep(stepById.get(depId) || ({} as IBuildWizardStep));
          const hintRank = hinted ? phaseRank.get(hinted) : undefined;
          if (typeof hintRank === 'number') {
            dependencyRanks.push(hintRank);
          }
        });
        if (dependencyRanks.length) {
          return orderedPhaseKeys[Math.max(...dependencyRanks)];
        }

        const dependentRanks: number[] = [];
        (dependentById.get(step.id) || []).forEach((childId) => {
          const explicit = assignedByStepId.get(childId) || normalizePhaseKey(stepById.get(childId)?.phase_key);
          const explicitRank = phaseRank.get(explicit);
          if (typeof explicitRank === 'number') {
            dependentRanks.push(explicitRank);
            return;
          }
          const hinted = recommendPhaseKeyForStep(stepById.get(childId) || ({} as IBuildWizardStep));
          const hintRank = hinted ? phaseRank.get(hinted) : undefined;
          if (typeof hintRank === 'number') {
            dependentRanks.push(hintRank);
          }
        });
        if (dependentRanks.length) {
          const rank = Math.max(0, Math.min(...dependentRanks) - 1);
          return orderedPhaseKeys[rank];
        }
        return null;
      };

      const inferByOrderFallback = (step: IBuildWizardStep): string => {
        const sortedAll = [...candidateSteps].sort((a, b) => {
          if (a.step_order !== b.step_order) {
            return a.step_order - b.step_order;
          }
          return a.id - b.id;
        });
        const idx = Math.max(0, sortedAll.findIndex((candidate) => candidate.id === step.id));
        const ratio = sortedAll.length > 1 ? (idx / (sortedAll.length - 1)) : 0;
        if (ratio < 0.2) {
          return 'design_preconstruction';
        }
        if (ratio < 0.38) {
          return 'site_preparation';
        }
        if (ratio < 0.56) {
          return 'framing_shell';
        }
        if (ratio < 0.74) {
          return 'mep_rough_in';
        }
        if (ratio < 0.9) {
          return 'interior_finishes';
        }
        return 'inspections_closeout';
      };

      for (const step of sortedDeskSteps) {
        const suggestedPhaseKey =
          recommendPhaseKeyForStep(step)
          || inferFromRelatedSteps(step)
          || inferByOrderFallback(step);
        const currentPhaseKey = String(step.phase_key || '').trim().toLowerCase() || 'general';
        assignedByStepId.set(step.id, suggestedPhaseKey);
        if (currentPhaseKey !== suggestedPhaseKey) {
          await updateStep(step.id, { phase_key: suggestedPhaseKey });
          movedCount += 1;
        }
      }
      onToast?.({
        tone: 'success',
        message: `Placed ${movedCount + aiPlacedCount} lost step${movedCount + aiPlacedCount === 1 ? '' : 's'} on the build timeline.`,
      });
    } finally {
      setDeskAutoAssignBusy(false);
    }
  }, [aiBusy, deskAutoAssignBusy, generateStepsFromAi, onToast, steps, updateStep]);

  const onRunSingletreeRecovery = async (apply: boolean) => {
    if (!isAdmin) {
      return;
    }
    if (recoveryBusy) {
      return;
    }
    if (apply) {
      const confirmed = await requestConfirmation({
        title: 'Apply Recovery?',
        message: 'Apply Singletree recovery now?\n\nThis will write document mappings/blobs for "Cabin - 91 Singletree Ln".',
        confirmLabel: 'Apply Recovery',
        confirmButtonClass: 'btn btn-danger',
      });
      if (!confirmed) {
        return;
      }
    }
    const host = (typeof window !== 'undefined') ? String(window.location.hostname || '').toLowerCase() : '';
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
    const sourceRootToUse = String(recoveryStagedRoot || '').trim() || '/Users/jongraves/Documents/Home/91 Singletree Ln';

    if (!isLocalHost && !String(recoveryStagedRoot || '').trim()) {
      onToast?.({
        tone: 'error',
        message: 'Upload source files to server first, then run recovery.',
      });
      setRecoveryReportOpen(true);
      return;
    }

    const res = await recoverSingletreeDocuments(apply, {
      db_env: 'live',
      project_title: 'Cabin - 91 Singletree Ln',
      source_root: sourceRootToUse,
    });
    if (res) {
      setRecoveryReportJson(JSON.stringify(res, null, 2));
      setRecoveryJobId(String(res.job_id || ''));
      setRecoveryStatus(String(res.status || 'queued'));
      setRecoveryReportOpen(true);
    }
  };

  const onUploadRecoveryFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || recoveryUploadBusy) {
      return;
    }
    setRecoveryUploadBusy(true);
    try {
      const fileArray = Array.from(files);
      const batchSize = 12;
      let token = recoveryUploadToken || '';
      let totalSaved = 0;
      let stagedRoot = recoveryStagedRoot || '';

      for (let i = 0; i < fileArray.length; i += batchSize) {
        const batch = fileArray.slice(i, i + batchSize);
        const res = await stageSingletreeSourceFiles(batch, token || undefined);
        if (!res?.success) {
          break;
        }
        token = String(res.upload_token || token);
        stagedRoot = String(res.staged_root || stagedRoot);
        totalSaved += Number(res.files_saved || 0);
      }

      if (token) {
        setRecoveryUploadToken(token);
      }
      if (stagedRoot) {
        setRecoveryStagedRoot(stagedRoot);
      }
      if (totalSaved > 0) {
        setRecoveryStagedCount((prev) => prev + totalSaved);
        setRecoveryReportOpen(true);
      }
    } finally {
      setRecoveryUploadBusy(false);
      if (recoveryUploadInputRef.current) {
        recoveryUploadInputRef.current.value = '';
      }
    }
  };

  React.useEffect(() => {
    if (!recoveryJobId) {
      return;
    }
    if (recoveryStatus === 'completed' || recoveryStatus === 'failed') {
      return;
    }
    let cancelled = false;
    const timer = window.setInterval(async () => {
      if (cancelled) {
        return;
      }
      if (recoveryPolling) {
        return;
      }
      setRecoveryPolling(true);
      try {
        const status = await fetchSingletreeRecoveryStatus(recoveryJobId);
        if (!status) {
          return;
        }
        setRecoveryStatus(String(status.status || ''));
        setRecoveryReportJson(JSON.stringify(status, null, 2));
        if (Number(status.completed || 0) === 1 || status.status === 'completed' || status.status === 'failed') {
          setRecoveryJobId('');
        }
      } finally {
        if (!cancelled) {
          setRecoveryPolling(false);
        }
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [recoveryJobId, recoveryStatus, recoveryPolling, fetchSingletreeRecoveryStatus]);

  const expandPhaseRangeForStep = React.useCallback(async (
    step: IBuildWizardStep,
    overrides?: Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>,
  ) => {
    const tabId = stepPhaseBucket(step);
    if (!PHASE_PROGRESS_ORDER.includes(tabId)) {
      return;
    }
    const stepStart = toStringOrNull((overrides?.expected_start_date ?? step.expected_start_date) || '');
    const stepEnd = toStringOrNull((overrides?.expected_end_date ?? step.expected_end_date) || '') || stepStart;
    if (!stepStart && !stepEnd) {
      return;
    }
    const currentRange = resolvePhaseDateRange(tabId);
    const nextStart = stepStart
      ? (currentRange.start ? (stepStart < currentRange.start ? stepStart : currentRange.start) : stepStart)
      : currentRange.start;
    const nextEnd = stepEnd
      ? (currentRange.end ? (stepEnd > currentRange.end ? stepEnd : currentRange.end) : stepEnd)
      : currentRange.end;
    if (nextStart === currentRange.start && nextEnd === currentRange.end) {
      return;
    }
    await savePhaseDateRange(projectId, tabId as 'land' | 'permits' | 'site' | 'framing' | 'mep' | 'finishes', nextStart || null, nextEnd || null);
  }, [projectId, resolvePhaseDateRange, savePhaseDateRange]);

  const reconcileStepFromTaskDates = React.useCallback(async (
    stepId: number,
    documentOverrides?: Map<number, IBuildWizardDocument>,
  ) => {
    const step = stepById.get(stepId);
    if (!step || stepId <= 0) {
      return;
    }
    const mergedDocuments = documents.map((doc) => documentOverrides?.get(doc.id) || doc);
    if (documentOverrides && documentOverrides.size > 0) {
      documentOverrides.forEach((doc, id) => {
        if (!mergedDocuments.some((existing) => existing.id === id)) {
          mergedDocuments.push(doc);
        }
      });
    }
    const receiptsForStep = mergedDocuments
      .filter((doc) => String(doc.kind || '').trim() === 'receipt' && Number(doc.step_id || 0) === stepId);
    const taskDates = receiptsForStep
      .map((doc) => toStringOrNull(doc.receipt_date || ''))
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => a.localeCompare(b));

    let nextStart = toStringOrNull(step.expected_start_date || '');
    let nextEnd = toStringOrNull(step.expected_end_date || '');
    if (taskDates.length > 0) {
      const minTaskDate = taskDates[0];
      const maxTaskDate = taskDates[taskDates.length - 1];
      if (!nextStart || nextStart > minTaskDate) {
        nextStart = minTaskDate;
      }
      if (!nextEnd || nextEnd < maxTaskDate) {
        nextEnd = maxTaskDate;
      }
    }
    if (nextStart && nextEnd && nextEnd < nextStart) {
      nextEnd = nextStart;
    }
    const nextDuration = calculateDurationDays(nextStart, nextEnd);
    const startChanged = nextStart !== toStringOrNull(step.expected_start_date || '');
    const endChanged = nextEnd !== toStringOrNull(step.expected_end_date || '');
    const durationChanged = nextDuration !== (step.expected_duration_days ?? null);
    if (!startChanged && !endChanged && !durationChanged) {
      if (taskDates.length > 0) {
        await expandPhaseRangeForStep(step, { expected_start_date: nextStart, expected_end_date: nextEnd });
      }
      return;
    }

    const patch: Partial<IBuildWizardStep> = {};
    if (startChanged) {
      patch.expected_start_date = nextStart;
    }
    if (endChanged) {
      patch.expected_end_date = nextEnd;
    }
    if (durationChanged) {
      patch.expected_duration_days = nextDuration;
    }
    await updateStep(stepId, patch);
    await expandPhaseRangeForStep(step, { expected_start_date: nextStart, expected_end_date: nextEnd });
  }, [documents, expandPhaseRangeForStep, stepById, updateStep]);

  const onSaveDocument = async (
    documentId: number,
    patch: {
      kind?: string;
      caption?: string | null;
      step_id?: number | null;
      receipt_parent_document_id?: number | null;
      receipt_amount?: number | null;
      receipt_title?: string | null;
      receipt_vendor?: string | null;
      receipt_date?: string | null;
      receipt_notes?: string | null;
    },
  ) => {
    if (documentSavingId === documentId) {
      return null;
    }
    const previousDocument = documents.find((doc) => doc.id === documentId) || null;
    setDocumentSavingId(documentId);
    try {
      const savedDocument = await updateDocument(documentId, patch);
      if (savedDocument) {
        const touchesTaskDateAuthority = Object.prototype.hasOwnProperty.call(patch, 'receipt_date')
          || Object.prototype.hasOwnProperty.call(patch, 'step_id')
          || Object.prototype.hasOwnProperty.call(patch, 'kind');
        const previousWasTask = String(previousDocument?.kind || '').trim() === 'receipt';
        const currentIsTask = String(savedDocument.kind || '').trim() === 'receipt';
        if (touchesTaskDateAuthority && (previousWasTask || currentIsTask)) {
          const impactedStepIds = new Set<number>();
          if (previousWasTask) {
            const previousStepId = Number(previousDocument?.step_id || 0);
            if (previousStepId > 0) {
              impactedStepIds.add(previousStepId);
            }
          }
          if (currentIsTask) {
            const currentStepId = Number(savedDocument.step_id || 0);
            if (currentStepId > 0) {
              impactedStepIds.add(currentStepId);
            }
          }
          const overrides = new Map<number, IBuildWizardDocument>();
          overrides.set(savedDocument.id, savedDocument);
          for (const stepId of impactedStepIds) {
            await reconcileStepFromTaskDates(stepId, overrides);
          }
        }
      }
      return savedDocument;
    } finally {
      setDocumentSavingId(0);
    }
  };

  const taskVendorOptions = React.useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((contact) => {
      const name = String(contact.display_name || '').trim();
      if (name !== '') {
        set.add(name);
      }
      const company = String(contact.company || '').trim();
      if (company !== '') {
        set.add(company);
      }
    });
    documents.forEach((doc) => {
      if (String(doc.kind || '').trim() !== 'receipt') {
        return;
      }
      const vendor = String(doc.receipt_vendor || '').trim();
      if (vendor !== '') {
        set.add(vendor);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [contacts, documents]);

  React.useEffect(() => {
    if (pendingScrollReceiptId <= 0) {
      return;
    }
    const rowEl = receiptRowRefByDocId.current[pendingScrollReceiptId];
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setPendingScrollReceiptId(0);
      return;
    }
    const timer = window.setTimeout(() => {
      const delayedEl = receiptRowRefByDocId.current[pendingScrollReceiptId];
      if (delayedEl) {
        delayedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setPendingScrollReceiptId(0);
    }, 120);
    return () => {
      window.clearTimeout(timer);
    };
  }, [documents, pendingScrollReceiptId]);

  const startInlineReceiptEdit = (
    doc: IBuildWizardDocument,
    parsed: { taskMeta: BuildWizardTaskMeta; plainNotes: string },
    field: InlineReceiptField,
  ) => {
    setInlineReceiptDraftByDocId((prev) => ({
      ...prev,
      [doc.id]: {
        vendor: doc.receipt_vendor || '',
        date: doc.receipt_date || '',
        amount: doc.receipt_amount !== null && Number.isFinite(Number(doc.receipt_amount)) ? String(doc.receipt_amount) : '',
        taskType: parsed.taskMeta.task_type,
        plainNotes: parsed.plainNotes || '',
        taskMeta: parsed.taskMeta,
      },
    }));
    setInlineEditingReceiptFieldByDocId((prev) => ({ ...prev, [doc.id]: field }));
  };

  const saveInlineReceiptEdit = async (
    doc: IBuildWizardDocument,
    field: InlineReceiptField,
    overrides?: Partial<{
      vendor: string;
      date: string;
      amount: string;
      taskType: BuildWizardTaskType;
    }>,
  ) => {
    const baseDraft = inlineReceiptDraftByDocId[doc.id];
    const draft = baseDraft ? { ...baseDraft, ...(overrides || {}) } : null;
    if (!draft) {
      setInlineEditingReceiptFieldByDocId((prev) => ({ ...prev, [doc.id]: null }));
      return;
    }

    const patch: {
      receipt_vendor?: string | null;
      receipt_date?: string | null;
      receipt_amount?: number | null;
      receipt_notes?: string | null;
    } = {};

    if (field === 'vendor') {
      patch.receipt_vendor = toStringOrNull(draft.vendor);
    } else if (field === 'date') {
      patch.receipt_date = toStringOrNull(draft.date);
    } else if (field === 'amount') {
      patch.receipt_amount = toNumberOrNull(draft.amount);
    } else if (field === 'type') {
      const nextMeta: BuildWizardTaskMeta = {
        ...draft.taskMeta,
        task_type: draft.taskType,
      };
      patch.receipt_notes = toStringOrNull(composeReceiptNotesWithTaskMeta(nextMeta, draft.plainNotes));
    }

    await onSaveDocument(doc.id, patch);
    setInlineEditingReceiptFieldByDocId((prev) => ({ ...prev, [doc.id]: null }));
  };

  const updateDocumentDraft = (
    documentId: number,
    patch: Partial<{
      kind: string;
      caption: string;
      step_id: number;
      receipt_amount: string;
      receipt_title: string;
      receipt_vendor: string;
      receipt_date: string;
      receipt_notes: string;
    }>,
  ) => {
    setDocumentDrafts((prev) => ({
      ...prev,
      [documentId]: {
        kind: patch.kind ?? (prev[documentId]?.kind || 'other'),
        caption: patch.caption ?? (prev[documentId]?.caption || ''),
        step_id: patch.step_id ?? (prev[documentId]?.step_id || 0),
        receipt_amount: patch.receipt_amount ?? (prev[documentId]?.receipt_amount || ''),
        receipt_title: patch.receipt_title ?? (prev[documentId]?.receipt_title || ''),
        receipt_vendor: patch.receipt_vendor ?? (prev[documentId]?.receipt_vendor || ''),
        receipt_date: patch.receipt_date ?? (prev[documentId]?.receipt_date || ''),
        receipt_notes: patch.receipt_notes ?? (prev[documentId]?.receipt_notes || ''),
      },
    }));
  };

  const buildDocumentDraft = React.useCallback((doc: IBuildWizardDocument) => {
    return documentDrafts[doc.id] || {
      kind: doc.kind || 'other',
      caption: doc.caption || '',
      step_id: Number(doc.step_id || 0),
      receipt_amount: doc.receipt_amount !== null && Number.isFinite(Number(doc.receipt_amount))
        ? String(doc.receipt_amount)
        : '',
      receipt_title: doc.receipt_title || '',
      receipt_vendor: doc.receipt_vendor || '',
      receipt_date: doc.receipt_date || '',
      receipt_notes: doc.receipt_notes || '',
    };
  }, [documentDrafts]);

  const onSaveDocumentDraft = async (doc: IBuildWizardDocument) => {
    const draft = buildDocumentDraft(doc);
    await onSaveDocument(doc.id, {
      kind: draft.kind,
      caption: draft.caption.trim() || null,
      step_id: draft.step_id > 0 ? draft.step_id : null,
      receipt_amount: draft.kind === 'receipt' ? toNumberOrNull(draft.receipt_amount) : null,
      receipt_title: draft.kind === 'receipt' ? toStringOrNull(draft.receipt_title) : null,
      receipt_vendor: draft.kind === 'receipt' ? toStringOrNull(draft.receipt_vendor) : null,
      receipt_date: draft.kind === 'receipt' ? toStringOrNull(draft.receipt_date) : null,
      receipt_notes: draft.kind === 'receipt' ? toStringOrNull(draft.receipt_notes) : null,
    });
  };

  const onSaveReceiptForStep = async (step: IBuildWizardStep) => {
    if (projectId <= 0) {
      return;
    }
    const draft = receiptDraftByStep[step.id] || {
      receipt_title: '',
      receipt_vendor: '',
      receipt_date: '',
      receipt_amount: '',
      receipt_notes: '',
      task_meta: defaultTaskMeta((step.step_type || 'construction') as BuildWizardTaskType),
    };
    const editingReceiptDocumentId = Number(editingReceiptDocumentIdByStep[step.id] || 0);
    const existingReceipt = editingReceiptDocumentId > 0
      ? documents.find((doc) => doc.id === editingReceiptDocumentId)
      : null;
    const shouldScrollBackToReceipt = existingReceipt !== null;
    let receiptId = 0;

    if (existingReceipt) {
      const updated = await onSaveDocument(existingReceipt.id, {
        kind: 'receipt',
        step_id: step.id,
        caption: toStringOrNull(draft.receipt_title || step.title),
        receipt_title: toStringOrNull(draft.receipt_title),
        receipt_vendor: toStringOrNull(draft.receipt_vendor),
        receipt_date: toStringOrNull(draft.receipt_date),
        receipt_amount: toNumberOrNull(draft.receipt_amount),
        receipt_notes: toStringOrNull(composeReceiptNotesWithTaskMeta(draft.task_meta, draft.receipt_notes)),
      });
      if (!updated) {
        return;
      }
      receiptId = existingReceipt.id;
    } else {
      const created = await createStepReceipt({
        project_id: projectId,
        step_id: step.id,
        receipt_title: toStringOrNull(draft.receipt_title),
        receipt_vendor: toStringOrNull(draft.receipt_vendor),
        receipt_date: toStringOrNull(draft.receipt_date),
        receipt_amount: toNumberOrNull(draft.receipt_amount),
        receipt_notes: toStringOrNull(composeReceiptNotesWithTaskMeta(draft.task_meta, draft.receipt_notes)),
        caption: toStringOrNull(draft.receipt_title || step.title),
      });
      if (!created?.id) {
        return;
      }
      receiptId = created.id;
      const overrides = new Map<number, IBuildWizardDocument>();
      overrides.set(created.id, created);
      await reconcileStepFromTaskDates(step.id, overrides);
    }

    const files = receiptAttachmentDraftByStep[step.id] || [];
    for (const file of files) {
      await uploadDocument(
        'receipt_attachment',
        file,
        step.id,
        `Attachment: ${draft.receipt_title || step.title}`,
        step.phase_key,
        undefined,
        { receipt_parent_document_id: receiptId },
      );
    }
    setReceiptDraftByStep((prev) => ({ ...prev, [step.id]: {
      receipt_title: '',
      receipt_vendor: '',
      receipt_date: '',
      receipt_amount: '',
      receipt_notes: '',
      task_meta: defaultTaskMeta((step.step_type || 'construction') as BuildWizardTaskType),
    } }));
    setReceiptAttachmentDraftByStep((prev) => ({ ...prev, [step.id]: [] }));
    setEditingReceiptDocumentIdByStep((prev) => ({ ...prev, [step.id]: 0 }));
    setReceiptEditorOpenByStep((prev) => ({ ...prev, [step.id]: false }));
    if (shouldScrollBackToReceipt && receiptId > 0) {
      setPendingScrollReceiptId(receiptId);
    }
  };

  const onStartEditReceiptForStep = (step: IBuildWizardStep, doc: IBuildWizardDocument) => {
    const parsed = parseTaskMetaFromReceiptNotes(doc.receipt_notes || '');
    setEditingReceiptDocumentIdByStep((prev) => ({ ...prev, [step.id]: doc.id }));
    setReceiptDraftByStep((prev) => ({ ...prev, [step.id]: {
      receipt_title: doc.receipt_title || '',
      receipt_vendor: doc.receipt_vendor || '',
      receipt_date: doc.receipt_date || '',
      receipt_amount: doc.receipt_amount !== null && Number.isFinite(Number(doc.receipt_amount))
        ? String(doc.receipt_amount)
        : '',
      receipt_notes: parsed.plainNotes || '',
      task_meta: parsed.taskMeta,
    } }));
    setReceiptAttachmentDraftByStep((prev) => ({ ...prev, [step.id]: [] }));
    setReceiptEditorOpenByStep((prev) => ({ ...prev, [step.id]: true }));
    window.setTimeout(() => {
      const editorEl = receiptEditorRefByStepId.current[step.id];
      if (editorEl) {
        editorEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  };

  const onAttachExistingDocumentToReceipt = async (step: IBuildWizardStep, receiptDoc: IBuildWizardDocument) => {
    const selectedDocumentId = Number(attachExistingDocByReceiptId[receiptDoc.id] || 0);
    if (selectedDocumentId <= 0) {
      return;
    }
    if (selectedDocumentId === receiptDoc.id) {
      onToast?.({ tone: 'warning', message: 'A task cannot attach itself.' });
      return;
    }
    const selectedDocument = documents.find((doc) => doc.id === selectedDocumentId);
    if (!selectedDocument) {
      onToast?.({ tone: 'warning', message: 'Selected document is no longer available. Refresh and try again.' });
      return;
    }
    const alreadyAttachedToThisTask = String(selectedDocument.kind || '').trim() === 'receipt_attachment'
      && Number(selectedDocument.receipt_parent_document_id || 0) === receiptDoc.id;
    if (alreadyAttachedToThisTask) {
      onToast?.({ tone: 'info', message: 'Document is already attached to this task.' });
      return;
    }
    await onSaveDocument(selectedDocumentId, {
      kind: 'receipt_attachment',
      step_id: step.id,
      receipt_parent_document_id: receiptDoc.id,
    });
    setAttachExistingDocByReceiptId((prev) => ({ ...prev, [receiptDoc.id]: '' }));
  };

  const onUploadReceiptAttachments = (receiptDoc: IBuildWizardDocument, files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    const stepId = Number(receiptDoc.step_id || 0);
    Array.from(files).forEach((file) => {
      void uploadDocument(
        'receipt_attachment',
        file,
        stepId > 0 ? stepId : undefined,
        `Attachment: ${receiptDoc.receipt_title || receiptDoc.original_name}`,
        receiptDoc.step_phase_key || undefined,
        undefined,
        { receipt_parent_document_id: receiptDoc.id },
      );
    });
  };

  const onAttachExistingDocumentToStep = async (step: IBuildWizardStep) => {
    const selectedDocumentId = Number(attachExistingDocByStepId[step.id] || 0);
    if (selectedDocumentId <= 0) {
      return;
    }
    const selectedDocument = documents.find((doc) => doc.id === selectedDocumentId);
    if (!selectedDocument) {
      onToast?.({ tone: 'warning', message: 'Selected document is no longer available. Refresh and try again.' });
      return;
    }
    if (Number(selectedDocument.step_id || 0) === step.id) {
      onToast?.({ tone: 'info', message: 'Document is already linked to this step.' });
      return;
    }
    await onSaveDocument(selectedDocumentId, { step_id: step.id });
    setAttachExistingDocByStepId((prev) => ({ ...prev, [step.id]: '' }));
  };

  const onEstimateMissingWithAi = async () => {
    const confirmed = await requestConfirmation({
      title: 'Estimate Missing Values?',
      message: 'Ask AI to estimate missing timeline and budget values for this project?',
      confirmLabel: 'Run AI Estimate',
      confirmButtonClass: 'btn btn-primary',
    });
    if (!confirmed) {
      return;
    }
    await generateStepsFromAi('fill_missing');
  };

  const onCompleteWithAi = async () => {
    const confirmed = await requestConfirmation({
      title: 'Run Complete w/ AI?',
      message: 'This can reorder/add/update steps across phases using your project data and documents.',
      confirmLabel: 'Run Complete w/ AI',
      confirmButtonClass: 'btn btn-primary',
    });
    if (!confirmed) {
      return;
    }
    await generateStepsFromAi('complete');
  };

  const clearStepDragState = () => {
    setDraggingStepId(0);
    setDragOverInsertIndex(-1);
    setDragOverParentStepId(0);
  };

  const beginStepDrag = (e: React.DragEvent<HTMLElement>, stepId: number, stepReadOnly: boolean): void => {
    if (stepReadOnly || stepId <= 0) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(stepId));
    setDraggingStepId(stepId);
  };

  const parseCurrencyText = (value: string): number | null => {
    const cleaned = String(value || '')
      .replace(/[^0-9.-]/g, '')
      .trim();
    if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') {
      return null;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatCurrencyForInput = (value: number | null | undefined): string => {
    if (value === null || typeof value === 'undefined' || Number.isNaN(Number(value))) {
      return '';
    }
    return Number(value).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  };

  const startCurrencyEdit = (key: string, value: number | null | undefined): void => {
    setActiveCurrencyInputKey(key);
    setCurrencyInputByKey((prev) => ({
      ...prev,
      [key]: value === null || typeof value === 'undefined' || Number.isNaN(Number(value))
        ? ''
        : String(value),
    }));
  };

  const changeCurrencyEdit = (key: string, text: string): void => {
    setCurrencyInputByKey((prev) => ({ ...prev, [key]: text }));
  };

  const finishCurrencyEdit = (key: string, onCommit: (value: number | null) => void): void => {
    const parsed = parseCurrencyText(currencyInputByKey[key] ?? '');
    onCommit(parsed);
    if (activeCurrencyInputKey === key) {
      setActiveCurrencyInputKey('');
    }
    setCurrencyInputByKey((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const renderCurrencyInputValue = (key: string, value: number | null | undefined): string => {
    if (activeCurrencyInputKey === key) {
      return currencyInputByKey[key] ?? (value === null || typeof value === 'undefined' ? '' : String(value));
    }
    return formatCurrencyForInput(value);
  };

  const clampStepDatesWithinRange = (
    step: Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>,
    minDate?: string | null,
    maxDate?: string | null,
  ): Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date' | 'expected_duration_days'> | null => {
    const lower = toStringOrNull(minDate || '');
    const upper = toStringOrNull(maxDate || '');
    if (!lower && !upper) {
      return null;
    }

    let nextStart = toStringOrNull(step.expected_start_date || '');
    let nextEnd = toStringOrNull(step.expected_end_date || '');

    if (!nextStart) {
      nextStart = lower || upper || null;
    }
    if (!nextEnd) {
      nextEnd = nextStart;
    }

    if (lower && nextStart && nextStart < lower) {
      nextStart = lower;
    }
    if (upper && nextStart && nextStart > upper) {
      nextStart = upper;
    }
    if (lower && nextEnd && nextEnd < lower) {
      nextEnd = lower;
    }
    if (upper && nextEnd && nextEnd > upper) {
      nextEnd = upper;
    }
    if (nextStart && nextEnd && nextEnd < nextStart) {
      nextEnd = nextStart;
    }

    const changed = nextStart !== toStringOrNull(step.expected_start_date || '')
      || nextEnd !== toStringOrNull(step.expected_end_date || '');
    if (!changed) {
      return null;
    }
    return {
      expected_start_date: nextStart,
      expected_end_date: nextEnd,
      expected_duration_days: calculateDurationDays(nextStart, nextEnd) ?? null,
    };
  };

  const clampStepDatesBetweenNeighbors = (
    step: Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>,
    previousStep: IBuildWizardStep | null,
    nextStep: IBuildWizardStep | null,
  ): Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date' | 'expected_duration_days'> | null => {
    const lower = previousStep?.expected_end_date || previousStep?.expected_start_date || null;
    const upper = nextStep?.expected_start_date || nextStep?.expected_end_date || null;
    return clampStepDatesWithinRange(step, lower, upper);
  };

  const buildPhaseReorderIds = (
    phaseKey: string,
    preferredIds: number[],
    movedStepId: number,
    movedStepPhaseKey: string,
  ): number[] => {
    const normalizedPhase = String(phaseKey || '').trim();
    if (!normalizedPhase) {
      return [];
    }
    const phaseMembers = [...steps]
      .filter((candidate) => {
        if (candidate.id === movedStepId) {
          return movedStepPhaseKey === normalizedPhase;
        }
        return (candidate.phase_key || '') === normalizedPhase;
      })
      .sort((a, b) => {
        if (a.step_order !== b.step_order) {
          return a.step_order - b.step_order;
        }
        return a.id - b.id;
      })
      .map((candidate) => candidate.id);
    const memberSet = new Set(phaseMembers);
    const preferredUnique: number[] = [];
    preferredIds.forEach((id) => {
      const stepId = Number(id || 0);
      if (stepId > 0 && memberSet.has(stepId) && !preferredUnique.includes(stepId)) {
        preferredUnique.push(stepId);
      }
    });
    const missing = phaseMembers.filter((id) => !preferredUnique.includes(id));
    return [...preferredUnique, ...missing];
  };

  const timelineAnchorForStep = (
    step: IBuildWizardStep,
    overrides?: Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>,
  ): { anchor: string | null; start: string | null; end: string | null } => {
    const start = toStringOrNull((overrides?.expected_start_date ?? step.expected_start_date) || '');
    const end = toStringOrNull((overrides?.expected_end_date ?? step.expected_end_date) || '');
    return {
      anchor: start || end,
      start,
      end,
    };
  };

  const compareStepsByTimeline = React.useCallback((
    left: IBuildWizardStep,
    right: IBuildWizardStep,
    overridesByStepId?: Map<number, Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>>,
  ): number => {
    const leftTimeline = timelineAnchorForStep(left, overridesByStepId?.get(left.id));
    const rightTimeline = timelineAnchorForStep(right, overridesByStepId?.get(right.id));

    if (leftTimeline.anchor === null && rightTimeline.anchor !== null) {
      return 1;
    }
    if (leftTimeline.anchor !== null && rightTimeline.anchor === null) {
      return -1;
    }
    if (leftTimeline.anchor !== null && rightTimeline.anchor !== null && leftTimeline.anchor !== rightTimeline.anchor) {
      return leftTimeline.anchor.localeCompare(rightTimeline.anchor);
    }

    if (leftTimeline.start === null && rightTimeline.start !== null) {
      return 1;
    }
    if (leftTimeline.start !== null && rightTimeline.start === null) {
      return -1;
    }
    if (leftTimeline.start !== null && rightTimeline.start !== null && leftTimeline.start !== rightTimeline.start) {
      return leftTimeline.start.localeCompare(rightTimeline.start);
    }

    if (leftTimeline.end === null && rightTimeline.end !== null) {
      return 1;
    }
    if (leftTimeline.end !== null && rightTimeline.end === null) {
      return -1;
    }
    if (leftTimeline.end !== null && rightTimeline.end !== null && leftTimeline.end !== rightTimeline.end) {
      return leftTimeline.end.localeCompare(rightTimeline.end);
    }

    if (left.step_order !== right.step_order) {
      return left.step_order - right.step_order;
    }
    return left.id - right.id;
  }, []);

  const autoReorderPhaseByTimeline = React.useCallback(async (
    phaseKey: string,
    overridesByStepId?: Map<number, Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>>,
  ) => {
    const normalizedPhase = String(phaseKey || '').trim().toLowerCase() || 'general';
    const phaseSteps = steps
      .filter((candidate) => (String(candidate.phase_key || '').trim().toLowerCase() || 'general') === normalizedPhase)
      .sort((a, b) => compareStepsByTimeline(a, b, overridesByStepId));
    const orderedIds = phaseSteps.map((candidate) => candidate.id);
    if (orderedIds.length > 1) {
      await reorderSteps(normalizedPhase, orderedIds);
    }
  }, [compareStepsByTimeline, reorderSteps, steps]);

  React.useEffect(() => {
    if (projectId <= 0 || steps.length === 0) {
      return;
    }
    if (timelineReconciledProjectIdsRef.current.has(projectId)) {
      return;
    }
    timelineReconciledProjectIdsRef.current.add(projectId);

    void (async () => {
      const timelineOverrides = new Map<number, Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>>();
      const fixes: Array<{ stepId: number; patch: Partial<IBuildWizardStep> }> = [];

      steps.forEach((step) => {
        let start = toStringOrNull(step.expected_start_date || '');
        let end = toStringOrNull(step.expected_end_date || '');
        const taskDates = documents
          .filter((doc) => String(doc.kind || '').trim() === 'receipt' && Number(doc.step_id || 0) === step.id)
          .map((doc) => toStringOrNull(doc.receipt_date || ''))
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => a.localeCompare(b));
        if (taskDates.length > 0) {
          const minTaskDate = taskDates[0];
          const maxTaskDate = taskDates[taskDates.length - 1];
          if (!start || start > minTaskDate) {
            start = minTaskDate;
          }
          if (!end || end < maxTaskDate) {
            end = maxTaskDate;
          }
        }
        if (start && end && end < start) {
          end = start;
        }
        const duration = calculateDurationDays(start, end);
        const startChanged = start !== toStringOrNull(step.expected_start_date || '');
        const currentDuration = step.expected_duration_days ?? null;
        const endChanged = end !== toStringOrNull(step.expected_end_date || '');
        const durationChanged = duration !== currentDuration;
        if (!startChanged && !endChanged && !durationChanged) {
          return;
        }
        const patch: Partial<IBuildWizardStep> = {};
        if (startChanged) {
          patch.expected_start_date = start;
        }
        if (endChanged) {
          patch.expected_end_date = end;
        }
        if (durationChanged) {
          patch.expected_duration_days = duration;
        }
        timelineOverrides.set(step.id, {
          expected_start_date: start,
          expected_end_date: end,
        });
        fixes.push({ stepId: step.id, patch });
      });

      for (const fix of fixes) {
        await updateStep(fix.stepId, fix.patch);
      }

      const phaseKeys = Array.from(new Set(
        steps.map((step) => String(step.phase_key || '').trim().toLowerCase() || 'general'),
      ));
      for (const phaseKey of phaseKeys) {
        await autoReorderPhaseByTimeline(phaseKey, timelineOverrides);
      }
    })();
  }, [autoReorderPhaseByTimeline, documents, projectId, steps, updateStep]);

  React.useEffect(() => {
    if (projectId <= 0 || steps.length === 0) {
      return;
    }
    void (async () => {
      const phaseTabs = Array.from(new Set(steps.map((step) => stepPhaseBucket(step)).filter((tab) => PHASE_PROGRESS_ORDER.includes(tab))));
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
  }, [projectId, resolvePhaseDateRange, savePhaseDateRange, steps]);

  const onDropReorder = async (insertIndex: number) => {
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

    const previousVisibleStepId = boundedInsertIndex > 0 ? withoutDragged[boundedInsertIndex - 1] : 0;
    const nextVisibleStepId = boundedInsertIndex < (withoutDragged.length - 1) ? withoutDragged[boundedInsertIndex + 1] : 0;
    const previousVisibleStep = previousVisibleStepId > 0 ? stepById.get(previousVisibleStepId) || null : null;
    const nextVisibleStep = nextVisibleStepId > 0 ? stepById.get(nextVisibleStepId) || null : null;
    const destinationPhaseKey = (
      previousVisibleStep?.phase_key
      || nextVisibleStep?.phase_key
      || draggedStep.phase_key
      || ''
    );
    if (!destinationPhaseKey) {
      clearStepDragState();
      return;
    }

    const preferredPhaseOrder = withoutDragged.filter((id) => id === draggingStepId || (stepById.get(id)?.phase_key || '') === destinationPhaseKey);
    const phaseOrderedIds = buildPhaseReorderIds(destinationPhaseKey, preferredPhaseOrder, draggingStepId, destinationPhaseKey);
    try {
      if (draggedStep.phase_key !== destinationPhaseKey || Number(draggedStep.parent_step_id || 0) > 0) {
        await updateStep(draggingStepId, { phase_key: destinationPhaseKey, parent_step_id: null });
      }
      if (phaseOrderedIds.length > 0) {
        await reorderSteps(destinationPhaseKey, phaseOrderedIds);
        const movedIndex = phaseOrderedIds.indexOf(draggingStepId);
        const prevPhaseStep = movedIndex > 0 ? (stepById.get(phaseOrderedIds[movedIndex - 1]) || null) : null;
        const nextPhaseStep = movedIndex >= 0 && movedIndex < (phaseOrderedIds.length - 1)
          ? (stepById.get(phaseOrderedIds[movedIndex + 1]) || null)
          : null;
        const datePatch = clampStepDatesBetweenNeighbors(draggedStep, prevPhaseStep, nextPhaseStep);
        if (datePatch) {
          await updateStep(draggingStepId, datePatch);
        }
      }
    } finally {
      clearStepDragState();
    }
  };

  const onDropMakeChild = async (targetStepId: number) => {
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
    const insertIndex = targetIndex >= 0 ? (targetIndex + 1) : withoutDragged.length;
    withoutDragged.splice(insertIndex, 0, draggingStepId);
    const preferredPhaseOrder = withoutDragged.filter((id) => id === draggingStepId || (stepById.get(id)?.phase_key || '') === targetPhaseKey);
    const phaseOrderedIds = buildPhaseReorderIds(targetPhaseKey, preferredPhaseOrder, draggingStepId, targetPhaseKey);

    try {
      if (draggedStep.phase_key !== targetPhaseKey) {
        await updateStep(draggingStepId, { phase_key: targetPhaseKey });
      }
      const childDatePatch = clampStepDatesWithinRange(
        draggedStep,
        targetStep.expected_start_date,
        targetStep.expected_end_date,
      );
      await updateStep(draggingStepId, {
        ...(childDatePatch || {}),
        parent_step_id: targetStepId,
      });
      if (phaseOrderedIds.length > 0) {
        await reorderSteps(targetPhaseKey, phaseOrderedIds);
      }
    } finally {
      clearStepDragState();
    }
  };

  const currencyAuditFields = new Set([
    'estimated_cost',
    'actual_cost',
    'purchase_unit_price',
    'receipt_total',
    'receipt_amount',
    'hoa_fee_monthly',
  ]);

  const formatAuditValue = (value: unknown, fieldName?: string): string => {
    if (value === null || typeof value === 'undefined') {
      return 'null';
    }
    const normalizedField = String(fieldName || '').trim().toLowerCase();
    if (normalizedField && currencyAuditFields.has(normalizedField)) {
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        return formatCurrency(numericValue);
      }
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  };

  const renderEditableStepCards = (tabSteps: IBuildWizardStep[]) => {
    if (!tabSteps.length) {
      return <div className="build-wizard-muted">No steps in this tab yet.</div>;
    }
    const hasAssigneeFilters = stepCardAssigneeTypeFilter !== 'all' || stepCardAssigneeIdFilter > 0;
    const hasTextFilter = stepCardTextFilterTokens.length > 0;
    const rows = activeTabTreeRows;
    const visibleRows = rows.filter((row) => {
      if (!hasTextFilter) {
        return true;
      }
      const haystack = stepSearchTextById.get(row.step.id) || '';
      return stepCardTextFilterTokens.every((token) => haystack.includes(token));
    });

    if (!visibleRows.length) {
      return <div className="build-wizard-muted">No steps match the current filter.</div>;
    }

    return (
      <div className="build-wizard-step-list">
        <div
          className={`build-wizard-drop-zone ${dragOverInsertIndex === 0 ? 'is-active' : ''}`}
          onDragOver={(e) => {
            if (draggingStepId > 0) {
              e.preventDefault();
              setDragOverInsertIndex(0);
              setDragOverParentStepId(0);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            void onDropReorder(0);
          }}
        />
        {visibleRows.map((row, rowIndex) => {
          const step = row.step;
          const allStepAssignees = stepAssigneesByStepId.get(step.id) || [];
          const directStepAssignees = stepDirectAssigneesByStepId.get(step.id) || [];
          const visibleStepAssignees = allStepAssignees.filter((entry) => {
            const contactType = normalizeContactType(entry.contact);
            if (stepCardAssigneeTypeFilter !== 'all' && contactType !== stepCardAssigneeTypeFilter) {
              return false;
            }
            if (stepCardAssigneeIdFilter > 0 && entry.contact.id !== stepCardAssigneeIdFilter) {
              return false;
            }
            return true;
          });
          const assigneeFilterMatch = !hasAssigneeFilters || visibleStepAssignees.length > 0;
          const stepReadOnly = Number(step.is_completed) === 1;
          const stepDisplayNumber = activeTabStepNumbers.get(step.id) || step.step_order;
          const draft = stepDrafts[step.id] || step;
          const parentStep = Number(draft.parent_step_id || 0) > 0 ? stepById.get(Number(draft.parent_step_id || 0)) : null;
          const childDateMin = parentStep?.expected_start_date || undefined;
          const childDateMax = parentStep?.expected_end_date || undefined;
          const stepDateMin = mergeDateMin(childDateMin, null);
          const stepDateMax = mergeDateMax(childDateMax, null);
          const incompleteDescendantCount = incompleteDescendantCountByStepId.get(step.id) || 0;
          const completionLocked = Number(step.is_completed) !== 1 && incompleteDescendantCount > 0;
          const durationDays = calculateDurationDays(draft.expected_start_date, draft.expected_end_date)
            ?? (draft.expected_duration_days ?? null);
          const aiEstimated = new Set(Array.isArray(draft.ai_estimated_fields) ? draft.ai_estimated_fields : []);
          const dependencyIds = Array.from(
            new Set(
              (Array.isArray(draft.depends_on_step_ids) ? draft.depends_on_step_ids : [])
                .map((rawId) => Number(rawId || 0))
                .filter((id) => id > 0 && id !== step.id),
            ),
          );
          const formatDependencyLabel = (dependency: IBuildWizardStep): string => {
            const phaseId = stepPhaseBucket(dependency);
            const phase = BUILD_TABS.find((tab) => tab.id === phaseId);
            const phaseLabel = phase ? phase.label : prettyPhaseLabel(dependency.phase_key);
            return `#${activeTabStepNumbers.get(dependency.id) || dependency.step_order} ${dependency.title} (${phaseLabel})`;
          };
          const dependencyItems = dependencyIds.map((dependencyId) => {
            const dependency = stepById.get(dependencyId) || null;
            return {
              id: dependencyId,
              label: dependency ? formatDependencyLabel(dependency) : `#${dependencyId} (missing step)`,
            };
          });
          const hasDependencies = dependencyItems.length > 0;
          const selectedDependencyCandidateId = Number(dependencyCandidateByStepId[step.id] || 0);
          const dependencyCandidateOptions = steps
            .filter((candidate) => candidate.id !== step.id && !dependencyIds.includes(candidate.id))
            .sort((a, b) => {
              if (a.step_order !== b.step_order) {
                return a.step_order - b.step_order;
              }
              return a.id - b.id;
            });
          const commitDependencies = (nextIds: number[]) => {
            const normalized = Array.from(new Set(nextIds.map((value) => Number(value || 0)).filter((id) => id > 0 && id !== step.id)));
            updateStepDraft(step.id, { depends_on_step_ids: normalized });
            void commitStep(step.id, { depends_on_step_ids: normalized });
          };
          const stepPastelColor = getStepPastelColor(step.id);
          const isExpanded = expandedStepById[step.id] === true;
          const stepAttachmentCount = documents.reduce((count, doc) => (Number(doc.step_id || 0) === step.id ? count + 1 : count), 0);
          const stepReceiptDocuments = documents
            .filter((doc) => Number(doc.step_id || 0) === step.id && doc.kind === 'receipt')
            .sort((a, b) => {
              const aDate = toStringOrNull(a.receipt_date || '');
              const bDate = toStringOrNull(b.receipt_date || '');
              if (aDate && bDate && aDate !== bDate) {
                return aDate.localeCompare(bDate);
              }
              if (aDate && !bDate) {
                return -1;
              }
              if (!aDate && bDate) {
                return 1;
              }
              const uploadedCmp = String(a.uploaded_at || '').localeCompare(String(b.uploaded_at || ''));
              if (uploadedCmp !== 0) {
                return uploadedCmp;
              }
              return a.id - b.id;
            });
          const stepReceiptAttachmentDocuments = documents.filter((doc) => Number(doc.step_id || 0) === step.id && doc.kind === 'receipt_attachment');
          const stepNonReceiptDocuments = documents.filter((doc) => Number(doc.step_id || 0) === step.id && doc.kind !== 'receipt' && doc.kind !== 'receipt_attachment');
          const stepReceiptMetrics = receiptMetricsByStepId.get(step.id) || {
            allCount: stepReceiptDocuments.length,
            nonQuoteCount: stepReceiptDocuments.length,
            quoteCount: 0,
            allTotal: stepReceiptDocuments.reduce((sum, doc) => sum + Number(doc.receipt_amount || 0), 0),
            nonQuoteTotal: stepReceiptDocuments.reduce((sum, doc) => sum + Number(doc.receipt_amount || 0), 0),
            quoteTotal: 0,
          };
          const stepTaskCount = Math.max(stepReceiptDocuments.length, Number(draft.receipt_count || 0));
          const hasStepTasks = stepTaskCount > 0;
          const stepReceiptTotal = stepReceiptMetrics.nonQuoteTotal;
          const actualCostFloor = Math.max(0, stepReceiptTotal);
          const draftActualCost = toNumberOrNull(String(draft.actual_cost ?? ''));
          const effectiveActualCost = draftActualCost === null
            ? (actualCostFloor > 0 ? actualCostFloor : null)
            : Math.max(draftActualCost, actualCostFloor);
          const receiptDraft = receiptDraftByStep[step.id] || {
            receipt_title: '',
            receipt_vendor: '',
            receipt_date: '',
            receipt_amount: '',
            receipt_notes: '',
            task_meta: defaultTaskMeta((step.step_type || 'construction') as BuildWizardTaskType),
          };
          const stepAttachmentFilter = String(attachExistingDocFilterByStepId[step.id] || '').trim().toLowerCase();
          const filteredAttachableProjectDocuments = stepAttachmentFilter
            ? attachableProjectDocuments.filter((doc) => {
              const linkedStepId = Number(doc.step_id || 0);
              const linkedStep = linkedStepId > 0 ? stepById.get(linkedStepId) : null;
              const haystack = `${doc.original_name} ${buildWizardTokenLabel(doc.kind, 'Other')} ${linkedStep?.title || ''}`.toLowerCase();
              return haystack.includes(stepAttachmentFilter);
            })
            : attachableProjectDocuments;
          const receiptEditorOpen = receiptEditorOpenByStep[step.id] === true;
          const stepDirectContactIdSet = new Set<number>(directStepAssignees.map((entry) => entry.contact.id));
          const addableStepContacts = contacts
            .filter((contact) => !stepDirectContactIdSet.has(contact.id))
            .sort((a, b) => sortAlpha(String(a.display_name || ''), String(b.display_name || '')));
          const selectedStepContactCandidateId = Number(stepContactCandidateByStepId[step.id] || 0);
          const effectiveStepContactCandidateId = selectedStepContactCandidateId > 0
            && addableStepContacts.some((contact) => contact.id === selectedStepContactCandidateId)
            ? selectedStepContactCandidateId
            : (addableStepContacts[0]?.id || 0);
          return (
            <React.Fragment key={step.id}>
            <div
              id={`build-wizard-step-${step.id}`}
              className={`build-wizard-step ${row.level > 0 ? 'is-child' : ''} ${dragOverParentStepId === step.id ? 'is-parent-target' : ''} ${stepReadOnly ? 'is-readonly' : ''} ${!assigneeFilterMatch ? 'is-assignee-filtered-out' : ''} ${!isExpanded ? 'is-collapsed' : ''}`}
              style={{ '--bw-indent-level': String(row.level), '--bw-step-phase-color': stepPastelColor } as React.CSSProperties}
              draggable={!stepReadOnly}
              onDragStart={(e) => {
                const target = e.target as HTMLElement | null;
                const fromHandle = Boolean(target?.closest('.build-wizard-step-drag-handle-btn'));
                if (!fromHandle) {
                  e.preventDefault();
                  return;
                }
                beginStepDrag(e as React.DragEvent<HTMLElement>, step.id, stepReadOnly);
              }}
              onDragEnd={() => clearStepDragState()}
              onDragOver={(e) => {
                if (!stepReadOnly && draggingStepId > 0 && draggingStepId !== step.id) {
                  e.preventDefault();
                  setDragOverParentStepId(step.id);
                  setDragOverInsertIndex(-1);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                void onDropMakeChild(step.id);
              }}
            >
              <div className="build-wizard-step-phase-accent" style={{ background: stepPastelColor }} />
	          <div className="build-wizard-step-header">
	            <div className="build-wizard-step-header-left">
                  <div className="build-wizard-step-handle-stack">
                    <button
                      type="button"
                      className="build-wizard-step-drag-handle-btn"
                      draggable={!stepReadOnly}
                      disabled={stepReadOnly}
                      onDragStart={(e) => {
                        beginStepDrag(e as React.DragEvent<HTMLElement>, step.id, stepReadOnly);
                      }}
                      onDragEnd={() => clearStepDragState()}
                      aria-label={stepReadOnly ? 'Step is read-only' : 'Drag to reorder step'}
                      title={stepReadOnly ? 'Read-only step' : 'Drag to reorder'}
                    >
                      ⋮⋮
                    </button>
                    {hasStepTasks ? (
                      <span
                        className="build-wizard-step-task-indicator"
                        aria-label={`Step has ${stepTaskCount} task${stepTaskCount === 1 ? '' : 's'}`}
                        title={`Has ${stepTaskCount} task${stepTaskCount === 1 ? '' : 's'}`}
                      />
                    ) : null}
                    <button
                      type="button"
                      className="build-wizard-step-expand-btn"
                      onClick={() => setExpandedStepById((prev) => ({ ...prev, [step.id]: !isExpanded }))}
                      aria-label={isExpanded ? 'Collapse step card' : 'Expand step card'}
                      title={isExpanded ? 'Collapse step' : 'Expand step'}
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                  </div>
                  {row.level > 0 ? <span className="build-wizard-child-glyph" aria-hidden="true">↳</span> : null}
	                  <div className="build-wizard-inline-check">
	                    <label className="build-wizard-inline-complete-toggle">
	                      <input
	                        type="checkbox"
	                        checked={Number(step.is_completed) === 1}
	                        disabled={completionLocked}
	                        onChange={(e) => void toggleStep(step, e.target.checked)}
	                      />
	                      <span>Complete</span>
	                    </label>
                      <span className="build-wizard-step-order-pill" title="Step number is automatically set from timeline order">
                        #{stepDisplayNumber}
                      </span>
	                  </div>
                  {completionLocked ? (
                    <span className="build-wizard-parent-lock-note">
                      Complete {incompleteDescendantCount} child step{incompleteDescendantCount === 1 ? '' : 's'} first
                    </span>
                  ) : null}
                  {stepReadOnly ? (
                    <span className="build-wizard-step-readonly-note">
                      Read-only (completed)
                    </span>
                  ) : null}
                  <div className="build-wizard-inline-metrics">
                    <label className="build-wizard-title-inline">
                      Step Title
                      <input
                        type="text"
                        value={draft.title || ''}
                        disabled={stepReadOnly}
                        onChange={(e) => updateStepDraft(step.id, { title: e.target.value })}
                        onBlur={() => void commitStep(step.id, { title: String(stepDrafts[step.id]?.title || '').trim() })}
                      />
                    </label>
                    <label className="build-wizard-duration-inline">
                      Duration (Days)
                      <input type="number" value={durationDays ?? ''} readOnly />
                    </label>
                    <label className="build-wizard-date-inline">
                      Start {aiEstimated.has('expected_start_date') ? '*' : ''}
                      <input
                        type="date"
                        value={draft.expected_start_date || ''}
                        min={stepDateMin}
                        max={stepDateMax}
                        disabled={stepReadOnly}
                        onChange={(e) => {
                          const nextStartDate = toStringOrNull(e.target.value);
                          const nextDuration = calculateDurationDays(nextStartDate, draft.expected_end_date) ?? draft.expected_duration_days;
                          updateStepDraft(step.id, {
                            expected_start_date: nextStartDate,
                            expected_duration_days: nextDuration,
                          });
                        }}
                        onBlur={() => {
                          const nextDraft = stepDrafts[step.id] || step;
                          const nextStartDate = toStringOrNull(nextDraft.expected_start_date || '');
                          const nextEndDate = toStringOrNull(nextDraft.expected_end_date || '');
                          const nextDuration = calculateDurationDays(nextStartDate, nextDraft.expected_end_date)
                            ?? (nextDraft.expected_duration_days ?? null);
                          const nextPatch = {
                            expected_start_date: nextStartDate,
                            expected_duration_days: nextDuration,
                          };
                          const timelineOverrides = new Map<number, Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>>();
                          timelineOverrides.set(step.id, {
                            expected_start_date: nextStartDate,
                            expected_end_date: nextEndDate,
                          });
                          void (async () => {
                            await commitStep(step.id, nextPatch);
                            await autoReorderPhaseByTimeline(step.phase_key, timelineOverrides);
                            await expandPhaseRangeForStep(step, timelineOverrides.get(step.id));
                          })();
                        }}
                      />
                    </label>
                    <label className="build-wizard-date-inline">
                      End {aiEstimated.has('expected_end_date') ? '*' : ''}
                      <input
                        type="date"
                        value={draft.expected_end_date || ''}
                        min={stepDateMin}
                        max={stepDateMax}
                        disabled={stepReadOnly}
                        onChange={(e) => {
                          const nextEndDate = toStringOrNull(e.target.value);
                          const nextDuration = calculateDurationDays(draft.expected_start_date, nextEndDate) ?? draft.expected_duration_days;
                          updateStepDraft(step.id, {
                            expected_end_date: nextEndDate,
                            expected_duration_days: nextDuration,
                          });
                        }}
                        onBlur={() => {
                          const nextDraft = stepDrafts[step.id] || step;
                          const nextStartDate = toStringOrNull(nextDraft.expected_start_date || '');
                          const nextEndDate = toStringOrNull(nextDraft.expected_end_date || '');
                          const nextDuration = calculateDurationDays(nextDraft.expected_start_date, nextEndDate)
                            ?? (nextDraft.expected_duration_days ?? null);
                          const nextPatch = {
                            expected_end_date: nextEndDate,
                            expected_duration_days: nextDuration,
                          };
                          const timelineOverrides = new Map<number, Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>>();
                          timelineOverrides.set(step.id, {
                            expected_start_date: nextStartDate,
                            expected_end_date: nextEndDate,
                          });
                          void (async () => {
                            await commitStep(step.id, nextPatch);
                            await autoReorderPhaseByTimeline(step.phase_key, timelineOverrides);
                            await expandPhaseRangeForStep(step, timelineOverrides.get(step.id));
                          })();
                        }}
                      />
                    </label>
                    <label className="build-wizard-date-inline">
                      Estimated Cost {aiEstimated.has('estimated_cost') ? '*' : ''}
                      <input
                        type="text"
                        inputMode="decimal"
                        className="build-wizard-currency-input"
                        value={renderCurrencyInputValue(`step-${step.id}-estimated_cost`, draft.estimated_cost)}
                        disabled={stepReadOnly}
                        onFocus={() => startCurrencyEdit(`step-${step.id}-estimated_cost`, draft.estimated_cost)}
                        onChange={(e) => changeCurrencyEdit(`step-${step.id}-estimated_cost`, e.target.value)}
                        onBlur={() => finishCurrencyEdit(`step-${step.id}-estimated_cost`, (value) => {
                          updateStepDraft(step.id, { estimated_cost: value });
                          void commitStep(step.id, { estimated_cost: value });
                        })}
                      />
                    </label>
                    <label className="build-wizard-date-inline">
                      Actual Cost
                      <input
                        type="text"
                        inputMode="decimal"
                        className="build-wizard-currency-input"
                        value={renderCurrencyInputValue(`step-${step.id}-actual_cost`, effectiveActualCost)}
                        disabled={stepReadOnly}
                        onFocus={() => startCurrencyEdit(`step-${step.id}-actual_cost`, effectiveActualCost)}
                        onChange={(e) => changeCurrencyEdit(`step-${step.id}-actual_cost`, e.target.value)}
                        onBlur={() => finishCurrencyEdit(`step-${step.id}-actual_cost`, (value) => {
                          const nextActual = value === null
                            ? (actualCostFloor > 0 ? actualCostFloor : null)
                            : Math.max(value, actualCostFloor);
                          updateStepDraft(step.id, { actual_cost: nextActual });
                          void commitStep(step.id, { actual_cost: nextActual });
                        })}
                      />
                    </label>
                  </div>
                </div>
                <div className="build-wizard-step-header-right">
                  {stepAttachmentCount > 0 ? (
                    <span
                      className="build-wizard-step-attachment-indicator"
                      aria-label={`${stepAttachmentCount} attachment${stepAttachmentCount === 1 ? '' : 's'} on this step`}
                      title={`${stepAttachmentCount} attachment${stepAttachmentCount === 1 ? '' : 's'}`}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 12.5l6.2-6.2a3.5 3.5 0 0 1 5 5l-8.4 8.4a5.5 5.5 0 1 1-7.8-7.8L13.1 1.8" />
                      </svg>
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    aria-label="Move step"
                    title="Move step to another phase"
                    disabled={stepReadOnly}
                    onClick={() => onOpenMoveStepModal(step.id)}
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    className="build-wizard-step-info-btn"
                    aria-label="Step information"
                    title="Step information"
                    onClick={() => setStepInfoModalStepId(step.id)}
                  >
                    i
                  </button>
                  <button
                    type="button"
                    className="build-wizard-step-delete"
                    aria-label="Delete step"
                    title="Delete step"
                    disabled={stepReadOnly}
                    onClick={() => {
                      if (stepReadOnly) {
                        return;
                      }
                      void (async () => {
                        const ok = await requestConfirmation({
                          title: 'Delete Step?',
                          message: 'Delete this step?',
                          confirmLabel: 'Delete Step',
                          confirmButtonClass: 'btn btn-danger',
                        });
                        if (ok) {
                          await deleteStep(step.id);
                        }
                      })();
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              </div>
              {isExpanded ? (
              <>
              <fieldset className="build-wizard-step-fields" disabled={stepReadOnly}>
              <div className="build-wizard-step-grid">
                <div className={`build-wizard-type-note build-wizard-dependency-note ${hasDependencies ? '' : 'is-empty-inline'}`}>
                  <div className="build-wizard-dependency-head">
                    <span>Depends on:</span>
                    {hasDependencies ? (
                      <button
                        type="button"
                        className="btn btn-link btn-sm"
                        onClick={() => commitDependencies([])}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  {hasDependencies ? (
                    <div className="build-wizard-dependency-chip-list">
                      {dependencyItems.map((dependencyItem) => (
                        <span key={`${step.id}-dependency-${dependencyItem.id}`} className="build-wizard-dependency-chip">
                          {dependencyItem.label}
                          <button
                            type="button"
                            className="build-wizard-dependency-chip-remove"
                            aria-label={`Remove dependency ${dependencyItem.label}`}
                            title="Remove dependency"
                            onClick={() => {
                              commitDependencies(dependencyIds.filter((id) => id !== dependencyItem.id));
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="build-wizard-dependency-empty">No dependencies set.</div>
                  )}
                  <div className="build-wizard-dependency-controls">
                    <select
                      value={dependencyCandidateByStepId[step.id] || ''}
                      onChange={(e) => setDependencyCandidateByStepId((prev) => ({ ...prev, [step.id]: e.target.value }))}
                    >
                      <option value="">Add dependency step...</option>
                      {dependencyCandidateOptions.map((candidate) => (
                        <option key={candidate.id} value={String(candidate.id)}>
                          {formatDependencyLabel(candidate)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      disabled={selectedDependencyCandidateId <= 0}
                      onClick={() => {
                        if (selectedDependencyCandidateId <= 0 || dependencyIds.includes(selectedDependencyCandidateId)) {
                          return;
                        }
                        commitDependencies([...dependencyIds, selectedDependencyCandidateId]);
                        setDependencyCandidateByStepId((prev) => ({ ...prev, [step.id]: '' }));
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
                {parentStep ? (
                  <div className="build-wizard-type-note">Child of: #{activeTabStepNumbers.get(parentStep.id) || parentStep.step_order} {parentStep.title}</div>
                ) : null}
                {(stepReceiptDocuments.length > 0 || stepReceiptTotal > 0) ? (
                  <div className="build-wizard-type-note">
                    Tasks: {stepTaskCount} file{stepTaskCount === 1 ? '' : 's'} | Total {formatCurrency(stepReceiptTotal)}
                  </div>
                ) : null}
              </div>

              <label className="build-wizard-notes-field">
                Step Description
                <textarea
                  rows={2}
                  value={draft.description || ''}
                  onChange={(e) => updateStepDraft(step.id, { description: e.target.value })}
                  onBlur={() => void commitStep(step.id, { description: String(stepDrafts[step.id]?.description || '') })}
                />
              </label>

              <div className="build-wizard-step-actions">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setNoteEditorOpenByStep((prev) => ({ ...prev, [step.id]: !prev[step.id] }))}
                >
                  Add Note
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={stepReadOnly}
                  onClick={() => {
                    setEditingReceiptDocumentIdByStep((prev) => ({ ...prev, [step.id]: 0 }));
                    setReceiptEditorOpenByStep((prev) => ({ ...prev, [step.id]: !prev[step.id] }));
                  }}
                >
                  {Number(editingReceiptDocumentIdByStep[step.id] || 0) > 0 ? 'Edit Task' : 'Add Task'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={stepReadOnly}
                  onClick={() => setStepContactPickerOpenByStepId((prev) => ({ ...prev, [step.id]: !prev[step.id] }))}
                >
                  Add Contact
                </button>
                <label className="btn btn-outline-secondary btn-sm build-wizard-upload-btn">
                  Upload
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={(e) => {
                      const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                      if (file) {
                        const uploadKind = draft.step_type === 'blueprints'
                          ? 'blueprint'
                          : (draft.step_type === 'photos' ? 'photo' : 'progress_photo');
                        void uploadDocument(uploadKind, file, step.id, step.title, step.phase_key);
                      }
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
                {attachableProjectDocuments.length ? (
                  <div className="build-wizard-step-attach-existing">
                    {attachExistingPickerOpenByStepId[step.id] ? (
                      <input
                        type="text"
                        className="build-wizard-attach-filter-input"
                        placeholder="Filter attachments..."
                        value={attachExistingDocFilterByStepId[step.id] || ''}
                        onChange={(e) => setAttachExistingDocFilterByStepId((prev) => ({ ...prev, [step.id]: e.target.value }))}
                      />
                    ) : null}
                    <select
                      value={attachExistingDocByStepId[step.id] || ''}
                      onFocus={() => setAttachExistingPickerOpenByStepId((prev) => ({ ...prev, [step.id]: true }))}
                      onMouseDown={() => setAttachExistingPickerOpenByStepId((prev) => ({ ...prev, [step.id]: true }))}
                      onChange={(e) => setAttachExistingDocByStepId((prev) => ({ ...prev, [step.id]: e.target.value }))}
                    >
                      <option value="">Attach existing document...</option>
                      {filteredAttachableProjectDocuments.map((doc) => {
                        const linkedStepId = Number(doc.step_id || 0);
                        const linkedStep = linkedStepId > 0 ? stepById.get(linkedStepId) : null;
                        const linkedStepNumber = linkedStepId > 0
                          ? (linkedStepDisplayNumberById.get(linkedStepId) || linkedStep?.step_order || linkedStepId)
                          : 0;
                        const linkSuffix = linkedStep
                          ? `Linked #${linkedStepNumber}: ${linkedStep.title}`
                          : 'Unlinked';
                        return (
                          <option key={doc.id} value={String(doc.id)}>
                            {doc.original_name} ({buildWizardTokenLabel(doc.kind, 'Other')}) - {linkSuffix}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => void onAttachExistingDocumentToStep(step)}
                      disabled={!attachExistingDocByStepId[step.id]}
                    >
                      Attach
                    </button>
                  </div>
                ) : null}
              </div>

              {stepContactPickerOpenByStepId[step.id] ? (
                <div className="build-wizard-step-contact-picker">
                  <select
                    value={effectiveStepContactCandidateId > 0 ? String(effectiveStepContactCandidateId) : ''}
                    onChange={(e) => setStepContactCandidateByStepId((prev) => ({ ...prev, [step.id]: e.target.value }))}
                  >
                    <option value="">Select contact...</option>
                    {addableStepContacts.map((contact) => (
                      <option key={`step-contact-${step.id}-${contact.id}`} value={String(contact.id)}>
                        {contact.display_name} ({contactTypeLabel(normalizeContactType(contact))})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    disabled={stepReadOnly || effectiveStepContactCandidateId <= 0}
                    onClick={() => { void onAddContactToStep(step.id, effectiveStepContactCandidateId); }}
                  >
                    Assign
                  </button>
                </div>
              ) : null}

              {noteEditorOpenByStep[step.id] ? (
                <div className="build-wizard-note-editor">
                  <textarea
                    rows={3}
                    placeholder="Type your note..."
                    value={noteDraftByStep[step.id] || ''}
                    onChange={(e) => setNoteDraftByStep((prev) => ({ ...prev, [step.id]: e.target.value }))}
                  />
                  <div className="build-wizard-note-editor-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        void onSubmitNote(step).then((saved) => {
                          if (saved) {
                            setNoteEditorOpenByStep((prev) => ({ ...prev, [step.id]: false }));
                          }
                        });
                      }}
                    >
                      Save Note
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setNoteEditorOpenByStep((prev) => ({ ...prev, [step.id]: false }))}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              </fieldset>

              {allStepAssignees.length > 0 ? (
                <div className="build-wizard-step-assignees">
                  <div className="build-wizard-step-assignees-label">Contacts</div>
                  {visibleStepAssignees.length > 0 ? (
                    <div className="build-wizard-step-assignee-list">
                      {visibleStepAssignees.map((entry) => (
                        <div key={`${step.id}-${entry.contact.id}`} className={`build-wizard-step-assignee-row ${contactTypeChipClass(normalizeContactType(entry.contact))}`}>
                          <span className="build-wizard-step-assignee-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24">
                              <path d="M12 12c2.5 0 4.5-2 4.5-4.5S14.5 3 12 3 7.5 5 7.5 7.5 9.5 12 12 12Zm0 2c-4.1 0-7.5 2.9-7.5 6.5V21h15v-.5c0-3.6-3.4-6.5-7.5-6.5Z" />
                            </svg>
                          </span>
                          <span className="build-wizard-step-assignee-text">{entry.contact.display_name}</span>
                          <span className="build-wizard-step-assignee-source">
                            {entry.source === 'phase' ? 'Phase' : 'Step'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="build-wizard-muted">
                      {hasAssigneeFilters ? 'No assignments match the current filter.' : 'No contact assignments.'}
                    </div>
                  )}
                </div>
              ) : null}

              {(stepReceiptDocuments.length > 0 || receiptEditorOpen) ? (
              <div className="build-wizard-step-receipts">
                <div className="build-wizard-step-receipts-head">
                  <div className="build-wizard-step-assignees-label">Tasks</div>
                  <div className="build-wizard-step-receipts-summary">
                    {stepReceiptDocuments.length} file{stepReceiptDocuments.length === 1 ? '' : 's'} | {formatCurrency(stepReceiptTotal)}
                  </div>
                </div>
                {receiptEditorOpen ? (
                  <div
                    className="build-wizard-note-editor"
                    ref={(el) => { receiptEditorRefByStepId.current[step.id] = el; }}
                  >
                    <div className="build-wizard-muted">
                      {Number(editingReceiptDocumentIdByStep[step.id] || 0) > 0 ? 'Editing task' : 'New task'}
                    </div>
                    <div className="build-wizard-step-receipt-upload-grid">
                      <label>
                        Title
                        <input
                          type="text"
                          value={receiptDraft.receipt_title}
                          onChange={(e) => setReceiptDraftByStep((prev) => ({
                            ...prev,
                            [step.id]: { ...receiptDraft, receipt_title: e.target.value },
                          }))}
                        />
                      </label>
                      <label>
                        Vendor
                        <input
                          type="text"
                          value={receiptDraft.receipt_vendor}
                          onChange={(e) => setReceiptDraftByStep((prev) => ({
                            ...prev,
                            [step.id]: { ...receiptDraft, receipt_vendor: e.target.value },
                          }))}
                        />
                      </label>
                      <label>
                        Date
                        <input
                          type="date"
                          value={receiptDraft.receipt_date}
                          onChange={(e) => setReceiptDraftByStep((prev) => ({
                            ...prev,
                            [step.id]: { ...receiptDraft, receipt_date: e.target.value },
                          }))}
                        />
                      </label>
                      <label>
                        Amount
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={receiptDraft.receipt_amount}
                          onChange={(e) => setReceiptDraftByStep((prev) => ({
                            ...prev,
                            [step.id]: { ...receiptDraft, receipt_amount: e.target.value },
                          }))}
                        />
                      </label>
                      <label>
                        Type
                        <select
                          value={receiptDraft.task_meta.task_type}
                          onChange={(e) => setReceiptDraftByStep((prev) => ({
                            ...prev,
                            [step.id]: {
                              ...receiptDraft,
                              task_meta: {
                                ...receiptDraft.task_meta,
                                task_type: e.target.value as BuildWizardTaskType,
                              },
                            },
                          }))}
                        >
                          {TASK_TYPE_OPTIONS.map((opt) => (
                            <option key={`task-type-${opt.value}`} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </label>
                      {receiptDraft.task_meta.task_type === 'permit' ? (
                        <>
                          <label>
                            Saved Permit
                            <select
                              value={Number(receiptDraft.task_meta.permit_document_id || 0) > 0 ? String(receiptDraft.task_meta.permit_document_id) : ''}
                              onChange={(e) => {
                                const permitDocumentId = Number(e.target.value || '0');
                                const selectedPermitDoc = permitDocuments.find((doc) => doc.id === permitDocumentId);
                                setReceiptDraftByStep((prev) => ({
                                  ...prev,
                                  [step.id]: {
                                    ...receiptDraft,
                                    task_meta: {
                                      ...receiptDraft.task_meta,
                                      permit_document_id: permitDocumentId > 0 ? permitDocumentId : null,
                                      permit_name: permitDocumentId > 0 ? (selectedPermitDoc?.original_name || null) : receiptDraft.task_meta.permit_name,
                                      permit_application_url: permitDocumentId > 0 ? (selectedPermitDoc?.public_url || null) : receiptDraft.task_meta.permit_application_url,
                                    },
                                  },
                                }));
                              }}
                            >
                              <option value="">Select permit</option>
                              {permitDocuments.map((doc) => (
                                <option key={`task-permit-${doc.id}`} value={doc.id}>{doc.original_name}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Permit Name
                            <input
                              type="text"
                              value={receiptDraft.task_meta.permit_name || ''}
                              onChange={(e) => setReceiptDraftByStep((prev) => ({
                                ...prev,
                                [step.id]: {
                                  ...receiptDraft,
                                  task_meta: { ...receiptDraft.task_meta, permit_name: toStringOrNull(e.target.value || '') },
                                },
                              }))}
                            />
                          </label>
                          <label>
                            Authority
                            <select
                              value={receiptDraft.task_meta.permit_authority || ''}
                              onChange={(e) => setReceiptDraftByStep((prev) => ({
                                ...prev,
                                [step.id]: {
                                  ...receiptDraft,
                                  task_meta: { ...receiptDraft.task_meta, permit_authority: toStringOrNull(e.target.value || '') },
                                },
                              }))}
                            >
                              <option value="">Select authority</option>
                              {authorityContacts.map((contact) => (
                                <option key={`task-authority-${contact.id}`} value={contact.display_name || ''}>
                                  {contact.display_name}
                                  {contact.company ? ` (${contact.company})` : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Permit Status
                            <select
                              value={receiptDraft.task_meta.permit_status || ''}
                              onChange={(e) => setReceiptDraftByStep((prev) => ({
                                ...prev,
                                [step.id]: {
                                  ...receiptDraft,
                                  task_meta: { ...receiptDraft.task_meta, permit_status: toStringOrNull(e.target.value || '') },
                                },
                              }))}
                            >
                              {permitStatusOptions.map((status) => (
                                <option key={`task-status-${status}`} value={status}>{status === '' ? 'Select status' : status}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Permit URL
                            <input
                              type="url"
                              value={receiptDraft.task_meta.permit_application_url || ''}
                              onChange={(e) => setReceiptDraftByStep((prev) => ({
                                ...prev,
                                [step.id]: {
                                  ...receiptDraft,
                                  task_meta: { ...receiptDraft.task_meta, permit_application_url: toStringOrNull(e.target.value || '') },
                                },
                              }))}
                            />
                          </label>
                        </>
                      ) : null}
                      {['purchase', 'utility', 'delivery', 'quote'].includes(receiptDraft.task_meta.task_type) ? (
                        <>
                          <label>
                            Category
                            <input
                              type="text"
                              value={receiptDraft.task_meta.purchase_category || ''}
                              onChange={(e) => setReceiptDraftByStep((prev) => ({
                                ...prev,
                                [step.id]: {
                                  ...receiptDraft,
                                  task_meta: { ...receiptDraft.task_meta, purchase_category: toStringOrNull(e.target.value || '') },
                                },
                              }))}
                            />
                          </label>
                          <label>
                            Brand
                            <input
                              type="text"
                              value={receiptDraft.task_meta.purchase_brand || ''}
                              onChange={(e) => setReceiptDraftByStep((prev) => ({
                                ...prev,
                                [step.id]: {
                                  ...receiptDraft,
                                  task_meta: { ...receiptDraft.task_meta, purchase_brand: toStringOrNull(e.target.value || '') },
                                },
                              }))}
                            />
                          </label>
                          <label>
                            Model
                            <input
                              type="text"
                              value={receiptDraft.task_meta.purchase_model || ''}
                              onChange={(e) => setReceiptDraftByStep((prev) => ({
                                ...prev,
                                [step.id]: {
                                  ...receiptDraft,
                                  task_meta: { ...receiptDraft.task_meta, purchase_model: toStringOrNull(e.target.value || '') },
                                },
                              }))}
                            />
                          </label>
                          <label>
                            SKU
                            <input
                              type="text"
                              value={receiptDraft.task_meta.purchase_sku || ''}
                              onChange={(e) => setReceiptDraftByStep((prev) => ({
                                ...prev,
                                [step.id]: {
                                  ...receiptDraft,
                                  task_meta: { ...receiptDraft.task_meta, purchase_sku: toStringOrNull(e.target.value || '') },
                                },
                              }))}
                            />
                          </label>
                          <label>
                            Qty
                            <input
                              type="number"
                              step="0.01"
                              value={receiptDraft.task_meta.purchase_qty ?? ''}
                              onChange={(e) => setReceiptDraftByStep((prev) => ({
                                ...prev,
                                [step.id]: {
                                  ...receiptDraft,
                                  task_meta: { ...receiptDraft.task_meta, purchase_qty: toNumberOrNull(e.target.value) },
                                },
                              }))}
                            />
                          </label>
                          <label>
                            Unit
                            <select
                              value={receiptDraft.task_meta.purchase_unit || ''}
                              onChange={(e) => setReceiptDraftByStep((prev) => ({
                                ...prev,
                                [step.id]: {
                                  ...receiptDraft,
                                  task_meta: { ...receiptDraft.task_meta, purchase_unit: toStringOrNull(e.target.value || '') },
                                },
                              }))}
                            >
                              {purchaseUnitOptions.map((unit) => (
                                <option key={`task-unit-${unit}`} value={unit}>{unit === '' ? 'Select unit' : unit}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Unit Price
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={receiptDraft.task_meta.purchase_unit_price ?? ''}
                              onChange={(e) => setReceiptDraftByStep((prev) => ({
                                ...prev,
                                [step.id]: {
                                  ...receiptDraft,
                                  task_meta: { ...receiptDraft.task_meta, purchase_unit_price: toNumberOrNull(e.target.value) },
                                },
                              }))}
                            />
                          </label>
                          <label>
                            Vendor
                            <input
                              type="text"
                              value={receiptDraft.task_meta.purchase_vendor || ''}
                              onChange={(e) => setReceiptDraftByStep((prev) => ({
                                ...prev,
                                [step.id]: {
                                  ...receiptDraft,
                                  task_meta: { ...receiptDraft.task_meta, purchase_vendor: toStringOrNull(e.target.value || '') },
                                },
                              }))}
                            />
                          </label>
                          <label>
                            URL
                            <input
                              type="url"
                              value={receiptDraft.task_meta.purchase_url || ''}
                              onChange={(e) => setReceiptDraftByStep((prev) => ({
                                ...prev,
                                [step.id]: {
                                  ...receiptDraft,
                                  task_meta: { ...receiptDraft.task_meta, purchase_url: toStringOrNull(e.target.value || '') },
                                },
                              }))}
                            />
                          </label>
                        </>
                      ) : null}
                      {['utility', 'delivery'].includes(receiptDraft.task_meta.task_type) ? (
                        <label className="is-wide">
                          Reference / Tracking
                          <input
                            type="text"
                            value={receiptDraft.task_meta.source_ref || ''}
                            onChange={(e) => setReceiptDraftByStep((prev) => ({
                              ...prev,
                              [step.id]: {
                                ...receiptDraft,
                                task_meta: { ...receiptDraft.task_meta, source_ref: toStringOrNull(e.target.value || '') },
                              },
                            }))}
                          />
                        </label>
                      ) : null}
                      <label className="is-wide">
                        Notes
                        <input
                          type="text"
                          value={receiptDraft.receipt_notes}
                          onChange={(e) => setReceiptDraftByStep((prev) => ({
                            ...prev,
                            [step.id]: { ...receiptDraft, receipt_notes: e.target.value },
                          }))}
                        />
                      </label>
                      <label className="is-wide">
                        Task Attachment(s)
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          multiple
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setReceiptAttachmentDraftByStep((prev) => ({ ...prev, [step.id]: files }));
                          }}
                        />
                      </label>
                    </div>
                    <div className="build-wizard-note-editor-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => { void onSaveReceiptForStep(step); }}
                      >
                        {Number(editingReceiptDocumentIdByStep[step.id] || 0) > 0 ? 'Update Task' : 'Save Task'}
                      </button>
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => {
                          setEditingReceiptDocumentIdByStep((prev) => ({ ...prev, [step.id]: 0 }));
                          setReceiptEditorOpenByStep((prev) => ({ ...prev, [step.id]: false }));
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
                {stepReceiptDocuments.length > 0 ? (
                  <div className="build-wizard-step-receipt-list">
                    {stepReceiptDocuments.map((doc) => {
                      const attachments = stepReceiptAttachmentDocuments.filter((attachment) => Number(attachment.receipt_parent_document_id || 0) === doc.id);
                      const parsedTask = parseTaskMetaFromReceiptNotes(doc.receipt_notes || '');
                      const taskTypeLabel = TASK_TYPE_OPTIONS.find((option) => option.value === parsedTask.taskMeta.task_type)?.label || 'Construction';
                      const isQuoteTask = parsedTask.taskMeta.task_type === 'quote';
                      const inlineEditingField = inlineEditingReceiptFieldByDocId[doc.id] || null;
                      const inlineDraft = inlineReceiptDraftByDocId[doc.id] || {
                        vendor: doc.receipt_vendor || '',
                        date: doc.receipt_date || '',
                        amount: doc.receipt_amount !== null && Number.isFinite(Number(doc.receipt_amount)) ? String(doc.receipt_amount) : '',
                        taskType: parsedTask.taskMeta.task_type,
                        plainNotes: parsedTask.plainNotes || '',
                        taskMeta: parsedTask.taskMeta,
                      };
                      const attachableTaskDocuments = attachableProjectDocuments.filter((candidate) => {
                        if (candidate.id === doc.id) {
                          return false;
                        }
                        if (String(candidate.kind || '').trim() === 'receipt') {
                          return false;
                        }
                        const isAlreadyAttached = String(candidate.kind || '').trim() === 'receipt_attachment'
                          && Number(candidate.receipt_parent_document_id || 0) === doc.id;
                        return !isAlreadyAttached;
                      });
                      const receiptAttachmentFilter = String(attachExistingDocFilterByReceiptId[doc.id] || '').trim().toLowerCase();
                      const filteredAttachableTaskDocuments = receiptAttachmentFilter
                        ? attachableTaskDocuments.filter((candidate) => {
                          const haystack = `${candidate.original_name} ${buildWizardTokenLabel(candidate.kind, 'Other')}`.toLowerCase();
                          return haystack.includes(receiptAttachmentFilter);
                        })
                        : attachableTaskDocuments;
                      return (
                        <div
                          className="build-wizard-step-receipt-row"
                          key={`step-${step.id}-receipt-${doc.id}`}
                          ref={(el) => { receiptRowRefByDocId.current[doc.id] = el; }}
                        >
                          <div className="build-wizard-step-receipt-file">
                            <button
                              type="button"
                              className="build-wizard-step-receipt-link"
                              onClick={() => void openDocumentPreview(doc)}
                              title={doc.original_name}
                            >
                              {doc.receipt_title?.trim() || doc.caption || doc.original_name}
                            </button>
                            <span>
                              Vendor:{' '}
                              {inlineEditingField === 'vendor' ? (
                                <select
                                  autoFocus
                                  value={inlineDraft.vendor}
                                  onChange={(e) => {
                                    const nextValue = e.target.value;
                                    setInlineReceiptDraftByDocId((prev) => ({
                                      ...prev,
                                      [doc.id]: { ...inlineDraft, vendor: nextValue },
                                    }));
                                    void saveInlineReceiptEdit(doc, 'vendor', { vendor: nextValue });
                                  }}
                                  onBlur={() => { void saveInlineReceiptEdit(doc, 'vendor'); }}
                                >
                                  <option value="">-</option>
                                  {taskVendorOptions.map((vendorName) => (
                                    <option key={`vendor-opt-${doc.id}-${vendorName}`} value={vendorName}>{vendorName}</option>
                                  ))}
                                </select>
                              ) : (
                                <button
                                  type="button"
                                  className="build-wizard-inline-edit-trigger"
                                  onClick={() => startInlineReceiptEdit(doc, parsedTask, 'vendor')}
                                >
                                  {doc.receipt_vendor || '-'}
                                </button>
                              )}
                              {' '}| Date:{' '}
                              {inlineEditingField === 'date' ? (
                                <input
                                  type="date"
                                  autoFocus
                                  value={inlineDraft.date}
                                  onChange={(e) => {
                                    const nextValue = e.target.value;
                                    setInlineReceiptDraftByDocId((prev) => ({
                                      ...prev,
                                      [doc.id]: { ...inlineDraft, date: nextValue },
                                    }));
                                  }}
                                  onBlur={() => { void saveInlineReceiptEdit(doc, 'date'); }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                />
                              ) : (
                                <button
                                  type="button"
                                  className="build-wizard-inline-edit-trigger"
                                  onClick={() => startInlineReceiptEdit(doc, parsedTask, 'date')}
                                >
                                  {doc.receipt_date || '-'}
                                </button>
                              )}
                              {' '}| Amount:{' '}
                              {inlineEditingField === 'amount' ? (
                                <input
                                  type="number"
                                  autoFocus
                                  min="0"
                                  step="0.01"
                                  inputMode="decimal"
                                  value={inlineDraft.amount}
                                  onChange={(e) => {
                                    const nextValue = e.target.value;
                                    setInlineReceiptDraftByDocId((prev) => ({
                                      ...prev,
                                      [doc.id]: { ...inlineDraft, amount: nextValue },
                                    }));
                                  }}
                                  onBlur={() => { void saveInlineReceiptEdit(doc, 'amount'); }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                />
                              ) : (
                                <button
                                  type="button"
                                  className="build-wizard-inline-edit-trigger"
                                  onClick={() => startInlineReceiptEdit(doc, parsedTask, 'amount')}
                                >
                                  <span className={isQuoteTask ? 'build-wizard-quote-amount' : ''}>{formatCurrency(Number(doc.receipt_amount || 0))}</span>
                                </button>
                              )}
                            </span>
                            <span>
                              Type:{' '}
                              {inlineEditingField === 'type' ? (
                                <select
                                  autoFocus
                                  value={inlineDraft.taskType}
                                  onChange={(e) => {
                                    const nextType = e.target.value as BuildWizardTaskType;
                                    setInlineReceiptDraftByDocId((prev) => ({
                                      ...prev,
                                      [doc.id]: { ...inlineDraft, taskType: nextType },
                                    }));
                                    void saveInlineReceiptEdit(doc, 'type', { taskType: nextType });
                                  }}
                                  onBlur={() => { void saveInlineReceiptEdit(doc, 'type'); }}
                                >
                                  {TASK_TYPE_OPTIONS.map((opt) => (
                                    <option key={`inline-task-type-${doc.id}-${opt.value}`} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              ) : (
                                <button
                                  type="button"
                                  className="build-wizard-inline-edit-trigger"
                                  onClick={() => startInlineReceiptEdit(doc, parsedTask, 'type')}
                                >
                                  {taskTypeLabel}
                                </button>
                              )}
                            </span>
                          </div>
                          <div className="build-wizard-step-receipt-attachments">
                            <div className="build-wizard-step-receipt-attachments-label">
                              Attachments ({attachments.length})
                            </div>
                            {attachments.length > 0 ? (
                              <div className="build-wizard-step-receipt-attachments-list">
                                {attachments.map((attachment) => (
                                  <button
                                    key={`receipt-${doc.id}-attachment-${attachment.id}`}
                                    type="button"
                                    className="build-wizard-step-receipt-link"
                                    onClick={() => void openDocumentPreview(attachment)}
                                    title={attachment.original_name}
                                  >
                                    {attachment.original_name}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            {attachableTaskDocuments.length > 0 ? (
                              <div className="build-wizard-step-attach-existing">
                                {attachExistingPickerOpenByReceiptId[doc.id] ? (
                                  <input
                                    type="text"
                                    className="build-wizard-attach-filter-input"
                                    placeholder="Filter attachments..."
                                    value={attachExistingDocFilterByReceiptId[doc.id] || ''}
                                    onChange={(e) => setAttachExistingDocFilterByReceiptId((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                                  />
                                ) : null}
                                <select
                                  value={attachExistingDocByReceiptId[doc.id] || ''}
                                  onFocus={() => setAttachExistingPickerOpenByReceiptId((prev) => ({ ...prev, [doc.id]: true }))}
                                  onMouseDown={() => setAttachExistingPickerOpenByReceiptId((prev) => ({ ...prev, [doc.id]: true }))}
                                  onChange={(e) => setAttachExistingDocByReceiptId((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                                >
                                  <option value="">Attach existing document...</option>
                                  {filteredAttachableTaskDocuments.map((candidate) => (
                                    <option key={`task-attach-${doc.id}-${candidate.id}`} value={String(candidate.id)}>
                                      {candidate.original_name} ({buildWizardTokenLabel(candidate.kind, 'Other')})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() => void onAttachExistingDocumentToReceipt(step, doc)}
                                  disabled={!attachExistingDocByReceiptId[doc.id]}
                                >
                                  Attach
                                </button>
                              </div>
                            ) : null}
                          </div>
                          <div className="build-wizard-step-receipt-actions">
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => onStartEditReceiptForStep(step, doc)}
                              disabled={stepReadOnly}
                            >
                              Edit
                            </button>
                            <label className="btn btn-outline-secondary btn-sm build-wizard-upload-btn">
                              Upload Attachment
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                multiple
                                onChange={(e) => {
                                  onUploadReceiptAttachments(doc, e.target.files);
                                  e.currentTarget.value = '';
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => void onDeleteDocument(doc.id, doc.original_name)}
                              disabled={deletingDocumentId === doc.id}
                            >
                              {deletingDocumentId === doc.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              ) : null}

              {stepNonReceiptDocuments.length > 0 ? (
                <div className="build-wizard-step-media">
                  {renderDocumentGallery(
                    stepNonReceiptDocuments,
                    '',
                    stepReadOnly
                  )}
                </div>
              ) : null}

              {step.notes.length > 0 ? (
                <div className="build-wizard-note-list">
                  {step.notes.map((n) => (
                    <div key={n.id}>
                      <strong>{formatDate(n.created_at)}</strong>:
                      {Object.prototype.hasOwnProperty.call(editingNoteTextById, n.id) ? (
                        <div className="build-wizard-note-editor">
                          <textarea
                            rows={2}
                            value={editingNoteTextById[n.id] || ''}
                            onChange={(e) => setEditingNoteTextById((prev) => ({ ...prev, [n.id]: e.target.value }))}
                          />
                          <div className="build-wizard-note-editor-actions">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => { void onSaveEditedNote(step.id, n.id); }}
                              disabled={savingNoteId === n.id}
                            >
                              {savingNoteId === n.id ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => onCancelEditNote(n.id)}
                              disabled={savingNoteId === n.id}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => { void onDeleteStepNoteById(step.id, n.id); }}
                              disabled={deletingNoteId === n.id || savingNoteId === n.id}
                            >
                              {deletingNoteId === n.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {' '}
                          {n.note_text}
                          {noteEditedAtLabel(n) ? (
                            <>
                              {' '}
                              <em>(Edited {noteEditedAtLabel(n)})</em>
                            </>
                          ) : null}
                          {!stepReadOnly ? (
                            <>
                              {' '}
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => onStartEditNote(n.id, n.note_text)}
                              >
                                Edit
                              </button>
                              {' '}
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => { void onDeleteStepNoteById(step.id, n.id); }}
                                disabled={deletingNoteId === n.id}
                              >
                                {deletingNoteId === n.id ? 'Deleting...' : 'Delete'}
                              </button>
                            </>
                          ) : null}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              </>
              ) : null}
            </div>
            <div
              className={`build-wizard-drop-zone ${dragOverInsertIndex === rowIndex + 1 ? 'is-active' : ''}`}
              onDragOver={(e) => {
                if (draggingStepId > 0) {
                  e.preventDefault();
                  setDragOverInsertIndex(rowIndex + 1);
                  setDragOverParentStepId(0);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                void onDropReorder(rowIndex + 1);
              }}
            />
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderDocumentGallery = (items: typeof documents, emptyText: string, readOnly: boolean = false) => {
    if (!items.length) {
      return <div className="build-wizard-muted">{emptyText}</div>;
    }

    return (
      <div className="build-wizard-doc-gallery">
        {items.map((doc) => (
          <div className="build-wizard-doc-card" key={doc.id}>
            {Number(doc.is_image) === 1 ? (
              <button
                className="build-wizard-doc-thumb-btn"
                onClick={() => void openDocumentPreview(doc)}
                title="Click to enlarge"
              >
                <WebpImage src={doc.thumbnail_url || doc.public_url} alt={doc.original_name} className="build-wizard-doc-thumb" />
              </button>
            ) : isPdfDocument(doc) ? (
              <button type="button" className="build-wizard-doc-thumb-link" onClick={() => void openDocumentPreview(doc)} title="Open preview">
                <WebpImage src={doc.thumbnail_url || doc.public_url} alt={`${doc.original_name} preview`} className="build-wizard-doc-thumb" />
              </button>
            ) : (isSpreadsheetPreviewDoc(doc) || isPlanPreviewDoc(doc)) ? (
              <button
                type="button"
                className="build-wizard-doc-file-link build-wizard-doc-file-link-rich"
                onClick={() => void openDocumentPreview(doc)}
                title="Open preview"
              >
                <span className="build-wizard-doc-file-glyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5" />
                    <path d="M9 13h6M9 16h6" />
                  </svg>
                </span>
                <span className="build-wizard-doc-file-ext">{thumbnailKindLabel(doc)}</span>
                <span className="build-wizard-doc-file-open">Open preview</span>
              </button>
            ) : (
              <button type="button" className="build-wizard-doc-file-link build-wizard-doc-file-link-rich" onClick={() => void openDocumentPreview(doc)}>
                <span className="build-wizard-doc-file-glyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5" />
                    <path d="M9 13h6M9 16h6" />
                  </svg>
                </span>
                <span className="build-wizard-doc-file-ext">{thumbnailKindLabel(doc)}</span>
                <span className="build-wizard-doc-file-open">Open file</span>
              </button>
            )}
            <button
              type="button"
              className="build-wizard-doc-delete-btn"
              title={unlinkingDocumentId === doc.id ? 'Removing...' : 'Remove from step'}
              aria-label={unlinkingDocumentId === doc.id ? `Removing ${doc.original_name} from step` : `Remove ${doc.original_name} from step`}
              onClick={() => void onRemoveDocumentFromStep(doc.id, doc.original_name)}
              disabled={readOnly || unlinkingDocumentId === doc.id}
            >
              <svg viewBox="0 0 24 24" className="build-wizard-doc-delete-icon" aria-hidden="true">
                <path d="M9 3h6a1 1 0 0 1 1 1v1h4v2h-1v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7H4V5h4V4a1 1 0 0 1 1-1Zm1 2v0h4V5h-4Zm-3 2v12h10V7H7Zm2 2h2v8H9V9Zm4 0h2v8h-2V9Z" />
              </svg>
            </button>
            <div className="build-wizard-doc-name">{doc.original_name}</div>
            <div className="build-wizard-doc-meta">
              <span>{doc.kind}</span>
              <span>{prettyPhaseLabel(doc.step_phase_key)}</span>
              <span>{doc.step_title || 'No Step Linked'}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderProjectPhotosAndKeyPaperwork = () => (
    <>
      <div className="build-wizard-section-divider" />
      <h3>Project Photos & Key Paperwork</h3>
      <div className="build-wizard-upload-row">
        <select value={docKind} onChange={(e) => setDocKind(e.target.value)}>
          {docKindOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select value={docPhaseKey} onChange={(e) => setDocPhaseKey(e.target.value)}>
          {phaseOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select value={docStepId > 0 ? String(docStepId) : ''} onChange={(e) => setDocStepId(Number(e.target.value || '0'))}>
          <option value="">Auto-link by phase</option>
          {selectableDocSteps.map((step) => (
            <option key={step.id} value={step.id}>#{step.step_order} {step.title}</option>
          ))}
        </select>
        <input
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={(e) => {
            const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
            if (file) {
              void uploadDocument(docKind, file, docStepId > 0 ? docStepId : undefined, undefined, docPhaseKey);
            }
            e.currentTarget.value = '';
          }}
        />
      </div>
      <div className="build-wizard-upload-row build-wizard-primary-row">
        <label>
          Primary Project Photo
          <select
            value={Number(project?.primary_photo_document_id || 0) > 0 ? String(project?.primary_photo_document_id) : ''}
            onChange={(e) => {
              const nextId = Number(e.target.value || '0');
              void updateProject({ primary_photo_document_id: nextId > 0 ? nextId : null });
            }}
          >
            <option value="">No primary photo</option>
            {primaryPhotoChoices.map((doc) => (
              <option key={doc.id} value={doc.id}>{doc.original_name}</option>
            ))}
          </select>
        </label>
        <label>
          Primary Blueprint
          <select
            value={Number(project?.blueprint_document_id || 0) > 0 ? String(project?.blueprint_document_id) : ''}
            onChange={(e) => {
              const nextId = Number(e.target.value || '0');
              void updateProject({ blueprint_document_id: nextId > 0 ? nextId : null });
            }}
          >
            <option value="">No primary blueprint</option>
            {primaryBlueprintChoices.map((doc) => (
              <option key={doc.id} value={doc.id}>{doc.original_name}</option>
            ))}
          </select>
        </label>
      </div>
      {renderDocumentGallery(projectDocuments, 'No project media yet.')}
    </>
  );

  const renderLauncher = () => (
    <div className="build-wizard-shell">
      <div className="build-wizard-launcher">
        <div className="build-wizard-page-close">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={onOpenTemplateEditor}
          >
            Template Editor
          </button>
          <StandardIconButton
            iconKey="close"
            ariaLabel="Close Build Wizard"
            title="Close Build Wizard"
            className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
            onClick={onCloseWizard}
          />
        </div>
        <h1>Build Wizard</h1>
        <p>Choose an existing build or start a new build.</p>
        <div className="build-wizard-launcher-grid">
          <div className="build-wizard-launch-card is-new">
            <button
              type="button"
              className="build-wizard-launch-icon-btn"
              onClick={() => void onCreateNewBuild()}
              aria-label="Create a new home build project"
              title="Create a new home build project"
            >
              <div className="build-wizard-thumb">
                <div className="build-wizard-thumb-roof" />
                <div className="build-wizard-thumb-body" />
              </div>
            </button>
            <span className="build-wizard-launch-title">Build a New Home</span>
            <div className="build-wizard-launcher-template-picker">
              <label htmlFor="build-wizard-template-wastewater-kind">Wastewater setup</label>
              <select
                id="build-wizard-template-wastewater-kind"
                className="form-select form-select-sm"
                value={newHomeWastewaterKind}
                onChange={(e) => {
                  const next = String(e.target.value || '').trim();
                  setNewHomeWastewaterKind(next === 'public_sewer' ? 'public_sewer' : 'septic');
                }}
              >
                <option value="septic">Dawson County Home - Septic</option>
                <option value="public_sewer">Dawson County Home - Public Sewer</option>
              </select>
            </div>
            <div className="build-wizard-launcher-template-picker">
              <label htmlFor="build-wizard-template-water-kind">Water source</label>
              <select
                id="build-wizard-template-water-kind"
                className="form-select form-select-sm"
                value={newHomeWaterKind}
                onChange={(e) => {
                  const next = String(e.target.value || '').trim();
                  setNewHomeWaterKind(next === 'private_well' ? 'private_well' : 'county_water');
                }}
              >
                <option value="county_water">County Water (Etowah Water &amp; Sewer)</option>
                <option value="private_well">Private Well</option>
              </select>
            </div>
          </div>

          {launcherProjects.map((p) => (
            <div
              key={p.id}
              className="build-wizard-launch-card build-wizard-launch-card-with-delete"
              style={{ ['--thumb-tone' as any]: `${(p.id * 37) % 360}deg` }}
            >
              <button
                type="button"
                className="build-wizard-launch-card-open"
                onClick={() => void openBuild(p.id, 'launcher')}
                title={`Open ${p.title}`}
              >
                <div className="build-wizard-thumb build-wizard-thumb-media">
                  <div className="build-wizard-thumb-media-main">
                    {p.primary_photo_thumbnail_url ? (
                      <WebpImage src={p.primary_photo_thumbnail_url} alt={`${p.title} primary photo`} className="build-wizard-thumb-media-image" />
                    ) : (
                      <div className="build-wizard-thumb-fallback">Photo</div>
                    )}
                  </div>
                  <div className="build-wizard-thumb-media-overlay">
                    {p.primary_blueprint_thumbnail_url ? (
                      <WebpImage src={p.primary_blueprint_thumbnail_url} alt={`${p.title} primary blueprint`} className="build-wizard-thumb-media-image" />
                    ) : (
                      <div className="build-wizard-thumb-fallback is-blueprint">Blueprint</div>
                    )}
                  </div>
                </div>
                <span className="build-wizard-launch-title">{p.title}</span>
              </button>
              <button
                type="button"
                className="build-wizard-launch-card-delete"
                aria-label={`Delete ${p.title}`}
                title={`Delete ${p.title}`}
                onClick={() => void onDeleteProject({ id: p.id, title: p.title })}
                disabled={deletingProjectId === p.id}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            </div>
          ))}
          {launcherProjects.length === 0 ? (
            <div className="build-wizard-launch-empty">
              No home builds yet. Use <strong>Build a New Home</strong> to create your first project.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  const renderTemplateEditor = () => (
    <div className="build-wizard-shell">
      <div className="build-wizard-launcher">
        <div className="build-wizard-page-close">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onBackToLauncher}
          >
            Back to Launcher
          </button>
          <StandardIconButton
            iconKey="close"
            ariaLabel="Close Build Wizard"
            title="Close Build Wizard"
            className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
            onClick={onCloseWizard}
          />
        </div>
        <div className="build-wizard-template-editor-head">
          <h1>Template Editor</h1>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void onCreateTemplate()}>
            Create Template
          </button>
        </div>
        <p>Manage reusable Build Wizard templates.</p>
        <div className="build-wizard-template-editor-list">
          {templateProjects.length === 0 ? (
            <div className="build-wizard-template-editor-empty">No templates yet. Create your first template to get started.</div>
          ) : (
            templateProjects.map((template) => (
              <div key={template.id} className="build-wizard-template-editor-row">
                <div className="build-wizard-template-editor-meta">
                  <div className="build-wizard-template-editor-title">{template.title}</div>
                  <div className="build-wizard-template-editor-sub">
                    {template.step_count} step{template.step_count === 1 ? '' : 's'} | Updated {formatDate(template.updated_at)}
                  </div>
                </div>
                <div className="build-wizard-template-editor-actions">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => void openBuild(template.id, 'template_editor')}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => void onDeleteProject({ id: template.id, title: template.title })}
                    disabled={deletingProjectId === template.id}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderBuildWorkspace = () => (
    <div className="build-wizard-shell build-wizard-has-footer-space" style={{ ['--build-wizard-sticky-top' as string]: `${stickyTopOffset}px` }}>
      <div className="build-wizard-workspace">
        <div className="build-wizard-sticky-head" ref={stickyHeadRef}>
          <div className="build-wizard-topbar">
            <button className="btn btn-outline-secondary" onClick={onBackFromWorkspace}>
              {isTemplateProject || buildEntryPoint === 'template_editor' ? 'Back to Template Editor' : 'Back to Launcher'}
            </button>
            <div className="build-wizard-topbar-title">{project?.title || 'Home Build'}</div>
            <div className="build-wizard-topbar-search-shell" ref={topbarSearchBoxRef}>
              <input
                type="search"
                value={topbarSearchQuery}
                onFocus={() => setTopbarSearchOpen(true)}
                onChange={(e) => {
                  setTopbarSearchQuery(e.target.value);
                  setTopbarSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setTopbarSearchOpen(false);
                    return;
                  }
                  if (e.key === 'Enter' && topbarSearchResults.length > 0) {
                    e.preventDefault();
                    selectTopbarSearchResult(topbarSearchResults[0]);
                  }
                }}
                className="form-control form-control-sm build-wizard-topbar-search-input"
                placeholder="Search docs, steps, phases..."
                aria-label="Search build wizard content"
              />
              {topbarSearchOpen && topbarSearchQuery.trim() ? (
                <div className="build-wizard-topbar-search-results" role="listbox" aria-label="Build wizard search results">
                  {topbarSearchResults.length === 0 ? (
                    <div className="build-wizard-topbar-search-empty">
                      No matches yet.
                      {topbarSearchLoading ? ' Searching...' : ''}
                    </div>
                  ) : (
                    topbarSearchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        className="build-wizard-topbar-search-result"
                        onClick={() => selectTopbarSearchResult(result)}
                      >
                        <span className="build-wizard-topbar-search-result-kind">
                          {result.kind === 'document' ? 'Doc' : result.kind === 'step' ? 'Step' : 'Phase'}
                        </span>
                        <span className="build-wizard-topbar-search-result-text">
                          <strong>{result.title}</strong>
                          <span>{result.subtitle}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <div className="build-wizard-topbar-actions">
              {isTemplateProject ? (
                <button className="btn btn-success btn-sm" onClick={() => void onSaveTemplate()} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
              ) : null}
              <button className="btn btn-primary btn-sm" onClick={() => setAiToolsOpen(true)}>AI Tools</button>
              <button className="btn btn-outline-primary btn-sm" onClick={() => setProjectOverviewOpen(true)}>Project Overview</button>
              <button className="btn btn-outline-primary btn-sm" onClick={() => setProjectDeskOpen(true)}>Project Desk</button>
              <StandardIconButton
                iconKey="close"
                ariaLabel="Close Build Wizard"
                title="Close Build Wizard"
                className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
                onClick={onCloseWizard}
              />
            </div>
          </div>

          <div className="build-wizard-tabs">
            {BUILD_TABS.filter((tab) => tab.id !== 'desk').map((tab) => (
              <button
                key={tab.id}
                className={`build-wizard-tab${activeTab === tab.id ? ' is-active' : ''}`}
                style={{ ['--tab-phase-color' as string]: TAB_PHASE_COLORS[tab.id] }}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="build-wizard-tab-swatch" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {activeTab !== 'overview' && activeTab !== 'start' && activeTab !== 'completed' ? (
            <div className="build-wizard-sticky-phase-controls">
              <div className="build-wizard-phase-head">
                <h2>{BUILD_TABS.find((t) => t.id === activeTab)?.label}</h2>
                <div className="build-wizard-phase-totals">
                  <span>Phase Total: <span className="build-wizard-phase-total-value">{formatCurrency(phaseTotals.phaseTotal)}</span></span>
                  <span>Project Total To Date: <span className="build-wizard-phase-total-value">{formatCurrency(phaseTotals.projectToDateTotal)}</span></span>
                </div>
                <div className="build-wizard-phase-date-range">
                  <label>
                    Phase Start
                    <input
                      type="date"
                      value={activePhaseDateRange.start || ''}
                      max={activePhaseDateRange.end || undefined}
                      onChange={(e) => onPhaseDateRangeChange({ start: toStringOrNull(e.target.value) })}
                    />
                  </label>
                  <label>
                    Phase End
                    <input
                      type="date"
                      value={activePhaseDateRange.end || ''}
                      min={activePhaseDateRange.start || undefined}
                      onChange={(e) => onPhaseDateRangeChange({ end: toStringOrNull(e.target.value) })}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm build-wizard-phase-range-reset"
                    disabled={!activePhaseHasStoredDateRange}
                    title="Reset phase dates to auto-derived step range"
                    onClick={() => {
                      if (!PHASE_PROGRESS_ORDER.includes(activeTab)) {
                        return;
                      }
                      void savePhaseDateRange(
                        projectId,
                        activeTab as 'land' | 'permits' | 'site' | 'framing' | 'mep' | 'finishes',
                        null,
                        null,
                      );
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="build-wizard-step-assignee-filters">
                <span>Step Card Filters</span>
                <select
                  value={stepCardAssigneeTypeFilter}
                  onChange={(e) => setStepCardAssigneeTypeFilter(e.target.value as 'all' | BuildWizardContactType)}
                >
                  <option value="all">All Contacts</option>
                  <option value="contact">Contacts Only</option>
                  <option value="vendor">Vendors Only</option>
                  <option value="authority">Authorities Only</option>
                </select>
                <select
                  value={stepCardAssigneeIdFilter > 0 ? String(stepCardAssigneeIdFilter) : ''}
                  onChange={(e) => setStepCardAssigneeIdFilter(Number(e.target.value || '0'))}
                >
                  <option value="">All Assigned People</option>
                  {stepFilterContactOptions.map((contact) => (
                    <option key={`step-filter-contact-${contact.id}`} value={contact.id}>
                      {contactTypeLabel(normalizeContactType(contact))}: {contact.display_name}
                    </option>
                  ))}
                </select>
                <input
                  type="search"
                  className="form-control form-control-sm build-wizard-step-text-filter-input"
                  placeholder="Filter step text..."
                  aria-label="Filter steps by text"
                  value={stepCardTextFilter}
                  onChange={(e) => setStepCardTextFilter(e.target.value)}
                />
                {(stepCardAssigneeTypeFilter !== 'all' || stepCardAssigneeIdFilter > 0 || stepCardTextFilterTokens.length > 0) ? (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => {
                      setStepCardAssigneeTypeFilter('all');
                      setStepCardAssigneeIdFilter(0);
                      setStepCardTextFilter('');
                    }}
                  >
                    Clear Filters
                  </button>
                ) : null}
                <button
                  type="button"
                  className="build-wizard-phase-add build-wizard-phase-add-in-filters"
                  title="Add step"
                  aria-label="Add step"
                  onClick={() => void addStep(TAB_DEFAULT_PHASE_KEY[activeTab] || 'general')}
                >
                  +
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="build-wizard-sticky-head-spacer" aria-hidden="true" style={{ height: stickyHeadHeight }} />

        {activeTab === 'overview' ? (
          <div className="build-wizard-card">
            <h2>Project Overview</h2>
            <div className="build-wizard-overview-grid">
              <div className="build-wizard-overview-metric">
                <div className="build-wizard-overview-label">Project Start Date</div>
                <div className="build-wizard-overview-value">{overviewMetrics.startDate ? formatTimelineDate(overviewMetrics.startDate) : 'Not set'}</div>
                <div className="build-wizard-overview-sub">
                  {overviewMetrics.startCountdownDays === null
                    ? 'Set Target Start Date or step start dates.'
                    : (overviewMetrics.startCountdownDays >= 0
                      ? `${overviewMetrics.startCountdownDays} day(s) until start`
                      : `${Math.abs(overviewMetrics.startCountdownDays)} day(s) since start`)}
                </div>
              </div>
              <div className="build-wizard-overview-metric">
                <div className="build-wizard-overview-label">Next Looming Step</div>
                <div className="build-wizard-overview-value">
                  {overviewMetrics.nextStep ? `#${overviewMetrics.nextStep.step.step_order} ${overviewMetrics.nextStep.step.title}` : 'No upcoming step dates'}
                </div>
                <div className="build-wizard-overview-sub">
                  {overviewMetrics.nextStep
                    ? `${formatDate(overviewMetrics.nextStep.step.expected_start_date)} - ${formatDate(overviewMetrics.nextStep.step.expected_end_date)}`
                    : 'Add expected dates to upcoming steps.'}
                </div>
              </div>
              <div className="build-wizard-overview-metric">
                <div className="build-wizard-overview-label">Estimated Project End</div>
                <div className="build-wizard-overview-value">{overviewMetrics.endDate ? formatTimelineDate(overviewMetrics.endDate) : 'Not set'}</div>
                <div className="build-wizard-overview-sub">
                  {overviewMetrics.endCountdownDays === null
                    ? 'Set Target Completion Date or step end dates.'
                    : (overviewMetrics.endCountdownDays >= 0
                      ? `${overviewMetrics.endCountdownDays} day(s) remaining`
                      : `${Math.abs(overviewMetrics.endCountdownDays)} day(s) past due`)}
                </div>
              </div>
            </div>

            <div className="build-wizard-overview-spend">
              <h3>Budget Progress</h3>
              <div className="build-wizard-overview-bar">
                <div
                  className="build-wizard-overview-spent"
                  style={{ width: `${overviewMetrics.projectedTotal > 0 ? Math.min(100, (overviewMetrics.spentActual / overviewMetrics.projectedTotal) * 100) : 0}%` }}
                />
              </div>
              <div className="build-wizard-overview-spend-meta">
                <span>Spent: {formatCurrency(overviewMetrics.spentActual)}</span>
                <span>Projected Total: {formatCurrency(overviewMetrics.projectedTotal)}</span>
                <span>Estimated Left: {formatCurrency(overviewMetrics.remainingProjected)}{overviewMetrics.aiEstimatedCostSteps > 0 ? '*' : ''}</span>
              </div>
            </div>

            <div className="build-wizard-overview-missing">
              <div className="build-wizard-overview-missing-title">Missing Data Check</div>
              <div className="build-wizard-overview-missing-text">
                Steps missing cost estimates: {overviewMetrics.missingEstimateCount} | Steps missing dates: {overviewMetrics.missingTimelineCount}
              </div>
              <button className="btn btn-outline-primary btn-sm" onClick={() => void onEstimateMissingWithAi()} disabled={aiBusy}>
                {aiBusy ? 'Estimating...' : 'Estimate Missing w/ AI'}
              </button>
              <div className="build-wizard-overview-footnote">* AI-estimated value</div>
            </div>

            {renderProjectPhotosAndKeyPaperwork()}
          </div>
        ) : null}

        {activeTab === 'start' ? (
          <div className="build-wizard-card">
            <h2>Initial Home Information</h2>
            <div className="build-wizard-grid">
              <label>
                Home Name
                <input
                  type="text"
                  value={projectDraft.title || ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, title: e.target.value }))}
                  onBlur={() => void updateProject({ title: projectDraft.title || '' })}
                />
              </label>
              <label>
                Status
                <select
                  value={projectDraft.status || 'planning'}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, status: e.target.value }))}
                  onBlur={() => void updateProject({ status: projectDraft.status || 'planning' })}
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="planning">Planning</option>
                </select>
              </label>
              <label>
                Lot Address
                <input
                  type="text"
                  value={projectDraft.lot_address || ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, lot_address: e.target.value }))}
                  onBlur={() => void updateProject({ lot_address: projectDraft.lot_address || '' })}
                />
              </label>
              <label>
                Square Feet
                <input
                  type="number"
                  value={projectDraft.square_feet ?? ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, square_feet: toNumberOrNull(e.target.value) }))}
                  onBlur={() => void updateProject({ square_feet: projectDraft.square_feet })}
                />
              </label>
              <label>
                Home Style
                <input
                  type="text"
                  value={projectDraft.home_style || ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, home_style: e.target.value }))}
                  onBlur={() => void updateProject({ home_style: projectDraft.home_style || '' })}
                />
              </label>
              <label>
                Home Type
                <select
                  value={projectDraft.home_type || ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, home_type: e.target.value }))}
                  onBlur={() => void updateProject({ home_type: projectDraft.home_type || '' })}
                >
                  <option value="">Select type</option>
                  <option value="single_family">Single Family</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="condo">Condo</option>
                  <option value="multi_family">Multi Family</option>
                  <option value="manufactured">Manufactured</option>
                  <option value="farm_ranch">Farm/Ranch</option>
                </select>
              </label>
              <label>
                Number of Rooms
                <input
                  type="number"
                  value={projectDraft.room_count ?? ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, room_count: toNumberOrNull(e.target.value) }))}
                  onBlur={() => void updateProject({ room_count: projectDraft.room_count })}
                />
              </label>
              <label>
                Number of Bedrooms
                <input
                  type="number"
                  value={projectDraft.bedrooms_count ?? ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, bedrooms_count: toNumberOrNull(e.target.value) }))}
                  onBlur={() => void updateProject({ bedrooms_count: projectDraft.bedrooms_count })}
                />
              </label>
              <label>
                Number of Kitchens
                <input
                  type="number"
                  value={projectDraft.kitchens_count ?? ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, kitchens_count: toNumberOrNull(e.target.value) }))}
                  onBlur={(e) => void updateProject({ kitchens_count: toNumberOrNull(e.currentTarget.value) })}
                />
              </label>
              <label>
                Number of Bathrooms
                <input
                  type="number"
                  value={projectDraft.bathroom_count ?? ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, bathroom_count: toNumberOrNull(e.target.value) }))}
                  onBlur={() => void updateProject({ bathroom_count: projectDraft.bathroom_count })}
                />
              </label>
              <label>
                Stories
                <input
                  type="number"
                  value={projectDraft.stories_count ?? ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, stories_count: toNumberOrNull(e.target.value) }))}
                  onBlur={() => void updateProject({ stories_count: projectDraft.stories_count })}
                />
              </label>
              <label>
                Lot Size
                <input
                  type="number"
                  step="0.0001"
                  value={lotSizeInput}
                  onChange={(e) => setLotSizeInput(e.target.value)}
                  onBlur={() => {
                    const nextLotSizeSqft = lotSizeInputToSqftAuto(lotSizeInput);
                    setProjectDraft((prev) => ({ ...prev, lot_size_sqft: nextLotSizeSqft }));
                    void updateProject({ lot_size_sqft: nextLotSizeSqft });
                  }}
                />
                <div className="build-wizard-permit-usage-note">{lotSizeDetectedUnit === 'acres' ? '(acres)' : '(sq ft)'}</div>
              </label>
              <label>
                Garage Spaces
                <input
                  type="number"
                  value={projectDraft.garage_spaces ?? ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, garage_spaces: toNumberOrNull(e.target.value) }))}
                  onBlur={() => void updateProject({ garage_spaces: projectDraft.garage_spaces })}
                />
              </label>
              <label>
                Parking Spaces
                <input
                  type="number"
                  value={projectDraft.parking_spaces ?? ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, parking_spaces: toNumberOrNull(e.target.value) }))}
                  onBlur={() => void updateProject({ parking_spaces: projectDraft.parking_spaces })}
                />
              </label>
              <label>
                Year Built (if existing)
                <input
                  type="number"
                  value={projectDraft.year_built ?? ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, year_built: toNumberOrNull(e.target.value) }))}
                  onBlur={() => void updateProject({ year_built: projectDraft.year_built })}
                />
              </label>
              <label>
                HOA Monthly Fee
                <input
                  type="text"
                  inputMode="decimal"
                  className="build-wizard-currency-input"
                  value={renderCurrencyInputValue('project-hoa_fee_monthly', projectDraft.hoa_fee_monthly)}
                  onFocus={() => startCurrencyEdit('project-hoa_fee_monthly', projectDraft.hoa_fee_monthly)}
                  onChange={(e) => changeCurrencyEdit('project-hoa_fee_monthly', e.target.value)}
                  onBlur={() => finishCurrencyEdit('project-hoa_fee_monthly', (value) => {
                    setProjectDraft((prev) => ({ ...prev, hoa_fee_monthly: value }));
                    void updateProject({ hoa_fee_monthly: value });
                  })}
                />
              </label>
              <label>
                Target Start Date
                <input
                  type="date"
                  value={projectDraft.target_start_date || ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, target_start_date: toStringOrNull(e.target.value) }))}
                  onBlur={() => void updateProject({ target_start_date: toStringOrNull(projectDraft.target_start_date || '') })}
                />
              </label>
              <label>
                Target Completion Date
                <input
                  type="date"
                  value={projectDraft.target_completion_date || ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, target_completion_date: toStringOrNull(e.target.value) }))}
                  onBlur={() => void updateProject({ target_completion_date: toStringOrNull(projectDraft.target_completion_date || '') })}
                />
              </label>
            </div>

            <label className="build-wizard-notes-field">
              Home Notes
              <textarea
                rows={5}
                value={projectDraft.wizard_notes || ''}
                onChange={(e) => setProjectDraft((prev) => ({ ...prev, wizard_notes: e.target.value }))}
                onBlur={() => void updateProject({ wizard_notes: projectDraft.wizard_notes || '' })}
              />
            </label>

            <div className="build-wizard-stats-row">
              <span>Completed Steps: {projectTotals.doneCount}/{projectTotals.totalCount}</span>
              <span>Estimated Total: {formatCurrency(projectTotals.totalEstimated)}</span>
              <span>Actual Total: {formatCurrency(projectTotals.totalActual)}</span>
            </div>

            {renderProjectPhotosAndKeyPaperwork()}
          </div>
        ) : null}

        {activeTab !== 'overview' && activeTab !== 'start' && activeTab !== 'completed' ? (
          <div className="build-wizard-card">
            {activeTab === 'desk' ? (
              <div className="build-wizard-desk-grid">
                <div>
                  <h3>Documents</h3>
                  <div className="build-wizard-upload-row">
                    <select value={docKind} onChange={(e) => setDocKind(e.target.value)}>
                      {docKindOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <select value={docPhaseKey} onChange={(e) => setDocPhaseKey(e.target.value)}>
                      {phaseOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <select value={docStepId > 0 ? String(docStepId) : ''} onChange={(e) => setDocStepId(Number(e.target.value || '0'))}>
                      <option value="">Auto-link by phase</option>
                      {selectableDocSteps.map((step) => (
                        <option key={step.id} value={step.id}>#{step.step_order} {step.title}</option>
                      ))}
                    </select>
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                        if (file) {
                          void uploadDocument(docKind, file, docStepId > 0 ? docStepId : undefined, undefined, docPhaseKey);
                        }
                        e.currentTarget.value = '';
                      }}
                    />
                  </div>
                  <div className="build-wizard-doc-list">
                    {renderDocumentGallery(documents, 'No documents uploaded yet.')}
                  </div>
                </div>
              </div>
            ) : null}

            {renderEditableStepCards(filteredTabSteps)}
          </div>
        ) : null}

        {activeTab === 'completed' ? (
          <div className="build-wizard-card">
            <h2>Completed Steps</h2>
            <div className="build-wizard-completed-layout">
              <div className="build-wizard-completed-list">
                {completedSteps.length ? completedSteps.map((step) => (
                  <div className="build-wizard-completed-item" key={step.id}>
                    <div className="build-wizard-completed-head">
                      <strong>#{step.step_order} {step.title}</strong>
                      <span>{formatCurrency(stepCostTotalExcludingQuotes(step))}</span>
                    </div>
                    <div className="build-wizard-completed-date">Date: {formatDate(step.completed_at || step.expected_end_date || step.expected_start_date)}</div>
                    {(stepAssigneesByStepId.get(step.id) || []).length > 0 ? (
                      <div className="build-wizard-step-assignees">
                        <div className="build-wizard-step-assignees-label">Assigned</div>
                        <div className="build-wizard-step-assignees-list">
                          {(stepAssigneesByStepId.get(step.id) || []).map((entry) => (
                            <span key={`completed-${step.id}-${entry.contact.id}`} className={`build-wizard-step-assignee-chip ${contactTypeChipClass(normalizeContactType(entry.contact))}`}>
                              {contactTypeLabel(normalizeContactType(entry.contact))}: {entry.contact.display_name}
                              {entry.source === 'phase' ? ' (Phase)' : ' (Step)'}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {step.notes.length ? (
                      <div className="build-wizard-completed-notes">
                    {step.notes.map((note) => (
                          <div key={note.id}>
                            <strong>{formatDate(note.created_at)}</strong>: {note.note_text}
                            {noteEditedAtLabel(note) ? ` (Edited ${noteEditedAtLabel(note)})` : ''}
                          </div>
                        ))}
                      </div>
                    ) : <div className="build-wizard-muted">No notes on this step.</div>}
                  </div>
                )) : <div className="build-wizard-muted">No completed steps yet.</div>}
              </div>
              <aside className="build-wizard-completed-chart">
                <h3>Date Graph</h3>
                <DateRangeChart steps={completedSteps} rangeStart={footerRange.start} rangeEnd={footerRange.end} />
              </aside>
            </div>
          </div>
        ) : null}
      </div>

      <footer className="build-wizard-footer-chart">
        <div className="build-wizard-footer-inner">
          <FooterPhaseTimeline
            steps={footerTimelineSteps}
            rangeStart={footerRange.start}
            rangeEnd={footerRange.end}
            activeTab={activeTab}
            editable={true}
            displayNumberById={activeTabStepNumbers}
            onStepTimelineChange={onTimelineStepChange}
          />
        </div>
      </footer>

      {projectDeskOpen ? (
        <div className="build-wizard-doc-manager" onClick={() => setProjectDeskOpen(false)}>
          <div className="build-wizard-doc-manager-inner build-wizard-project-desk-inner" onClick={(e) => e.stopPropagation()}>
            <div className="build-wizard-doc-manager-head">
              <h3>Project Desk</h3>
              <div className="build-wizard-doc-manager-actions">
                <button
                  type="button"
                  className="build-wizard-phase-add"
                  title="Add step"
                  aria-label="Add step"
                  onClick={() => void addStep('general')}
                >
                  +
                </button>
                <StandardIconButton
                  iconKey="close"
                  ariaLabel="Close project desk"
                  title="Close"
                  className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
                  onClick={() => setProjectDeskOpen(false)}
                />
              </div>
            </div>
            <div className="build-wizard-desk-grid">
              <div className="build-wizard-desk-documents">
                <div className="build-wizard-doc-manager-head">
                  <h3>Documents</h3>
                  <div className="build-wizard-doc-manager-actions">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => setDocumentUploadModalOpen(true)}
                    >
                      Upload Document
                    </button>
                  </div>
                </div>
                {documents.length ? (
                  <div className="build-wizard-doc-manager-list">
                    <div className="build-wizard-doc-manager-filters">
                      <label>
                        Kind
                        <select
                          value={documentManagerKindFilter}
                          onChange={(e) => setDocumentManagerKindFilter(e.target.value)}
                        >
                          <option value="all">All</option>
                          {documentManagerKindOptions.map((kindValue) => (
                            <option key={kindValue} value={kindValue}>
                              {buildWizardTokenLabel(kindValue, 'Other')}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Phase
                        <select
                          value={documentManagerPhaseFilter}
                          onChange={(e) => setDocumentManagerPhaseFilter(e.target.value)}
                        >
                          <option value="all">All</option>
                          {documentManagerPhaseOptions.map((phaseKey) => (
                            <option key={phaseKey} value={phaseKey}>
                              {prettyPhaseLabel(phaseKey)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Linked Step
                        <select
                          value={documentManagerStepFilter}
                          onChange={(e) => setDocumentManagerStepFilter(e.target.value)}
                        >
                          <option value="all">All</option>
                          <option value="unlinked">No step linked</option>
                          {documentManagerLinkedStepFilterOptions.map((option) => (
                            <option key={`doc-filter-step-${option.step.id}`} value={String(option.step.id)}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Query Index
                        <input
                          type="search"
                          value={documentManagerQuery}
                          onChange={(e) => setDocumentManagerQuery(e.target.value)}
                          placeholder="Search indexed document text..."
                        />
                      </label>
                    </div>
                    {documentManagerQuery.trim().length >= 2 ? (
                      <div className="build-wizard-muted">
                        {documentManagerSearchLoading
                          ? 'Searching index...'
                          : `Index matches: ${filteredDocumentManagerDocs.length}`}
                      </div>
                    ) : null}
                    {filteredDocumentManagerDocs.length ? filteredDocumentManagerDocs.map((doc) => {
                      const draft = buildDocumentDraft(doc);
                      const selectedStep = steps.find((step) => step.id === Number(draft.step_id || 0));
                      const phaseLabel = prettyPhaseLabel(selectedStep?.phase_key || doc.step_phase_key || 'general');
                      const indexedHit = documentManagerSearchResultById.get(doc.id);

                      return (
                        <div className="build-wizard-doc-manager-row" key={doc.id}>
                          <div className="build-wizard-doc-manager-preview">
                            {Number(doc.is_image) === 1 ? (
                              <button
                                className="build-wizard-doc-thumb-btn"
                                onClick={() => void openDocumentPreview(doc)}
                                title="Open preview"
                              >
                                <WebpImage src={doc.thumbnail_url || doc.public_url} alt={doc.original_name} className="build-wizard-doc-thumb" />
                              </button>
                            ) : isPdfDocument(doc) ? (
                              <button type="button" className="build-wizard-doc-thumb-link" onClick={() => void openDocumentPreview(doc)} title="Open preview">
                                <WebpImage src={doc.thumbnail_url || doc.public_url} alt={`${doc.original_name} preview`} className="build-wizard-doc-thumb" />
                              </button>
                            ) : (isSpreadsheetPreviewDoc(doc) || isPlanPreviewDoc(doc)) ? (
                              <button
                                type="button"
                                className="build-wizard-doc-file-link build-wizard-doc-file-link-rich"
                                onClick={() => void openDocumentPreview(doc)}
                                title="Open preview"
                              >
                                <span className="build-wizard-doc-file-glyph" aria-hidden="true">
                                  <svg viewBox="0 0 24 24">
                                    <path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5" />
                                    <path d="M9 13h6M9 16h6" />
                                  </svg>
                                </span>
                                <span className="build-wizard-doc-file-ext">{thumbnailKindLabel(doc)}</span>
                                <span className="build-wizard-doc-file-open">Open preview</span>
                              </button>
                            ) : (
                              <button type="button" className="build-wizard-doc-file-link build-wizard-doc-file-link-rich" onClick={() => void openDocumentPreview(doc)}>
                                <span className="build-wizard-doc-file-glyph" aria-hidden="true">
                                  <svg viewBox="0 0 24 24">
                                    <path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5" />
                                    <path d="M9 13h6M9 16h6" />
                                  </svg>
                                </span>
                                <span className="build-wizard-doc-file-ext">{thumbnailKindLabel(doc)}</span>
                                <span className="build-wizard-doc-file-open">Open file</span>
                              </button>
                            )}
                          </div>
                          <div className="build-wizard-doc-manager-fields">
                            <div className="build-wizard-doc-manager-title">{doc.original_name}</div>
                            <div className="build-wizard-doc-manager-meta">Uploaded: {formatTimelineDate(doc.uploaded_at)} | Phase: {phaseLabel}</div>
                            {indexedHit?.snippet ? (
                              <div className="build-wizard-muted">{indexedHit.snippet}</div>
                            ) : null}
                            <div className="build-wizard-doc-manager-grid">
                              <label>
                                Kind
                                <select
                                  value={draft.kind}
                                  onChange={(e) => updateDocumentDraft(doc.id, { kind: e.target.value })}
                                >
                                  {docKindOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Linked Step
                                <select
                                  className="build-wizard-doc-manager-step-select"
                                  value={draft.step_id > 0 ? String(draft.step_id) : ''}
                                  onChange={(e) => updateDocumentDraft(doc.id, { step_id: Number(e.target.value || '0') })}
                                >
                                  <option value="">No step linked</option>
                                  {linkedStepOptions.map((option) => (
                                    <option key={option.step.id} value={option.step.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="is-wide">
                                Caption
                                <input
                                  type="text"
                                  value={draft.caption}
                                  onChange={(e) => updateDocumentDraft(doc.id, { caption: e.target.value })}
                                />
                              </label>
                              {draft.kind === 'receipt' ? (
                                <>
                                  <label>
                                    Receipt Title
                                    <input
                                      type="text"
                                      value={draft.receipt_title}
                                      onChange={(e) => updateDocumentDraft(doc.id, { receipt_title: e.target.value })}
                                    />
                                  </label>
                                  <label>
                                    Receipt Vendor
                                    <input
                                      type="text"
                                      value={draft.receipt_vendor}
                                      onChange={(e) => updateDocumentDraft(doc.id, { receipt_vendor: e.target.value })}
                                    />
                                  </label>
                                  <label>
                                    Receipt Date
                                    <input
                                      type="date"
                                      value={draft.receipt_date}
                                      onChange={(e) => updateDocumentDraft(doc.id, { receipt_date: e.target.value })}
                                    />
                                  </label>
                                  <label>
                                    Receipt Amount
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      inputMode="decimal"
                                      value={draft.receipt_amount}
                                      onChange={(e) => updateDocumentDraft(doc.id, { receipt_amount: e.target.value })}
                                    />
                                  </label>
                                  <label className="is-wide">
                                    Receipt Notes
                                    <input
                                      type="text"
                                      value={draft.receipt_notes}
                                      onChange={(e) => updateDocumentDraft(doc.id, { receipt_notes: e.target.value })}
                                    />
                                  </label>
                                </>
                              ) : null}
                            </div>
                            <div className="build-wizard-doc-manager-actions">
                              {(isSpreadsheetPreviewDoc(doc) || isPlanPreviewDoc(doc) || Number(doc.is_image) === 1) ? (
                                <StandardIconButton
                                  iconKey="view"
                                  ariaLabel={`Open ${doc.original_name}`}
                                  title="Open"
                                  className="btn btn-outline-primary btn-sm catn8-action-icon-btn"
                                  onClick={() => void openDocumentPreview(doc)}
                                />
                              ) : (
                                <StandardIconButton
                                  iconKey="view"
                                  ariaLabel={`Open ${doc.original_name}`}
                                  title="Open"
                                  className="btn btn-outline-primary btn-sm catn8-action-icon-btn"
                                  onClick={() => void openDocumentPreview(doc)}
                                />
                              )}
                              <StandardIconLink
                                iconKey="download"
                                ariaLabel={`Download ${doc.original_name}`}
                                title="Download"
                                className="btn btn-outline-secondary btn-sm catn8-action-icon-btn"
                                href={withDownloadFlag(doc.public_url)}
                              />
                              <input
                                ref={(el) => { replaceFileInputByDocId.current[doc.id] = el; }}
                                type="file"
                                className="build-wizard-hidden-file-input"
                                onChange={(e) => {
                                  const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                                  void onReplaceDocumentFile(doc, file);
                                  e.currentTarget.value = '';
                                }}
                              />
                              <StandardIconButton
                                iconKey={replacingDocumentId === doc.id ? 'refresh' : 'upload'}
                                ariaLabel={replacingDocumentId === doc.id ? `Replacing ${doc.original_name}` : `Replace ${doc.original_name}`}
                                title={replacingDocumentId === doc.id ? 'Replacing...' : 'Replace'}
                                className="btn btn-outline-secondary btn-sm catn8-action-icon-btn"
                                onClick={() => replaceFileInputByDocId.current[doc.id]?.click()}
                                disabled={replacingDocumentId === doc.id}
                              />
                              {Number(doc.is_image) === 1 ? (
                                <button
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() => void updateProject({ primary_photo_document_id: doc.id })}
                                >
                                  {Number(project?.primary_photo_document_id || 0) === doc.id ? 'Primary Photo' : 'Set Primary Photo'}
                                </button>
                              ) : null}
                              {String(doc.kind || '') === 'blueprint' ? (
                                <button
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() => void updateProject({ blueprint_document_id: doc.id })}
                                >
                                  {Number(project?.blueprint_document_id || 0) === doc.id ? 'Primary Blueprint' : 'Set Primary Blueprint'}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => void onSaveDocumentDraft(doc)}
                                disabled={documentSavingId === doc.id || Number(draft.step_id || 0) <= 0}
                                title={Number(draft.step_id || 0) > 0 ? 'Attach this document to the selected step' : 'Select a step first'}
                              >
                                Attach to Step
                              </button>
                              <StandardIconButton
                                iconKey={documentSavingId === doc.id ? 'refresh' : 'save'}
                                ariaLabel={documentSavingId === doc.id ? `Saving ${doc.original_name}` : `Save ${doc.original_name}`}
                                title={documentSavingId === doc.id ? 'Saving...' : 'Save'}
                                className="btn btn-success btn-sm catn8-action-icon-btn"
                                onClick={() => void onSaveDocumentDraft(doc)}
                                disabled={documentSavingId === doc.id}
                              />
                              <StandardIconButton
                                iconKey={deletingDocumentId === doc.id ? 'refresh' : 'delete'}
                                ariaLabel={deletingDocumentId === doc.id ? `Deleting ${doc.original_name}` : `Delete ${doc.original_name}`}
                                title={deletingDocumentId === doc.id ? 'Deleting...' : 'Delete'}
                                className="btn btn-outline-danger btn-sm catn8-action-icon-btn"
                                onClick={() => void onDeleteDocument(doc.id, doc.original_name)}
                                disabled={deletingDocumentId === doc.id}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    }) : <div className="build-wizard-muted">No documents match the selected filters.</div>}
                  </div>
                ) : (
                  <div className="build-wizard-muted">No documents uploaded yet.</div>
                )}
              </div>
              <div className="build-wizard-desk-contacts">
                <h3>Contacts</h3>
                <div className="build-wizard-contact-summary">
                  <span className="build-wizard-contact-summary-chip">
                    Total: {deskContacts.length}
                  </span>
                  <span className="build-wizard-contact-summary-chip is-vendor">
                    Vendors: {deskContacts.filter((contact) => normalizeContactType(contact) === 'vendor').length}
                  </span>
                  <span className="build-wizard-contact-summary-chip is-authority">
                    Authorities: {deskContacts.filter((contact) => normalizeContactType(contact) === 'authority').length}
                  </span>
                  <span className="build-wizard-contact-summary-chip is-contact">
                    Contacts: {deskContacts.filter((contact) => normalizeContactType(contact) === 'contact').length}
                  </span>
                </div>
                <div className="build-wizard-contact-toolbar">
                  <button type="button" className="btn btn-outline-primary btn-sm" onClick={onStartNewDeskContact}>
                    New Contact
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => {
                      setDeskContactQuery('');
                      setDeskContactTypeFilter('all');
                    }}
                  >
                    Clear Filters
                  </button>
                </div>
                <div className="build-wizard-contact-filter-grid">
                  <input
                    type="search"
                    placeholder="Search name, company, email..."
                    value={deskContactQuery}
                    onChange={(e) => setDeskContactQuery(e.target.value)}
                  />
                  <select
                    value={deskContactTypeFilter}
                    onChange={(e) => setDeskContactTypeFilter(e.target.value as 'all' | BuildWizardContactType)}
                  >
                    <option value="all">All types</option>
                    <option value="contact">Contacts only</option>
                    <option value="vendor">Vendors only</option>
                    <option value="authority">Authorities only</option>
                  </select>
                </div>
                <div className="build-wizard-contact-list-nav">
                  {filteredDeskContacts.length ? filteredDeskContacts.map((contact) => {
                    const assignmentCount = deskContactAssignmentCountById.get(contact.id) || 0;
                    const isSelected = contact.id === deskSelectedContactId;
                    return (
                      <button
                        type="button"
                        key={contact.id}
                        className={`build-wizard-contact-list-item${isSelected ? ' is-selected' : ''}`}
                        onClick={() => {
                          setDeskCreateMode(false);
                          setDeskSelectedContactId(contact.id);
                        }}
                      >
                        <span className="build-wizard-contact-list-main">
                          <strong>{contact.display_name || 'Unnamed contact'}</strong>
                          <span className="build-wizard-contact-list-sub">
                            {contact.company ? `${contact.company} | ` : ''}
                            {contactTypeLabel(normalizeContactType(contact))}
                            {contact.project_id ? ' | Project' : ' | Site'}
                          </span>
                        </span>
                        <span className="build-wizard-contact-list-count">
                          {assignmentCount} assignment{assignmentCount === 1 ? '' : 's'}
                        </span>
                      </button>
                    );
                  }) : <div className="build-wizard-muted">No contacts match the current filters.</div>}
                </div>
                <div className="build-wizard-contact-editor">
                  <label>
                    Name
                    <input
                      type="text"
                      value={deskContactDraft.display_name}
                      onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, display_name: e.target.value }))}
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={deskContactDraft.email}
                      onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      type="text"
                      value={deskContactDraft.phone}
                      onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </label>
                  <label>
                    Company
                    <input
                      type="text"
                      value={deskContactDraft.company}
                      onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, company: e.target.value }))}
                    />
                  </label>
                  <label>
                    Role
                    <input
                      type="text"
                      value={deskContactDraft.role_title}
                      onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, role_title: e.target.value }))}
                    />
                  </label>
                  <div className="build-wizard-contact-flags">
                    <label>
                      Type
                      <select
                        value={deskContactDraft.contact_type}
                        onChange={(e) => {
                          const nextType = e.target.value as BuildWizardContactType;
                          setDeskContactDraft((prev) => ({
                            ...prev,
                            contact_type: nextType,
                            is_vendor: nextType === 'vendor' ? 1 : 0,
                            ...(nextType === 'vendor' ? {} : {
                              vendor_type: '',
                              vendor_license: '',
                              vendor_trade: '',
                              vendor_website: '',
                            }),
                          }));
                        }}
                      >
                        <option value="contact">Contact</option>
                        <option value="vendor">Vendor</option>
                        <option value="authority">Authority</option>
                      </select>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={deskContactDraft.is_project_only === 1}
                        onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, is_project_only: e.target.checked ? 1 : 0 }))}
                      />
                      Project-only contact
                    </label>
                  </div>
                  {deskContactDraft.contact_type === 'vendor' ? (
                    <div className="build-wizard-contact-vendor-fields">
                      <label>
                        Vendor Type
                        <input
                          type="text"
                          value={deskContactDraft.vendor_type}
                          onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, vendor_type: e.target.value }))}
                        />
                      </label>
                      <label>
                        Trade
                        <input
                          type="text"
                          value={deskContactDraft.vendor_trade}
                          onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, vendor_trade: e.target.value }))}
                        />
                      </label>
                      <label>
                        License
                        <input
                          type="text"
                          value={deskContactDraft.vendor_license}
                          onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, vendor_license: e.target.value }))}
                        />
                      </label>
                      <label>
                        Website
                        <input
                          type="url"
                          value={deskContactDraft.vendor_website}
                          onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, vendor_website: e.target.value }))}
                        />
                      </label>
                    </div>
                  ) : null}
                  <label>
                    Notes
                    <textarea
                      rows={3}
                      value={deskContactDraft.notes}
                      onChange={(e) => setDeskContactDraft((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </label>
                  <div className="build-wizard-contact-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => void onSaveDeskContact()}
                      disabled={!deskContactDraft.display_name.trim()}
                    >
                      Save Contact
                    </button>
                    {selectedDeskContact ? (
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void onDeleteDeskContact()}>
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
                {selectedDeskContact ? (
                  <div className="build-wizard-contact-assignments">
                    <h4>Assignments</h4>
                    <div className="build-wizard-contact-assignment-controls">
                      <select value={deskAssignmentPhaseKey} onChange={(e) => setDeskAssignmentPhaseKey(e.target.value)}>
                        <option value="general">General</option>
                        {phaseOptions.map((opt) => (
                          <option key={`contact-phase-${opt.value}`} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void onAddDeskPhaseAssignment()}>
                        Assign Phase
                      </button>
                    </div>
                    <div className="build-wizard-contact-assignment-controls">
                      <select
                        value={deskAssignmentStepId > 0 ? String(deskAssignmentStepId) : ''}
                        onChange={(e) => setDeskAssignmentStepId(Number(e.target.value || '0'))}
                      >
                        <option value="">Select step...</option>
                        {linkedStepOptions.map((opt) => (
                          <option key={`contact-step-${opt.step.id}`} value={opt.step.id}>{opt.label}</option>
                        ))}
                      </select>
                      <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void onAddDeskStepAssignment()}>
                        Assign Step
                      </button>
                    </div>
                    <div className="build-wizard-contact-assignment-list">
                      {selectedContactAssignments.length ? selectedContactAssignments.map((assignment) => {
                        const assignedStep = assignment.step_id ? stepByIdMap.get(assignment.step_id) : null;
                        const phaseName = assignment.phase_key ? prettyPhaseLabel(assignment.phase_key) : null;
                        return (
                          <div key={assignment.id} className="build-wizard-contact-assignment-item">
                            <div>
                              {assignedStep
                                ? `Step #${assignedStep.step_order} ${assignedStep.title}`
                                : `Phase: ${phaseName || 'General'}`}
                            </div>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => void deleteContactAssignment(projectId, assignment.id)}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      }) : <div className="build-wizard-muted">No assignments yet.</div>}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            {renderEditableStepCards(projectDeskSteps)}
          </div>
        </div>
      ) : null}

      {projectOverviewOpen ? (
        <div className="build-wizard-doc-manager" onClick={() => setProjectOverviewOpen(false)}>
          <div className="build-wizard-doc-manager-inner build-wizard-project-overview-inner" onClick={(e) => e.stopPropagation()}>
            <div className="build-wizard-doc-manager-head">
              <h3>Project Overview</h3>
              <div className="build-wizard-doc-manager-actions">
                <StandardIconButton
                  iconKey="close"
                  ariaLabel="Close project overview"
                  title="Close"
                  className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
                  onClick={() => setProjectOverviewOpen(false)}
                />
              </div>
            </div>

            <div className="build-wizard-project-overview-summary">
              <div className="build-wizard-project-overview-summary-item">
                <span>Total Steps</span>
                <strong>{projectOverviewTotals.stepCount}</strong>
              </div>
              <div className="build-wizard-project-overview-summary-item">
                <span>Completed</span>
                <strong>{projectOverviewTotals.completedCount}</strong>
              </div>
              <div className="build-wizard-project-overview-summary-item">
                <span>Projected Cost</span>
                <strong>{formatCurrency(projectOverviewTotals.totalCost)}</strong>
              </div>
              <div className="build-wizard-project-overview-summary-item">
                <span>Range</span>
                <strong>{formatTimelineDate(projectOverviewRange.start)} - {formatTimelineDate(projectOverviewRange.end)}</strong>
              </div>
            </div>

            <div className="build-wizard-project-overview-timeline-card">
              <h4>Master Timeline</h4>
              <FooterPhaseTimeline
                steps={steps}
                rangeStart={projectOverviewRange.start}
                rangeEnd={projectOverviewRange.end}
                activeTab="overview"
                editable={false}
              />
            </div>

            <div className="build-wizard-project-overview-phase-list">
              {projectOverviewSections.map((section) => (
                <section key={section.tabId} className="build-wizard-project-overview-phase">
                  <header className="build-wizard-project-overview-phase-head">
                    <h4>
                      <span className="build-wizard-project-overview-phase-dot" style={{ background: section.phaseColor }} />
                      {section.label}
                    </h4>
                    <div className="build-wizard-project-overview-phase-meta">
                      <span>{section.completedCount}/{section.stepCount} complete</span>
                      <span>{formatTimelineDate(section.startIso)} - {formatTimelineDate(section.endIso)}</span>
                      <span>{formatCurrency(section.totalCost)}</span>
                    </div>
                  </header>
                  <div className="build-wizard-project-overview-step-list">
                    {section.rows.map((row) => (
                      <article key={row.stepId} className={`build-wizard-project-overview-step-row${row.isCompleted ? ' is-completed' : ''}`}>
                        <div className="build-wizard-project-overview-step-title">
                          <div className="build-wizard-project-overview-step-main">
                            <span className="build-wizard-project-overview-step-number">#{row.displayOrder}</span>
                            <strong>{row.title}</strong>
                            <span className="build-wizard-project-overview-step-type">{buildWizardTokenLabel(row.stepType, 'Other')}</span>
                            {row.isCompleted ? <span className="build-wizard-project-overview-step-status">Completed</span> : null}
                          </div>
                          <div className="build-wizard-project-overview-step-meta">
                            <span>{formatDate(row.startIso)} - {formatDate(row.endIso)}</span>
                            <span>{row.durationDays ? `${row.durationDays} day(s)` : 'No duration'}</span>
                            <span>{row.assigneeCount} assignee(s)</span>
                            <span>{row.documentCount} doc(s)</span>
                          </div>
                        </div>
                        <div className="build-wizard-project-overview-step-cost">
                          <div>{formatCurrency(row.totalCost)}</div>
                          <span>{row.costMode === 'actual' ? 'Actual' : (row.costMode === 'estimated' ? 'Estimated' : 'Missing')}</span>
                        </div>
                        <div className="build-wizard-project-overview-step-timeline">
                          {row.hasTimeline ? (
                            <div
                              className="build-wizard-project-overview-step-bar"
                              style={{
                                left: `${row.leftPercent}%`,
                                width: `${row.widthPercent}%`,
                                background: section.phaseColor,
                              }}
                            />
                          ) : (
                            <div className="build-wizard-project-overview-step-no-timeline">No timeline dates</div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {documentUploadModalOpen ? (
        <div className="build-wizard-doc-manager" onClick={() => setDocumentUploadModalOpen(false)}>
          <div className="build-wizard-doc-manager-inner build-wizard-upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="build-wizard-doc-manager-head">
              <h3>Upload Document</h3>
              <div className="build-wizard-doc-manager-actions">
                <StandardIconButton
                  iconKey="close"
                  ariaLabel="Close upload dialog"
                  title="Close"
                  className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
                  onClick={() => setDocumentUploadModalOpen(false)}
                />
              </div>
            </div>
            <div className="build-wizard-doc-manager-grid">
              <label>
                Kind
                <select value={docKind} onChange={(e) => setDocKind(e.target.value)}>
                  {docKindOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Phase
                <select value={docPhaseKey} onChange={(e) => setDocPhaseKey(e.target.value)}>
                  {phaseOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label className="is-wide">
                Linked Step
                <select value={docStepId > 0 ? String(docStepId) : ''} onChange={(e) => setDocStepId(Number(e.target.value || '0'))}>
                  <option value="">Auto-link by phase</option>
                  {selectableDocSteps.map((step) => (
                    <option key={step.id} value={step.id}>#{step.step_order} {step.title}</option>
                  ))}
                </select>
              </label>
              <label className="is-wide">
                File
                <input
                  type="file"
                  onChange={(e) => setDocumentUploadFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                />
              </label>
            </div>
            <div className="build-wizard-doc-manager-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={documentUploadBusy || !documentUploadFile}
                onClick={() => {
                  if (!documentUploadFile || documentUploadBusy) {
                    return;
                  }
                  setDocumentUploadBusy(true);
                  void uploadDocument(docKind, documentUploadFile, docStepId > 0 ? docStepId : undefined, undefined, docPhaseKey)
                    .then(() => {
                      setDocumentUploadModalOpen(false);
                      setDocumentUploadFile(null);
                    })
                    .finally(() => setDocumentUploadBusy(false));
                }}
              >
                {documentUploadBusy ? 'Uploading...' : 'Upload'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  setDocumentUploadModalOpen(false);
                  setDocumentUploadFile(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {aiToolsOpen ? (
        <div className="build-wizard-doc-manager" onClick={() => setAiToolsOpen(false)}>
          <div className="build-wizard-doc-manager-inner build-wizard-ai-tools-modal" onClick={(e) => e.stopPropagation()}>
            <div className="build-wizard-doc-manager-head">
              <h3>AI Tools</h3>
              <div className="build-wizard-doc-manager-actions">
                <StandardIconButton
                  iconKey="close"
                  ariaLabel="Close AI tools"
                  title="Close"
                  className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
                  onClick={() => setAiToolsOpen(false)}
                />
              </div>
            </div>

            <div className="build-wizard-ai-tools-grid">
              <section className="build-wizard-ai-tool-card">
                <h4>Complete w/ AI</h4>
                <p>
                  Runs a full AI pass to reorder, add, and refine steps across phases using project data and linked documents.
                </p>
                <ol>
                  <li>Upload key docs in Project Desk.</li>
                  <li>Review phase assignments and major milestones.</li>
                  <li>Run Complete w/ AI, then review step changes before final edits.</li>
                </ol>
                <button className="btn btn-primary" onClick={() => void onCompleteWithAi()} disabled={aiBusy}>
                  {aiBusy ? 'AI Running...' : 'Complete w/ AI'}
                </button>
              </section>

              <section className="build-wizard-ai-tool-card">
                <h4>Build AI Package</h4>
                <p>
                  Builds the packaged prompt and payload JSON from your current project so you can inspect exactly what AI will consume.
                </p>
                <ol>
                  <li>Click Build AI Package.</li>
                  <li>Review Prompt Text for context quality.</li>
                  <li>Review Payload JSON for data completeness.</li>
                </ol>
                <button className="btn btn-success" disabled={aiBusy} onClick={() => void packageForAi()}>Build AI Package</button>
              </section>

              <section className="build-wizard-ai-tool-card">
                <h4>Send to AI + Ingest</h4>
                <p>
                  Sends the current package to AI and immediately ingests the response back into your project steps and planning data.
                </p>
                <ol>
                  <li>Build AI Package first.</li>
                  <li>Run Send to AI + Ingest.</li>
                  <li>Review generated updates and adjust as needed.</li>
                </ol>
                <button className="btn btn-primary" disabled={aiBusy} onClick={() => void generateStepsFromAi('optimize')}>
                  {aiBusy ? 'Sending to AI...' : 'Send to AI + Ingest'}
                </button>
              </section>

              <section className="build-wizard-ai-tool-card">
                <h4>Place Lost Steps on Timeline</h4>
                <p>
                  Attempts an AI pass to place Project Desk steps into timeline phases, then applies local fallback rules for any remaining lost steps.
                </p>
                <button
                  className="btn btn-outline-primary"
                  onClick={() => void onAutoAssignDeskStepsToTimeline()}
                  disabled={deskAutoAssignBusy || aiBusy}
                  title="AI-assisted placement of Project Desk steps into timeline phases"
                >
                  {(deskAutoAssignBusy || aiBusy) ? 'Placing Lost Steps...' : 'Place Lost Steps on Timeline'}
                </button>
              </section>

              <section className="build-wizard-ai-tool-card build-wizard-ai-tool-card-readout">
                <h4>AI Package Readout</h4>
                <p>Use this panel to inspect what is being sent to AI.</p>
                <label>
                  Prompt Text
                  <textarea value={aiPromptText || ''} readOnly rows={6} />
                </label>
                <label>
                  Payload JSON
                  <textarea value={aiPayloadJson || ''} readOnly rows={10} />
                </label>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {stepInfoModalStep ? (
        <div className="build-wizard-doc-manager" onClick={() => setStepInfoModalStepId(0)}>
          <div className="build-wizard-doc-manager-inner build-wizard-step-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="build-wizard-doc-manager-head">
              <h3>Step #{activeTabStepNumbers.get(stepInfoModalStep.id) || stepInfoModalStep.step_order} Information</h3>
              <div className="build-wizard-doc-manager-actions">
                <StandardIconButton
                  iconKey="close"
                  ariaLabel="Close step information"
                  title="Close"
                  className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
                  onClick={() => setStepInfoModalStepId(0)}
                />
              </div>
            </div>

            <div className="build-wizard-step-info-grid">
              <div className="build-wizard-step-info-card">
                <h4>Timestamps</h4>
                <div><strong>Created:</strong> {formatDate(stepInfoModalStep.created_at)}</div>
                <div><strong>Updated:</strong> {formatDate(stepInfoModalStep.updated_at)}</div>
                <div><strong>Completed:</strong> {formatDate(stepInfoModalStep.completed_at)}</div>
              </div>

              <div className="build-wizard-step-info-card">
                <h4>Record History</h4>
                {Array.isArray(stepInfoModalStep.audit_logs) && stepInfoModalStep.audit_logs.length > 0 ? (
                  <div className="build-wizard-step-history-list">
                    {stepInfoModalStep.audit_logs.map((log) => {
                      const changeEntries = log.changes && typeof log.changes === 'object'
                        ? Object.entries(log.changes as Record<string, unknown>)
                        : [];
                      return (
                        <div className="build-wizard-step-history-item" key={`step-log-${log.id}`}>
                          <div className="build-wizard-step-history-head">
                            <span>{String(log.action_key || 'updated').replace(/_/g, ' ')}</span>
                            <span>{formatDate(log.created_at)}</span>
                          </div>
                          {changeEntries.length > 0 ? (
                            <div className="build-wizard-step-history-changes">
                              {changeEntries.map(([field, value]) => {
                                const change = value as { before?: unknown; after?: unknown };
                                const hasBeforeAfter = change && typeof change === 'object'
                                  && Object.prototype.hasOwnProperty.call(change, 'before')
                                  && Object.prototype.hasOwnProperty.call(change, 'after');
                                return (
                                  <div key={`step-log-${log.id}-${field}`}>
                                    <strong>{field}</strong>: {hasBeforeAfter
                                      ? `${formatAuditValue(change.before, field)} -> ${formatAuditValue(change.after, field)}`
                                      : formatAuditValue(value, field)}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="build-wizard-muted">No field-level delta recorded.</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="build-wizard-muted">No record history yet.</div>
                )}
              </div>

              <div className="build-wizard-step-info-card">
                <h4>Step Notes</h4>
                {stepInfoModalStep.notes.length > 0 ? (
                  <div className="build-wizard-step-history-list">
                    {stepInfoModalStep.notes.map((note) => (
                      <div className="build-wizard-step-history-item" key={`step-note-modal-${note.id}`}>
                        <div className="build-wizard-step-history-head">
                          <span>Note #{note.id}</span>
                          <span>
                            Created {formatDate(note.created_at)}
                            {noteEditedAtLabel(note) ? ` | Edited ${noteEditedAtLabel(note)}` : ''}
                          </span>
                        </div>
                        <div>{note.note_text}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="build-wizard-muted">No notes recorded.</div>
                )}
              </div>

              <div className="build-wizard-step-info-card">
                <h4>Backend Snapshot</h4>
                <pre className="build-wizard-step-info-json">
                  {JSON.stringify(stepInfoModalStep, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {lightboxDoc ? (
        <div className="build-wizard-lightbox" onClick={closeLightbox}>
          <div className="build-wizard-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <div className="build-wizard-lightbox-actions">
              {lightboxSupportsZoom ? (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm build-wizard-lightbox-zoom-btn"
                    onClick={() => zoomLightboxBy(-LIGHTBOX_ZOOM_STEP)}
                    title="Zoom out"
                    aria-label="Zoom out"
                    disabled={lightboxZoom <= LIGHTBOX_ZOOM_MIN}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm build-wizard-lightbox-zoom-btn"
                    onClick={resetLightboxZoom}
                    title="Reset zoom"
                    aria-label="Reset zoom"
                  >
                    {Math.round(lightboxZoom * 100)}%
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm build-wizard-lightbox-zoom-btn"
                    onClick={() => zoomLightboxBy(LIGHTBOX_ZOOM_STEP)}
                    title="Zoom in"
                    aria-label="Zoom in"
                    disabled={lightboxZoom >= LIGHTBOX_ZOOM_MAX}
                  >
                    +
                  </button>
                </>
              ) : null}
              <StandardIconLink
                iconKey="download"
                ariaLabel="Download"
                title="Download"
                href={withDownloadFlag(lightboxDoc.src)}
                className="btn btn-outline-secondary btn-sm catn8-action-icon-btn build-wizard-lightbox-download"
              />
              <StandardIconButton
                iconKey="close"
                ariaLabel="Close preview"
                title="Close"
                className="btn btn-outline-secondary btn-sm catn8-action-icon-btn build-wizard-lightbox-close"
                onClick={closeLightbox}
              />
            </div>
            <div className={`build-wizard-lightbox-zoom-frame ${lightboxSupportsZoom ? 'is-zoomable' : ''}`} onWheel={onLightboxWheelZoom}>
              <div className="build-wizard-lightbox-zoom-content" style={lightboxSupportsZoom ? { transform: `scale(${lightboxZoom})` } : undefined}>
                {lightboxDoc.mode === 'image' ? (
                  <WebpImage src={lightboxDoc.src} alt={lightboxDoc.title} className="build-wizard-lightbox-image" />
                ) : null}
                {lightboxDoc.mode === 'loading' ? (
                  <div className="build-wizard-lightbox-message">Loading preview...</div>
                ) : null}
                {lightboxDoc.mode === 'error' ? (
                  <div className="build-wizard-lightbox-message">
                    <div>{lightboxDoc.message}</div>
                    <div>
                      <a href={lightboxDoc.src} target="_blank" rel="noreferrer">Open original file</a>
                    </div>
                  </div>
                ) : null}
                {lightboxDoc.mode === 'embed' ? (
                  <div className="build-wizard-lightbox-embed-wrap">
                    <iframe
                      src={lightboxDoc.src}
                      title={lightboxDoc.title}
                      className="build-wizard-lightbox-embed"
                    />
                  </div>
                ) : null}
                {lightboxDoc.mode === 'plan' ? (
                  <div className="build-wizard-lightbox-plan-wrap">
                    <pre className="build-wizard-lightbox-plan">{lightboxDoc.text}</pre>
                    <div className="build-wizard-lightbox-note">
                      {lightboxDoc.format === 'hex' ? 'Binary .plan preview (hex + ASCII).' : 'Text preview.'}
                      {lightboxDoc.truncated ? ' Preview truncated for performance.' : ''}
                    </div>
                  </div>
                ) : null}
                {lightboxDoc.mode === 'text' ? (
                  <div className="build-wizard-lightbox-text-wrap">
                    {lightboxDoc.taskPreview ? (
                      <div className="build-wizard-lightbox-task-preview">
                        {lightboxDoc.taskPreview.summaryFields.length ? (
                          <section>
                            <h4>Task Summary</h4>
                            <dl className="build-wizard-lightbox-task-fields">
                              {lightboxDoc.taskPreview.summaryFields.map((field) => (
                                <React.Fragment key={`summary-${field.label}`}>
                                  <dt>{field.label}</dt>
                                  <dd>{field.value}</dd>
                                </React.Fragment>
                              ))}
                            </dl>
                          </section>
                        ) : null}
                        {lightboxDoc.taskPreview.noteLines.length ? (
                          <section>
                            <h4>Notes</h4>
                            <div className="build-wizard-lightbox-task-notes">
                              {lightboxDoc.taskPreview.noteLines.map((line, idx) => (
                                <p key={`note-${idx}`}>{line}</p>
                              ))}
                            </div>
                          </section>
                        ) : null}
                        {lightboxDoc.taskPreview.metaFields.length ? (
                          <section>
                            <h4>Task Metadata</h4>
                            <dl className="build-wizard-lightbox-task-fields">
                              {lightboxDoc.taskPreview.metaFields.map((field) => (
                                <React.Fragment key={`meta-${field.label}`}>
                                  <dt>{field.label}</dt>
                                  <dd>{field.value}</dd>
                                </React.Fragment>
                              ))}
                            </dl>
                          </section>
                        ) : null}
                        {lightboxDoc.taskPreview.systemLines.length ? (
                          <section>
                            <h4>Source</h4>
                            <ul className="build-wizard-lightbox-task-system">
                              {lightboxDoc.taskPreview.systemLines.map((line, idx) => (
                                <li key={`source-${idx}`}>{line}</li>
                              ))}
                            </ul>
                          </section>
                        ) : null}
                      </div>
                    ) : null}
                    <details className="build-wizard-lightbox-text-raw">
                      <summary>Raw document text</summary>
                      <pre className="build-wizard-lightbox-plan">{lightboxDoc.text}</pre>
                    </details>
                    {lightboxDoc.truncated ? (
                      <div className="build-wizard-lightbox-note">Text preview truncated for performance.</div>
                    ) : null}
                  </div>
                ) : null}
                {lightboxDoc.mode === 'spreadsheet' ? (
                  <div className="build-wizard-lightbox-sheet-wrap">
                    <div className="build-wizard-lightbox-sheet-tabs" role="tablist" aria-label="Spreadsheet sheets">
                      {lightboxDoc.sheets.map((sheet, idx) => (
                        <button
                          key={sheet.name}
                          type="button"
                          className={`build-wizard-lightbox-sheet-tab ${lightboxSpreadsheetSheetIndex === idx ? 'is-active' : ''}`}
                          onClick={() => setLightboxSpreadsheetSheetIndex(idx)}
                        >
                          {sheet.name}
                        </button>
                      ))}
                    </div>
                    <div className="build-wizard-lightbox-sheet-table-wrap">
                      <table className="build-wizard-lightbox-sheet-table">
                        <tbody>
                          {(lightboxDoc.sheets[lightboxSpreadsheetSheetIndex]?.rows || []).map((row, rowIndex) => (
                            <tr key={`${lightboxSpreadsheetSheetIndex}-${rowIndex}`}>
                              {row.map((cell, cellIndex) => (
                                <td key={`${lightboxSpreadsheetSheetIndex}-${rowIndex}-${cellIndex}`}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {lightboxDoc.truncated ? <div className="build-wizard-lightbox-note">Preview is limited to 120 rows and 24 columns per sheet.</div> : null}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="build-wizard-lightbox-title">{lightboxDoc.title}</div>
          </div>
        </div>
      ) : null}

      {confirmState ? (
        <div className="build-wizard-doc-manager" onClick={() => closeConfirmation(false)}>
          <div className="build-wizard-doc-manager-inner build-wizard-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="build-wizard-doc-manager-head">
              <h3>{confirmState.title}</h3>
              <div className="build-wizard-doc-manager-actions">
                <StandardIconButton
                  iconKey="close"
                  ariaLabel="Close confirmation dialog"
                  title="Close"
                  className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
                  onClick={() => closeConfirmation(false)}
                />
              </div>
            </div>
            <p className="build-wizard-confirm-message">{confirmState.message}</p>
            <div className="build-wizard-confirm-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={() => closeConfirmation(false)}>
                {confirmState.cancelLabel}
              </button>
              <button type="button" className={confirmState.confirmButtonClass} onClick={() => closeConfirmation(true)}>
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {moveStepModalStep ? (
        <div className="build-wizard-doc-manager" onClick={() => !movingStep && setMoveStepModalStepId(0)}>
          <div className="build-wizard-doc-manager-inner build-wizard-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="build-wizard-doc-manager-head">
              <h3>Move Step</h3>
              <div className="build-wizard-doc-manager-actions">
                <StandardIconButton
                  iconKey="close"
                  ariaLabel="Close move step dialog"
                  title="Close"
                  className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
                  onClick={() => {
                    if (!movingStep) {
                      setMoveStepModalStepId(0);
                    }
                  }}
                />
              </div>
            </div>
            <p className="build-wizard-confirm-message">
              {`Where do you want to move "#${activeTabStepNumbers.get(moveStepModalStep.id) || moveStepModalStep.step_order} ${moveStepModalStep.title}"?`}
            </p>
            <label className="build-wizard-move-modal-field">
              Target phase
              <select
                value={moveStepModalTargetTab}
                onChange={(e) => setMoveStepModalTargetTab(e.target.value as BuildTabId)}
                disabled={movingStep}
              >
                {moveStepPhaseTabOptions.map((option) => (
                  <option key={`move-modal-phase-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="build-wizard-confirm-actions">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setMoveStepModalStepId(0)}
                disabled={movingStep}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void onMoveStepFromModal()}
                disabled={movingStep}
              >
                {movingStep ? 'Moving...' : 'Move Step'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {recoveryReportOpen ? (
        <div className="build-wizard-doc-manager" onClick={() => setRecoveryReportOpen(false)}>
          <div className="build-wizard-doc-manager-inner build-wizard-recovery-modal" onClick={(e) => e.stopPropagation()}>
            <div className="build-wizard-doc-manager-head">
              <h3>Singletree Recovery Report</h3>
              <div className="build-wizard-doc-manager-actions">
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={async () => {
                    if (!recoveryJobId || recoveryPolling) {
                      return;
                    }
                    setRecoveryPolling(true);
                    try {
                      const status = await fetchSingletreeRecoveryStatus(recoveryJobId);
                      if (status) {
                        setRecoveryStatus(String(status.status || ''));
                        setRecoveryReportJson(JSON.stringify(status, null, 2));
                        if (Number(status.completed || 0) === 1 || status.status === 'completed' || status.status === 'failed') {
                          setRecoveryJobId('');
                        }
                      }
                    } finally {
                      setRecoveryPolling(false);
                    }
                  }}
                  disabled={!recoveryJobId || recoveryPolling}
                >
                  {recoveryPolling ? 'Checking...' : 'Refresh Status'}
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(recoveryReportJson || '');
                      onToast?.({ tone: 'success', message: 'Recovery report copied.' });
                    } catch (_) {
                      onToast?.({ tone: 'warning', message: 'Could not copy to clipboard.' });
                    }
                  }}
                  disabled={!recoveryReportJson}
                >
                  Copy JSON
                </button>
                <StandardIconButton
                  iconKey="close"
                  ariaLabel="Close recovery report"
                  title="Close"
                  className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
                  onClick={() => setRecoveryReportOpen(false)}
                />
              </div>
            </div>
            {recoveryStagedRoot ? (
              <div className="build-wizard-recovery-status">
                Staged Files: {recoveryStagedCount} | Source Root: {recoveryStagedRoot}
              </div>
            ) : (
              <div className="build-wizard-recovery-status">
                No staged files yet. Upload source files from your Mac, then run Dry Run/Apply.
              </div>
            )}
            {recoveryStatus ? (
              <div className="build-wizard-recovery-status">
                Status: {recoveryStatus}{recoveryJobId ? ` (job ${recoveryJobId})` : ''}
              </div>
            ) : null}
            {recoveryReportJson ? (
              <pre className="build-wizard-recovery-json">{recoveryReportJson}</pre>
            ) : (
              <div className="build-wizard-muted">No recovery report yet. Run Dry Run or Apply first.</div>
            )}
          </div>
        </div>
      ) : null}

    </div>
  );

  if (view === 'launcher') {
    return renderLauncher();
  }
  if (view === 'template_editor') {
    return renderTemplateEditor();
  }
  return renderBuildWorkspace();
}
