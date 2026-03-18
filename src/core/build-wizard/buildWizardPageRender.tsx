import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';
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
import {
  BuildWizardConfirmState,
  BuildWizardContactType,
  BuildWizardSearchResult,
  BuildWizardTaskMeta,
  BuildWizardTaskType,
  InlineReceiptField,
  LightboxPreview,
  PhaseDateRange,
  ProjectOverviewPhaseSection,
  ProjectOverviewStepRow,
  SpreadsheetPreviewSheet,
  TaskDocumentField,
  TaskDocumentPreview,
  contactTypeChipClass,
  contactTypeLabel,
  normalizeContactType,
} from './buildWizardPageRenderTypes';
import {
  BUILD_WIZARD_TASK_META_PREFIX,
  composeReceiptNotesWithTaskMeta,
  defaultTaskMeta,
  getTaskEffectiveDate,
  isLegacyAutoStampedTaskDate,
  parseTaskDocumentPreview as parseTaskDocumentPreviewBase,
  parseTaskMetaFromReceiptNotes as parseTaskMetaFromReceiptNotesBase,
  setTaskDateOverrideInReceiptNotes as setTaskDateOverrideInReceiptNotesBase,
  taskUsesManualDateOverride,
} from './buildWizardTaskMetaUtils';
import { buildSearchText, buildStepCostVerificationSignature, isTextLikeMime } from './buildWizardSearchCostUtils';
import {
  BuildWizardDocumentGallery,
  BuildWizardLauncher,
  BuildWizardProjectPhotosSection,
  BuildWizardTemplateEditor,
} from './buildWizardRenderSections';
import { BuildWizardStepActionPanel } from './buildWizardStepActionPanel';
import { BuildWizardStepAssignees } from './buildWizardStepAssignees';
import { BuildWizardEditableStepCards } from './buildWizardEditableStepCards';
import { BuildWizardStepNotes } from './buildWizardStepNotes';
import { BuildWizardStepReceiptEditor } from './buildWizardStepReceiptEditor';
import { BuildWizardStepReceiptsList } from './buildWizardStepReceiptsList';
import { BuildWizardWorkspaceMain } from './buildWizardWorkspaceMain';
import { BuildWizardWorkspaceModals } from './buildWizardWorkspaceModals';
import '../../components/pages/BuildWizardPage.css';

interface BuildWizardPageProps extends AppShellPageProps {
  isAdmin?: boolean;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

const LIGHTBOX_ZOOM_MIN = 0.5;
const LIGHTBOX_ZOOM_MAX = 3;
const LIGHTBOX_ZOOM_STEP = 0.1;
const LIGHTBOX_ZOOM_STEP_FAST = 0.2;
const PROJECT_OVERVIEW_TAB_ORDER: BuildTabId[] = [...PHASE_PROGRESS_ORDER, 'desk'];

const clampLightboxZoom = (value: number): number => {
  return Math.max(LIGHTBOX_ZOOM_MIN, Math.min(LIGHTBOX_ZOOM_MAX, Number(value.toFixed(2))));
};

const LIGHTBOX_TEXT_PREVIEW_MAX_CHARS = 120000;
const TEXT_PREVIEW_EXTENSIONS = new Set(['TXT', 'MD', 'JSON', 'CSV', 'LOG', 'XML', 'YAML', 'YML']);

const TASK_META_FIELD_LABELS: Record<keyof BuildWizardTaskMeta, string> = {
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

const TASK_TYPE_OPTIONS: Array<{ value: BuildWizardTaskType; label: string }> = [
  ...STEP_TYPE_OPTIONS.map((option): { value: BuildWizardTaskType; label: string } => ({
    value: option.value as BuildWizardTaskType,
    label: option.label,
  })),
  { value: 'quote', label: 'Quote' },
];
TASK_TYPE_OPTIONS.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
const allowedTaskTypes = TASK_TYPE_OPTIONS.map((option) => option.value);
const parseTaskMetaFromReceiptNotes = (notes: string | null | undefined) => parseTaskMetaFromReceiptNotesBase(notes, allowedTaskTypes);
const setTaskDateOverrideInReceiptNotes = (notes: string | null | undefined, taskDate: string | null | undefined) => setTaskDateOverrideInReceiptNotesBase(notes, taskDate, allowedTaskTypes);
const parseTaskDocumentPreview = (text: string): TaskDocumentPreview | null => parseTaskDocumentPreviewBase(text, TASK_META_FIELD_LABELS);

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
  const [stepEditModalStepId, setStepEditModalStepId] = React.useState<number>(0);
  const [stepEditSaving, setStepEditSaving] = React.useState<boolean>(false);
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
  const [moveTaskModalDocId, setMoveTaskModalDocId] = React.useState<number>(0);
  const [moveTaskModalTargetStepId, setMoveTaskModalTargetStepId] = React.useState<number>(0);
  const [taskAttachmentsModalDocId, setTaskAttachmentsModalDocId] = React.useState<number>(0);
  const [stepContactPickerOpenByStepId, setStepContactPickerOpenByStepId] = React.useState<Record<number, boolean>>({});
  const [stepContactCandidateByStepId, setStepContactCandidateByStepId] = React.useState<Record<number, string>>({});
  const [currencyInputByKey, setCurrencyInputByKey] = React.useState<Record<string, string>>({});
  const [activeCurrencyInputKey, setActiveCurrencyInputKey] = React.useState<string>('');
  const [verifiedActualCostSignatureByStepId, setVerifiedActualCostSignatureByStepId] = React.useState<Record<number, string>>({});
  const [refreshingActualCostByStepId, setRefreshingActualCostByStepId] = React.useState<Record<number, boolean>>({});
  const recoveryUploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const replaceFileInputByDocId = React.useRef<Record<number, HTMLInputElement | null>>({});
  const receiptEditorRefByStepId = React.useRef<Record<number, HTMLDivElement | null>>({});
  const receiptRowRefByDocId = React.useRef<Record<number, HTMLDivElement | null>>({});
  const clearedLegacyTaskDatesByProjectRef = React.useRef<Set<number>>(new Set());
  const stickyHeadRef = React.useRef<HTMLDivElement | null>(null);
  const phaseTaskListCardRef = React.useRef<HTMLDivElement | null>(null);
  const topbarSearchBoxRef = React.useRef<HTMLDivElement | null>(null);
  const previousActiveTabRef = React.useRef<BuildTabId>('start');
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
    setVerifiedActualCostSignatureByStepId({});
    setRefreshingActualCostByStepId({});
  }, [projectId]);

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
    const previousActiveTab = previousActiveTabRef.current;
    previousActiveTabRef.current = activeTab;
    if (previousActiveTab === activeTab || !PHASE_PROGRESS_ORDER.includes(activeTab)) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    const node = phaseTaskListCardRef.current;
    if (!node) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      const nextTop = window.scrollY + node.getBoundingClientRect().top - stickyTopOffset - stickyHeadHeight - 12;
      window.scrollTo({
        top: Math.max(0, nextTop),
        behavior: 'smooth',
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab, stickyHeadHeight, stickyTopOffset]);

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
    if (moveTaskModalDocId > 0 && !validDocumentIds.has(moveTaskModalDocId)) {
      setMoveTaskModalDocId(0);
      setMoveTaskModalTargetStepId(0);
    }
    if (taskAttachmentsModalDocId > 0 && !validDocumentIds.has(taskAttachmentsModalDocId)) {
      setTaskAttachmentsModalDocId(0);
    }
  }, [documents, moveTaskModalDocId, taskAttachmentsModalDocId]);

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

  const stepEditModalStep = React.useMemo(() => {
    if (stepEditModalStepId <= 0) {
      return null;
    }
    return stepByIdMap.get(stepEditModalStepId) || null;
  }, [stepEditModalStepId, stepByIdMap]);

  const moveStepModalStep = React.useMemo(() => {
    if (moveStepModalStepId <= 0) {
      return null;
    }
    return stepByIdMap.get(moveStepModalStepId) || null;
  }, [moveStepModalStepId, stepByIdMap]);

  const stepEditModalDraft = React.useMemo(() => {
    if (!stepEditModalStep) {
      return null;
    }
    return stepDrafts[stepEditModalStep.id] || stepEditModalStep;
  }, [stepDrafts, stepEditModalStep]);

  const stepEditModalDependencyIds = React.useMemo(() => {
    if (!stepEditModalStep || !stepEditModalDraft) {
      return [] as number[];
    }
    return Array.from(
      new Set(
        (Array.isArray(stepEditModalDraft.depends_on_step_ids) ? stepEditModalDraft.depends_on_step_ids : [])
          .map((rawId) => Number(rawId || 0))
          .filter((id) => id > 0 && id !== stepEditModalStep.id),
      ),
    );
  }, [stepEditModalDraft, stepEditModalStep]);

  const stepEditModalDependencyOptions = React.useMemo(() => {
    if (!stepEditModalStep) {
      return [] as IBuildWizardStep[];
    }
    return steps
      .filter((candidate) => candidate.id !== stepEditModalStep.id && !stepEditModalDependencyIds.includes(candidate.id))
      .sort((a, b) => {
        if (a.step_order !== b.step_order) {
          return a.step_order - b.step_order;
        }
        return a.id - b.id;
      });
  }, [stepEditModalDependencyIds, stepEditModalStep, steps]);

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
        message: `Phase date range cannot exclude step "${outOfRangeStep.title}". Update that step's date range first.`,
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

    const nextStepBase = steps
      .filter((s) => Number(s.is_completed) !== 1)
      .map((s) => ({ step: s, start: parseDate(s.expected_start_date), end: parseDate(s.expected_end_date) }))
      .filter((r) => r.start || r.end)
      .sort((a, b) => {
        const aStart = (a.start || a.end)!.getTime();
        const bStart = (b.start || b.end)!.getTime();
        return aStart - bStart;
      })[0] || null;
    const nextStep = nextStepBase
      ? (() => {
          const phaseTabId = stepPhaseBucket(nextStepBase.step);
          const phaseLabel = BUILD_TABS.find((tab) => tab.id === phaseTabId)?.label || tabLabelShort(phaseTabId);
          const phaseStepNumber = steps
            .filter((step) => stepPhaseBucket(step) === phaseTabId)
            .sort((a, b) => Number(a.step_order) - Number(b.step_order))
            .findIndex((step) => step.id === nextStepBase.step.id) + 1;
          return {
            ...nextStepBase,
            phaseLabel,
            phaseStepNumber: phaseStepNumber > 0 ? phaseStepNumber : null,
          };
        })()
      : null;

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
  }, [getStepActualExcludingQuotes, getStepEstimatedExcludingQuotes, project?.target_completion_date, project?.target_start_date, stepPhaseBucket, steps]);

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
    const tabOrder = new Map<BuildTabId, number>();
    PROJECT_OVERVIEW_TAB_ORDER.forEach((tabId, index) => {
      tabOrder.set(tabId, index);
    });

    const stepsByTab = new Map<BuildTabId, IBuildWizardStep[]>();
    steps.forEach((step) => {
      const tabId = stepPhaseBucket(step);
      const bucket = stepsByTab.get(tabId) || [];
      bucket.push(step);
      stepsByTab.set(tabId, bucket);
    });

    const options: Array<{ step: IBuildWizardStep; displayNumber: number; sortKey: string; label: string }> = [];
    Array.from(stepsByTab.entries())
      .sort((a, b) => {
        const aOrder = tabOrder.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = tabOrder.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        return sortAlpha(tabLabelShort(a[0]), tabLabelShort(b[0]));
      })
      .forEach(([tabId, tabSteps]) => {
        const ordered = [...tabSteps].sort((a, b) => {
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

        const tabLabel = BUILD_TABS.find((candidate) => candidate.id === tabId)?.label || prettyPhaseLabel(TAB_DEFAULT_PHASE_KEY[tabId] || tabId);
        const phaseNumberMatch = tabLabel.match(/^(\d+)\./);
        const phasePrefix = phaseNumberMatch
          ? `Phase ${phaseNumberMatch[1]}`
          : (tabId === 'desk' ? 'Project Desk' : tabLabel);

        ordered.forEach((step, index) => {
          options.push({
            step,
            displayNumber: index + 1,
            sortKey: `${String(tabOrder.get(tabId) ?? Number.MAX_SAFE_INTEGER).padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`,
            label: `${phasePrefix}, Step ${index + 1}: ${String(step.title || '').trim()}`.trim(),
          });
        });
      });

    return options;
  }, [stepPhaseBucket, steps]);

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

  const moveTaskModalDoc = React.useMemo(() => {
    if (moveTaskModalDocId <= 0) {
      return null;
    }
    const doc = documents.find((candidate) => candidate.id === moveTaskModalDocId) || null;
    return doc && String(doc.kind || '').trim() === 'receipt' ? doc : null;
  }, [documents, moveTaskModalDocId]);

  const taskAttachmentsModalDoc = React.useMemo(() => {
    if (taskAttachmentsModalDocId <= 0) {
      return null;
    }
    const doc = documents.find((candidate) => candidate.id === taskAttachmentsModalDocId) || null;
    return doc && String(doc.kind || '').trim() === 'receipt' ? doc : null;
  }, [documents, taskAttachmentsModalDocId]);

  const moveTaskStepOptions = React.useMemo(() => {
    if (!moveTaskModalDoc) {
      return [] as Array<{ step: IBuildWizardStep; displayNumber: number; sortKey: string; label: string }>;
    }
    return linkedStepOptions.filter((option) => option.step.id !== Number(moveTaskModalDoc.step_id || 0));
  }, [linkedStepOptions, moveTaskModalDoc]);

  const taskAttachmentsModalStep = React.useMemo(() => {
    if (!taskAttachmentsModalDoc) {
      return null;
    }
    return stepByIdMap.get(Number(taskAttachmentsModalDoc.step_id || 0)) || null;
  }, [stepByIdMap, taskAttachmentsModalDoc]);

  const taskAttachmentsModalAttachableDocuments = React.useMemo(() => {
    if (!taskAttachmentsModalDoc) {
      return [] as IBuildWizardDocument[];
    }
    const receiptId = taskAttachmentsModalDoc.id;
    const receiptFilter = String(attachExistingDocFilterByReceiptId[receiptId] || '').trim().toLowerCase();
    return attachableProjectDocuments
      .filter((candidate) => {
        if (candidate.id === receiptId) {
          return false;
        }
        if (String(candidate.kind || '').trim() === 'receipt') {
          return false;
        }
        const isAlreadyAttached = String(candidate.kind || '').trim() === 'receipt_attachment'
          && Number(candidate.receipt_parent_document_id || 0) === receiptId;
        if (isAlreadyAttached) {
          return false;
        }
        if (!receiptFilter) {
          return true;
        }
        const haystack = `${candidate.original_name} ${buildWizardTokenLabel(candidate.kind, 'Other')}`.toLowerCase();
        return haystack.includes(receiptFilter);
      })
      .sort((a, b) => sortAlpha(String(a.original_name || ''), String(b.original_name || '')));
  }, [attachExistingDocFilterByReceiptId, attachableProjectDocuments, taskAttachmentsModalDoc]);

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
        receipt_date: taskUsesManualDateOverride(doc, parseTaskMetaFromReceiptNotes(doc.receipt_notes || '').taskMeta) ? (doc.receipt_date || '') : '',
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

  React.useEffect(() => {
    if (stepEditModalStepId <= 0) {
      return;
    }
    if (!stepById.has(stepEditModalStepId)) {
      setStepEditModalStepId(0);
    }
  }, [stepById, stepEditModalStepId]);

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

  const clearStepDraft = React.useCallback((stepId: number) => {
    setStepDrafts((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, stepId)) {
        return prev;
      }
      const next = { ...prev };
      delete next[stepId];
      return next;
    });
  }, []);

  const openStepEditModal = React.useCallback((step: IBuildWizardStep) => {
    setStepDrafts((prev) => ({
      ...prev,
      [step.id]: { ...step },
    }));
    setStepEditModalStepId(step.id);
  }, []);

  const closeStepEditModal = React.useCallback(() => {
    if (stepEditModalStepId > 0) {
      clearStepDraft(stepEditModalStepId);
    }
    setStepEditModalStepId(0);
  }, [clearStepDraft, stepEditModalStepId]);

  const commitStep = async (stepId: number, patch: Partial<IBuildWizardStep>) => {
    await updateStep(stepId, patch);
  };

  const clearCurrencyEdit = (key: string): void => {
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

  const markStepActualCostVerified = (stepId: number, signature: string) => {
    setVerifiedActualCostSignatureByStepId((prev) => ({ ...prev, [stepId]: signature }));
  };

  const onRefreshStepActualCost = async (
    step: IBuildWizardStep,
    signature: string,
    nextActualCost: number | null,
  ) => {
    const stepId = step.id;
    if (stepId <= 0) {
      return;
    }
    setRefreshingActualCostByStepId((prev) => ({ ...prev, [stepId]: true }));
    try {
      const nextStep = await updateStep(stepId, { actual_cost: nextActualCost });
      if (!nextStep) {
        return;
      }
      updateStepDraft(stepId, { actual_cost: nextActualCost });
      clearCurrencyEdit(`step-${stepId}-actual_cost`);
      markStepActualCostVerified(stepId, signature);
      onToast?.({ tone: 'success', message: 'Actual cost refreshed from task totals.' });
    } finally {
      setRefreshingActualCostByStepId((prev) => {
        const next = { ...prev };
        delete next[stepId];
        return next;
      });
    }
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

  const focusStepInBuildView = React.useCallback((phaseId: BuildTabId, stepId: number) => {
    if (stepId <= 0) {
      return;
    }
    setActiveTab(phaseId);
    setExpandedStepById((prev) => ({ ...prev, [stepId]: true }));
    setTopbarSearchFocusStepId(0);
    window.setTimeout(() => setTopbarSearchFocusStepId(stepId), 0);
  }, []);

  const selectTopbarSearchResult = React.useCallback((result: BuildWizardSearchResult) => {
    setTopbarSearchOpen(false);

    if (result.kind === 'phase') {
      setActiveTab(result.phaseId);
      return;
    }

    if (result.kind === 'step') {
      focusStepInBuildView(result.phaseId, result.stepId);
      return;
    }

    if (result.linkedPhaseId) {
      setActiveTab(result.linkedPhaseId);
    }
    if (result.linkedStepId > 0) {
      focusStepInBuildView(result.linkedPhaseId || activeTab, result.linkedStepId);
      return;
    }
    void openDocumentPreview(result.document);
  }, [activeTab, focusStepInBuildView, openDocumentPreview]);

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
    setDocumentSavingId(documentId);
    try {
      const savedDocument = await updateDocument(documentId, patch);
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
        date: taskUsesManualDateOverride(doc, parsed.taskMeta) ? (doc.receipt_date || '') : '',
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
      patch.receipt_notes = toStringOrNull(composeReceiptNotesWithTaskMeta({
        ...draft.taskMeta,
        manual_date_override: Boolean(toStringOrNull(draft.date)),
      }, draft.plainNotes));
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
      receipt_date: taskUsesManualDateOverride(doc, parseTaskMetaFromReceiptNotes(doc.receipt_notes || '').taskMeta) ? (doc.receipt_date || '') : '',
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
      receipt_notes: draft.kind === 'receipt'
        ? toStringOrNull(setTaskDateOverrideInReceiptNotes(draft.receipt_notes, draft.receipt_date))
        : null,
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
        receipt_notes: toStringOrNull(composeReceiptNotesWithTaskMeta({
          ...draft.task_meta,
          manual_date_override: Boolean(toStringOrNull(draft.receipt_date)),
        }, draft.receipt_notes)),
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
        receipt_notes: toStringOrNull(composeReceiptNotesWithTaskMeta({
          ...draft.task_meta,
          manual_date_override: Boolean(toStringOrNull(draft.receipt_date)),
        }, draft.receipt_notes)),
        caption: toStringOrNull(draft.receipt_title || step.title),
      });
      if (!created?.id) {
        return;
      }
      receiptId = created.id;
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

  const autosaveExistingReceiptDraftForStep = async (
    step: IBuildWizardStep,
    patch: {
      receipt_date?: string | null;
      receipt_notes?: string | null;
    },
  ) => {
    const editingReceiptDocumentId = Number(editingReceiptDocumentIdByStep[step.id] || 0);
    if (editingReceiptDocumentId <= 0) {
      return;
    }
    await onSaveDocument(editingReceiptDocumentId, patch);
  };

  const onStartEditReceiptForStep = (step: IBuildWizardStep, doc: IBuildWizardDocument) => {
    const parsed = parseTaskMetaFromReceiptNotes(doc.receipt_notes || '');
    setEditingReceiptDocumentIdByStep((prev) => ({ ...prev, [step.id]: doc.id }));
    setReceiptDraftByStep((prev) => ({ ...prev, [step.id]: {
      receipt_title: doc.receipt_title || '',
      receipt_vendor: doc.receipt_vendor || '',
      receipt_date: taskUsesManualDateOverride(doc, parsed.taskMeta) ? (doc.receipt_date || '') : '',
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

  const openMoveTaskModal = (receiptDoc: IBuildWizardDocument) => {
    setMoveTaskModalDocId(receiptDoc.id);
    setMoveTaskModalTargetStepId(0);
  };

  const openTaskAttachmentsModal = (receiptDoc: IBuildWizardDocument) => {
    setTaskAttachmentsModalDocId(receiptDoc.id);
    setAttachExistingDocByReceiptId((prev) => ({ ...prev, [receiptDoc.id]: '' }));
    setAttachExistingDocFilterByReceiptId((prev) => ({ ...prev, [receiptDoc.id]: '' }));
  };

  const onMoveReceiptToStep = async () => {
    if (!moveTaskModalDoc) {
      return;
    }
    const currentStepId = Number(moveTaskModalDoc.step_id || 0);
    const targetStepId = Number(moveTaskModalTargetStepId || 0);
    if (targetStepId <= 0 || targetStepId === currentStepId) {
      return;
    }
    const targetStep = stepByIdMap.get(targetStepId) || null;
    if (!targetStep) {
      onToast?.({ tone: 'warning', message: 'That destination step is no longer available. Refresh and try again.' });
      return;
    }
    const movedDocument = await onSaveDocument(moveTaskModalDoc.id, { step_id: targetStepId });
    if (!movedDocument) {
      return;
    }
    setMoveTaskModalDocId(0);
    setMoveTaskModalTargetStepId(0);
    setPendingScrollReceiptId(moveTaskModalDoc.id);
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

  const saveStepEditModal = React.useCallback(async () => {
    if (!stepEditModalStep || stepEditSaving) {
      return;
    }

    const step = stepEditModalStep;
    const draft = stepDrafts[step.id] || step;
    const nextTitle = String(draft.title || '').trim();
    if (!nextTitle) {
      onToast?.({ tone: 'warning', message: 'Step title is required.' });
      return;
    }

    const nextStartDate = toStringOrNull(draft.expected_start_date || '');
    const requestedEndDate = toStringOrNull(draft.expected_end_date || '');
    const nextEndDate = nextStartDate && requestedEndDate && requestedEndDate < nextStartDate
      ? nextStartDate
      : requestedEndDate;
    const nextDurationDays = calculateDurationDays(nextStartDate, nextEndDate) ?? (draft.expected_duration_days ?? null);
    const nextDependencyIds = Array.from(
      new Set(
        (Array.isArray(draft.depends_on_step_ids) ? draft.depends_on_step_ids : [])
          .map((rawId) => Number(rawId || 0))
          .filter((id) => id > 0 && id !== step.id),
      ),
    );
    const actualCostFloor = documents.reduce((sum, doc) => {
      if (Number(doc.step_id || 0) !== step.id || String(doc.kind || '').trim() !== 'receipt') {
        return sum;
      }
      const parsed = parseTaskMetaFromReceiptNotes(doc.receipt_notes || '');
      if (parsed.taskMeta.task_type === 'quote') {
        return sum;
      }
      return sum + Number(doc.receipt_amount || 0);
    }, 0);
    const requestedActualCost = draft.actual_cost ?? null;
    const nextActualCost = requestedActualCost === null
      ? (actualCostFloor > 0 ? actualCostFloor : null)
      : Math.max(Number(requestedActualCost), actualCostFloor);
    const patch: Partial<IBuildWizardStep> = {
      title: nextTitle,
      description: String(draft.description || '').trim(),
      expected_start_date: nextStartDate,
      expected_end_date: nextEndDate,
      expected_duration_days: nextDurationDays,
      estimated_cost: draft.estimated_cost ?? null,
      actual_cost: nextActualCost,
      depends_on_step_ids: nextDependencyIds,
    };

    setStepEditSaving(true);
    try {
      const nextStep = await updateStep(step.id, patch);
      if (!nextStep) {
        return;
      }
      const timelineOverrides = new Map<number, Pick<IBuildWizardStep, 'expected_start_date' | 'expected_end_date'>>();
      timelineOverrides.set(step.id, {
        expected_start_date: nextStartDate,
        expected_end_date: nextEndDate,
      });
      await autoReorderPhaseByTimeline(step.phase_key, timelineOverrides);
      await expandPhaseRangeForStep(step, timelineOverrides.get(step.id));
      clearStepDraft(step.id);
      setStepEditModalStepId(0);
      onToast?.({ tone: 'success', message: 'Step updated.' });
    } finally {
      setStepEditSaving(false);
    }
  }, [
    autoReorderPhaseByTimeline,
    clearStepDraft,
    documents,
    expandPhaseRangeForStep,
    onToast,
    stepDrafts,
    stepEditModalStep,
    stepEditSaving,
    updateStep,
  ]);

  React.useEffect(() => {
    if (projectId <= 0) {
      return;
    }
    if (clearedLegacyTaskDatesByProjectRef.current.has(projectId)) {
      return;
    }
    const legacyTaskDocs = documents.filter((doc) => {
      const parsed = parseTaskMetaFromReceiptNotes(doc.receipt_notes || '');
      return isLegacyAutoStampedTaskDate(doc, parsed.taskMeta);
    });
    if (legacyTaskDocs.length === 0) {
      clearedLegacyTaskDatesByProjectRef.current.add(projectId);
      return;
    }

    clearedLegacyTaskDatesByProjectRef.current.add(projectId);
    let cancelled = false;

    void (async () => {
      try {
        for (const doc of legacyTaskDocs) {
          if (cancelled) {
            return;
          }
          await ApiClient.post<{ document?: IBuildWizardDocument; documents?: IBuildWizardDocument[] }>(
            '/api/build_wizard.php?action=update_document',
            {
              document_id: doc.id,
              receipt_date: null,
              receipt_notes: setTaskDateOverrideInReceiptNotes(doc.receipt_notes, null),
            },
          );
        }
        if (!cancelled) {
          await openProject(projectId);
          onToast?.({
            tone: 'info',
            message: legacyTaskDocs.length === 1
              ? 'Cleared one legacy task date. Tasks now follow the step date unless you set an override.'
              : `Cleared ${legacyTaskDocs.length} legacy task dates. Tasks now follow the step date unless you set an override.`,
          });
        }
      } catch (error: any) {
        clearedLegacyTaskDatesByProjectRef.current.delete(projectId);
        if (!cancelled) {
          onToast?.({
            tone: 'warning',
            message: error?.message || 'Failed to clear legacy task dates automatically.',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documents, onToast, openProject, projectId]);

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
    return (
      <BuildWizardEditableStepCards
        activeTabTreeRows={activeTabTreeRows}
        cardContext={{
          activeTabStepNumbers,
          attachExistingDocByStepId,
          attachExistingDocFilterByStepId,
          attachExistingPickerOpenByStepId,
          attachableProjectDocuments,
          authorityContacts,
          autosaveExistingReceiptDraftForStep,
          beginStepDrag,
          clearStepDragState,
          contactTypeChipClass,
          contactTypeLabel,
          contacts,
          deleteStep,
          deletingDocumentId,
          deletingNoteId,
          documents,
          dragOverParentStepId,
          draggingStepId,
          editingNoteTextById,
          editingReceiptDocumentIdByStep,
          expandedStepById,
          formatCurrency,
          formatDate,
          getTaskEffectiveDate,
          inlineEditingReceiptFieldByDocId,
          inlineReceiptDraftByDocId,
          incompleteDescendantCountByStepId,
          linkedStepDisplayNumberById,
          normalizeContactType,
          noteDraftByStep,
          noteEditedAtLabel,
          noteEditorOpenByStep,
          onAddContactToStep,
          onAttachExistingDocumentToStep,
          onCancelEditNote,
          onDeleteDocument,
          onDeleteStepNoteById,
          onDropMakeChild,
          onOpenDocumentPreview: openDocumentPreview,
          onOpenMoveStepModal,
          onRefreshStepActualCost,
          onSaveEditedNote,
          onSaveReceiptForStep,
          onStartEditNote,
          onStartEditReceiptForStep,
          onSubmitNote,
          openMoveTaskModal,
          openStepEditModal,
          openTaskAttachmentsModal,
          parseTaskMetaFromReceiptNotes,
          permitDocuments,
          permitStatusOptions,
          purchaseUnitOptions,
          receiptDraftByStep,
          receiptEditorOpenByStep,
          receiptEditorRefByStepId,
          receiptMetricsByStepId,
          receiptRowRefByDocId,
          refreshingActualCostByStepId,
          renderDocumentGallery,
          requestConfirmation,
          saveInlineReceiptEdit,
          savingNoteId,
          setAttachExistingDocByStepId,
          setAttachExistingDocFilterByStepId,
          setAttachExistingPickerOpenByStepId,
          setDragOverInsertIndex,
          setDragOverParentStepId,
          setEditingNoteTextById,
          setEditingReceiptDocumentIdByStep,
          setExpandedStepById,
          setInlineReceiptDraftByDocId,
          setNoteDraftByStep,
          setNoteEditorOpenByStep,
          setReceiptAttachmentDraftByStep,
          setReceiptDraftByStep,
          setReceiptEditorOpenByStep,
          setStepContactCandidateByStepId,
          setStepContactPickerOpenByStepId,
          setStepInfoModalStepId,
          startInlineReceiptEdit,
          stepAssigneesByStepId,
          stepById,
          stepContactCandidateByStepId,
          stepContactPickerOpenByStepId,
          stepDirectAssigneesByStepId,
          stepDrafts,
          taskTypeOptions: TASK_TYPE_OPTIONS,
          taskUsesManualDateOverride,
          taskVendorOptions,
          toggleStep,
          uploadDocument,
          verifiedActualCostSignatureByStepId,
        }}
        dragOverInsertIndex={dragOverInsertIndex}
        onDropReorder={onDropReorder}
        setDragOverInsertIndex={setDragOverInsertIndex}
        setDragOverParentStepId={setDragOverParentStepId}
        stepCardAssigneeIdFilter={stepCardAssigneeIdFilter}
        stepCardAssigneeTypeFilter={stepCardAssigneeTypeFilter}
        stepCardTextFilterTokens={stepCardTextFilterTokens}
        stepSearchTextById={stepSearchTextById}
        tabSteps={tabSteps}
      />
    );
  };

  const renderDocumentGallery = (items: typeof documents, emptyText: string, readOnly: boolean = false) => {
    return (
      <BuildWizardDocumentGallery
        emptyText={emptyText}
        isPlanPreviewDoc={isPlanPreviewDoc}
        isSpreadsheetPreviewDoc={isSpreadsheetPreviewDoc}
        items={items}
        openDocumentPreview={(doc) => { void openDocumentPreview(doc); }}
        onRemoveDocumentFromStep={(id, originalName) => onRemoveDocumentFromStep(id, originalName)}
        readOnly={readOnly}
        unlinkingDocumentId={unlinkingDocumentId}
      />
    );
  };

  const renderProjectPhotosAndKeyPaperwork = () => (
    <BuildWizardProjectPhotosSection
      docKind={docKind}
      docKindOptions={docKindOptions}
      docPhaseKey={docPhaseKey}
      docStepId={docStepId}
      phaseOptions={phaseOptions}
      primaryBlueprintChoices={primaryBlueprintChoices}
      primaryPhotoChoices={primaryPhotoChoices}
      project={project}
      projectDocuments={projectDocuments}
      renderDocumentGallery={renderDocumentGallery}
      selectableDocSteps={selectableDocSteps}
      setDocKind={setDocKind}
      setDocPhaseKey={setDocPhaseKey}
      setDocStepId={setDocStepId}
      updateProject={updateProject}
      uploadDocument={uploadDocument}
    />
  );

  const renderLauncher = () => (
    <BuildWizardLauncher
      deletingProjectId={deletingProjectId}
      launcherProjects={launcherProjects}
      newHomeWastewaterKind={newHomeWastewaterKind}
      newHomeWaterKind={newHomeWaterKind}
      onCloseWizard={onCloseWizard}
      onCreateNewBuild={onCreateNewBuild}
      onDeleteProject={onDeleteProject}
      onOpenTemplateEditor={onOpenTemplateEditor}
      openBuild={openBuild}
      setNewHomeWastewaterKind={setNewHomeWastewaterKind}
      setNewHomeWaterKind={setNewHomeWaterKind}
    />
  );

  const renderTemplateEditor = () => (
    <BuildWizardTemplateEditor
      deletingProjectId={deletingProjectId}
      formatDate={formatDate}
      onBackToLauncher={onBackToLauncher}
      onCloseWizard={onCloseWizard}
      onCreateTemplate={onCreateTemplate}
      onDeleteProject={onDeleteProject}
      openBuild={openBuild}
      templateProjects={templateProjects}
    />
  );

  const renderBuildWorkspace = () => (
    <BuildWizardWorkspaceMain
      activeTab={activeTab}
      activeTabStepNumbers={activeTabStepNumbers}
      chromeProps={{
        activePhaseDateRange,
        activePhaseHasStoredDateRange,
        activeTab,
        buildEntryPoint,
        formatCurrency,
        isTemplateProject,
        onAddStep: () => addStep(TAB_DEFAULT_PHASE_KEY[activeTab] || 'general'),
        onBackFromWorkspace,
        onCloseWizard,
        onOpenAiTools: () => setAiToolsOpen(true),
        onOpenProjectDesk: () => setProjectDeskOpen(true),
        onOpenProjectOverview: () => setProjectOverviewOpen(true),
        onPhaseDateRangeChange,
        onResetFilters: () => {
          setStepCardAssigneeTypeFilter('all');
          setStepCardAssigneeIdFilter(0);
          setStepCardTextFilter('');
        },
        onSaveTemplate,
        onSelectTab: setActiveTab,
        onSetStepCardAssigneeIdFilter: setStepCardAssigneeIdFilter,
        onSetStepCardAssigneeTypeFilter: setStepCardAssigneeTypeFilter,
        onSetStepCardTextFilter: setStepCardTextFilter,
        onTopbarSearchQueryChange: setTopbarSearchQuery,
        onTopbarSearchSelect: selectTopbarSearchResult,
        onTopbarSearchToggle: setTopbarSearchOpen,
        phaseTotals,
        project,
        projectId,
        savePhaseDateRange,
        saving,
        stepCardAssigneeIdFilter,
        stepCardAssigneeTypeFilter,
        stepCardTextFilter,
        stepCardTextFilterTokens,
        stepFilterContactOptions,
        stickyHeadHeight,
        stickyHeadRef,
        topbarSearchBoxRef,
        topbarSearchLoading,
        topbarSearchOpen,
        topbarSearchQuery,
        topbarSearchResults,
      }}
      completedSectionProps={{
        completedSteps,
        contactTypeChipClass,
        contactTypeLabel,
        footerRange,
        formatCurrency,
        formatDate,
        normalizeContactType,
        noteEditedAtLabel,
        stepAssigneesByStepId,
        stepCostTotalExcludingQuotes,
      }}
      deskWorkspaceProps={{
        contactsProps: {
          contacts: deskContacts,
          contactAssignmentCountById: deskContactAssignmentCountById,
          deleteContactAssignment,
          deskAssignmentPhaseKey,
          deskAssignmentStepId,
          deskContactDraft,
          deskContactQuery,
          deskContactTypeFilter,
          deskSelectedContactId,
          filteredContacts: filteredDeskContacts,
          linkedStepOptions,
          onAddDeskPhaseAssignment,
          onAddDeskStepAssignment,
          onDeleteDeskContact: onDeleteDeskContact,
          onSaveDeskContact,
          onStartNewDeskContact,
          phaseOptions,
          projectId,
          selectedContact: selectedDeskContact,
          selectedContactAssignments,
          setDeskAssignmentPhaseKey,
          setDeskAssignmentStepId,
          setDeskContactDraft,
          setDeskContactQuery,
          setDeskContactTypeFilter,
          setDeskCreateMode,
          setDeskSelectedContactId,
          stepByIdMap,
        },
        documentsProps: {
          buildDocumentDraft,
          deletingDocumentId,
          docKindOptions,
          documentManagerKindFilter,
          documentManagerKindOptions,
          documentManagerLinkedStepFilterOptions,
          documentManagerPhaseFilter,
          documentManagerPhaseOptions,
          documentManagerQuery,
          documentManagerSearchLoading,
          documentManagerSearchResultById: documentManagerSearchResultById as Map<number, { snippet?: string }>,
          documentManagerStepFilter,
          documentSavingId,
          documents,
          filteredDocumentManagerDocs,
          isPlanPreviewDoc,
          isSpreadsheetPreviewDoc,
          linkedStepOptions,
          onDeleteDocument,
          onOpenUploadModal: () => setDocumentUploadModalOpen(true),
          onReplaceDocumentFile,
          onSaveDocumentDraft,
          openDocumentPreview,
          project,
          replaceFileInputByDocId,
          replacingDocumentId,
          setDocumentManagerKindFilter,
          setDocumentManagerPhaseFilter,
          setDocumentManagerQuery,
          setDocumentManagerStepFilter,
          steps,
          updateDocumentDraft,
          updateProject,
        },
        onAddStep: () => addStep('general'),
        onClose: () => setProjectDeskOpen(false),
        open: projectDeskOpen,
        projectDeskSteps,
        renderEditableStepCards,
      }}
      docKind={docKind}
      docKindOptions={docKindOptions}
      docPhaseKey={docPhaseKey}
      docStepId={docStepId}
      documents={documents}
      filteredTabSteps={filteredTabSteps}
      footerRange={footerRange}
      footerTimelineSteps={footerTimelineSteps}
      onSetDocKind={setDocKind}
      onSetDocPhaseKey={setDocPhaseKey}
      onSetDocStepId={setDocStepId}
      onTimelineStepChange={onTimelineStepChange}
      onUploadDocument={(file) => {
        void uploadDocument(docKind, file, docStepId > 0 ? docStepId : undefined, undefined, docPhaseKey);
      }}
      overviewSectionProps={{
        aiBusy,
        focusNextStep: (step) => focusStepInBuildView(stepPhaseBucket(step), step.id),
        formatCurrency,
        formatDate,
        formatTimelineDate,
        onEstimateMissingWithAi,
        overviewMetrics,
        projectPhotosSection: renderProjectPhotosAndKeyPaperwork(),
      }}
      phaseOptions={phaseOptions}
      phaseTaskListCardRef={phaseTaskListCardRef}
      renderDocumentGallery={renderDocumentGallery}
      renderEditableStepCards={renderEditableStepCards}
      selectableDocSteps={selectableDocSteps}
      startSectionProps={{
        changeCurrencyEdit,
        finishCurrencyEdit,
        formatCurrency,
        lotSizeDetectedUnit,
        lotSizeInput,
        lotSizeInputToSqftAuto,
        projectDraft,
        projectPhotosSection: renderProjectPhotosAndKeyPaperwork(),
        projectTotals,
        renderCurrencyInputValue,
        setLotSizeInput,
        setProjectDraft,
        startCurrencyEdit,
        toNumberOrNull,
        toStringOrNull,
        updateProject,
      }}
      stickyTopOffset={stickyTopOffset}
    >
      <BuildWizardWorkspaceModals
        aiToolsProps={{
          aiBusy,
          aiPayloadJson: aiPayloadJson || '',
          aiPromptText: aiPromptText || '',
          deskAutoAssignBusy,
          onAutoAssignDeskStepsToTimeline: onAutoAssignDeskStepsToTimeline,
          onClose: () => setAiToolsOpen(false),
          onCompleteWithAi,
          open: aiToolsOpen,
          packageForAi,
          sendToAiAndIngest: () => generateStepsFromAi('optimize'),
        }}
        documentUploadProps={{
          busy: documentUploadBusy,
          docKind,
          docKindOptions,
          docPhaseKey,
          docStepId,
          file: documentUploadFile,
          onClose: () => setDocumentUploadModalOpen(false),
          onFileChange: setDocumentUploadFile,
          open: documentUploadModalOpen,
          phaseOptions,
          selectableDocSteps,
          setDocKind,
          setDocPhaseKey,
          setDocStepId,
          uploadDocument: async (...args) => {
            setDocumentUploadBusy(true);
            try {
              return await uploadDocument(...args);
            } finally {
              setDocumentUploadBusy(false);
            }
          },
        }}
        lightboxProps={{
          closeLightbox,
          lightboxDoc,
          lightboxSpreadsheetSheetIndex,
          lightboxSupportsZoom,
          lightboxZoom,
          lightboxZoomMax: LIGHTBOX_ZOOM_MAX,
          lightboxZoomMin: LIGHTBOX_ZOOM_MIN,
          lightboxZoomStep: LIGHTBOX_ZOOM_STEP,
          onLightboxWheelZoom,
          open: Boolean(lightboxDoc),
          resetLightboxZoom,
          setLightboxSpreadsheetSheetIndex,
          zoomLightboxBy,
        }}
        projectOverviewProps={{
          formatCurrency,
          onClose: () => setProjectOverviewOpen(false),
          open: projectOverviewOpen,
          projectOverviewRange,
          projectOverviewSections,
          projectOverviewTotals,
          steps,
        }}
        recoveryReportProps={{
          fetchSingletreeRecoveryStatus,
          onClose: () => setRecoveryReportOpen(false),
          onToast,
          open: recoveryReportOpen,
          recoveryJobId,
          recoveryPolling,
          recoveryReportJson,
          recoveryStagedCount,
          recoveryStagedRoot,
          recoveryStatus,
          setRecoveryJobId,
          setRecoveryPolling,
          setRecoveryReportJson,
          setRecoveryStatus,
        }}
        stepEditProps={{
          activeTabStepNumbers,
          closeStepEditModal,
          dependencyCandidateByStepId,
          setDependencyCandidateByStepId,
          open: Boolean(stepEditModalStep && stepEditModalDraft),
          saveStepEditModal,
          saving: stepEditSaving,
          step: stepEditModalStep,
          stepById,
          stepDraft: stepEditModalDraft,
          stepEditModalDependencyIds,
          stepEditModalDependencyOptions,
          updateStepDraft,
        }}
        stepInfoProps={{
          activeTabStepNumbers,
          formatAuditValue,
          formatDate,
          noteEditedAtLabel,
          onClose: () => setStepInfoModalStepId(0),
          open: Boolean(stepInfoModalStep),
          step: stepInfoModalStep,
        }}
        workspaceActionModalProps={{
          activeTabStepNumbers,
          attachExistingDocByReceiptId,
          attachExistingDocFilterByReceiptId,
          confirmState,
          documentSavingId,
          documents,
          moveStepModalStep,
          moveStepModalTargetTab,
          moveStepPhaseTabOptions,
          moveTaskModalDoc,
          moveTaskModalTargetStepId,
          moveTaskStepOptions,
          movingStep,
          onAttachExistingDocumentToReceipt,
          onCloseMoveStep: () => setMoveStepModalStepId(0),
          onCloseMoveTask: () => setMoveTaskModalDocId(0),
          onCloseTaskAttachments: () => setTaskAttachmentsModalDocId(0),
          onConfirm: closeConfirmation,
          onMoveReceiptToStep,
          onMoveStepFromModal,
          onOpenDocumentPreview: openDocumentPreview,
          onUploadReceiptAttachments,
          setAttachExistingDocByReceiptId,
          setAttachExistingDocFilterByReceiptId,
          setMoveStepModalTargetTab,
          setMoveTaskModalTargetStepId,
          taskAttachmentsModalAttachableDocuments,
          taskAttachmentsModalDoc,
          taskAttachmentsModalStep,
        }}
      />
    </BuildWizardWorkspaceMain>
  );

  if (view === 'launcher') {
    return renderLauncher();
  }
  if (view === 'template_editor') {
    return renderTemplateEditor();
  }
  return renderBuildWorkspace();
}
