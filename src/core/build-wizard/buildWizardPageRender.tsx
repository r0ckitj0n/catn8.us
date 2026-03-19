import React from 'react';

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
  formatCurrency,
  formatDate,
  formatTimelineDate,
  getStepPastelColor,
  lotSizeInputToSqftAuto,
  lotSizeSqftToDisplayInput,
  parseDate,
  parseUrlState,
  prettyPhaseLabel,
  pushUrlState,
  recommendPhaseKeyForStep,
  sortAlpha,
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
  BuildWizardContactType,
  BuildWizardSearchResult,
  BuildWizardTaskMeta,
  BuildWizardTaskType,
  InlineReceiptField,
  LightboxPreview,
  PhaseDateRange,
  ProjectOverviewPhaseSection,
  ProjectOverviewStepRow,
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
import { buildSearchText, buildStepCostVerificationSignature } from './buildWizardSearchCostUtils';
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
import { useBuildWizardConfirmationActions } from './useBuildWizardConfirmationActions';
import { useBuildWizardDeskActions } from './useBuildWizardDeskActions';
import { useBuildWizardAiConfirmActions } from './useBuildWizardAiConfirmActions';
import { useBuildWizardDocumentManagerData } from './useBuildWizardDocumentManagerData';
import { useBuildWizardLauncherActions } from './useBuildWizardLauncherActions';
import { useBuildWizardRecoveryUiActions } from './useBuildWizardRecoveryUiActions';
import { useBuildWizardDocumentStepData } from './useBuildWizardDocumentStepData';
import { useBuildWizardDocumentPreview } from './useBuildWizardDocumentPreview';
import { useBuildWizardDocumentDraftActions } from './useBuildWizardDocumentDraftActions';
import { useBuildWizardPhaseRangeActions } from './useBuildWizardPhaseRangeActions';
import { useBuildWizardNoteDocumentActions } from './useBuildWizardNoteDocumentActions';
import { useBuildWizardOverviewData } from './useBuildWizardOverviewData';
import { useBuildWizardReceiptActions } from './useBuildWizardReceiptActions';
import { useBuildWizardStepDragActions } from './useBuildWizardStepDragActions';
import { useBuildWizardStepEditActions } from './useBuildWizardStepEditActions';
import { useBuildWizardStepUiActions } from './useBuildWizardStepUiActions';
import { useBuildWizardWorkspaceMainProps } from './useBuildWizardWorkspaceMainProps';
import { useBuildWizardWorkspaceModalProps } from './useBuildWizardWorkspaceModalProps';
import { useBuildWizardActiveTabTree } from './useBuildWizardActiveTabTree';
import { useBuildWizardStepWorkspaceMeta } from './useBuildWizardStepWorkspaceMeta';
import { useBuildWizardWorkspaceData } from './useBuildWizardWorkspaceData';
import { useBuildWizardWorkspaceSelectionData } from './useBuildWizardWorkspaceSelectionData';
import {
  clampLightboxZoom,
  allowedTaskTypes,
  LIGHTBOX_TEXT_PREVIEW_MAX_CHARS,
  LIGHTBOX_ZOOM_MAX,
  LIGHTBOX_ZOOM_MIN,
  LIGHTBOX_ZOOM_STEP,
  LIGHTBOX_ZOOM_STEP_FAST,
  TASK_META_FIELD_LABELS,
  TASK_TYPE_OPTIONS,
} from './buildWizardPageRenderConstants';
import {
  formatAuditValue as formatAuditValueBase,
  formatCurrencyForInput,
  parseCurrencyText,
} from './buildWizardCurrencyAuditUtils';
import { useBuildWizardPhaseRangeAutoSync } from './useBuildWizardPhaseRangeAutoSync';
import '../../components/pages/BuildWizardPage.css';

interface BuildWizardPageProps extends AppShellPageProps {
  isAdmin?: boolean;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

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

  const zoomLightboxBy = React.useCallback((delta: number) => {
    setLightboxZoom((prev) => clampLightboxZoom(prev + delta));
  }, []);

  const resetLightboxZoom = React.useCallback(() => {
    setLightboxZoom(1);
  }, []);
  const { closeConfirmation, confirmState, requestConfirmation } = useBuildWizardConfirmationActions();
  const {
    closeLightbox,
    isPlanPreviewDoc,
    isSpreadsheetPreviewDoc,
    isTextPreviewDoc,
    openDocumentPreview,
  } = useBuildWizardDocumentPreview({
    lightboxTextPreviewMaxChars: LIGHTBOX_TEXT_PREVIEW_MAX_CHARS,
    onToast,
    parseTaskDocumentPreview,
    setLightboxDoc,
    setLightboxSpreadsheetSheetIndex,
    setLightboxZoom,
  });

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

  const {
    authorityContacts,
    completedSteps,
    deskContactAssignmentCountById,
    deskContacts,
    filteredDeskContacts,
    filteredTabSteps,
    moveStepModalStep,
    projectDeskSteps,
    selectedContactAssignments,
    selectedDeskContact,
    stepById,
    stepByIdMap,
    stepEditModalDraft,
    stepEditModalStep,
    stepInfoModalStep,
  } = useBuildWizardWorkspaceData({
    activeTab,
    contactAssignments,
    contacts,
    deskContactQuery,
    deskContactTypeFilter,
    deskSelectedContactId,
    moveStepModalStepId,
    stepDrafts,
    stepEditModalStepId,
    stepInfoModalStepId,
    stepPhaseBucket,
    steps,
  });

  const { activeTabStepNumbers, activeTabTreeRows, incompleteDescendantCountByStepId } = useBuildWizardActiveTabTree(filteredTabSteps);

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

  const {
    getStepActualExcludingQuotes,
    getStepEstimatedExcludingQuotes,
    moveStepPhaseTabOptions,
    receiptMetricsByStepId,
    stepAssigneesByStepId,
    stepCardTextFilterTokens,
    stepDirectAssigneesByStepId,
    stepFilterContactOptions,
    stepSearchTextById,
  } = useBuildWizardStepWorkspaceMeta({
    contactAssignments,
    contacts,
    documents,
    filteredTabSteps,
    parseTaskMetaFromReceiptNotes,
    stepCardTextFilter,
    steps,
  });

  const {
    overviewMetrics,
    phaseTotals,
    projectOverviewRange,
    projectOverviewSections,
    projectOverviewTotals,
    projectTotals,
    stepCostTotalExcludingQuotes,
  } = useBuildWizardOverviewData({
    activeTab,
    documents,
    filteredTabSteps,
    getStepActualExcludingQuotes,
    getStepEstimatedExcludingQuotes,
    isAiEstimatedField,
    project,
    stepAssigneesByStepId,
    stepPhaseBucket,
    steps,
  });

  const {
    activePhaseDateRange,
    activePhaseHasStoredDateRange,
    onMoveStepFromModal,
    onOpenMoveStepModal,
    onPhaseDateRangeChange,
    resolvePhaseDateRange,
  } = useBuildWizardPhaseRangeActions({
    activeTab,
    moveStepModalStepId,
    moveStepModalTargetTab,
    movingStep,
    onToast,
    phaseDateRanges,
    projectId,
    savePhaseDateRange,
    setActiveTab,
    setMoveStepModalStepId,
    setMoveStepModalTargetTab,
    setMovingStep,
    stepById,
    stepPhaseBucket,
    steps,
    updateStep,
  });

  const {
    attachableProjectDocuments,
    footerTimelineSteps,
    linkedStepDisplayNumberById,
    linkedStepOptions,
    selectableDocSteps,
  } = useBuildWizardWorkspaceSelectionData({
    activeTab,
    docPhaseKey,
    documents,
    filteredTabSteps,
    setFooterRange,
    stepPhaseBucket,
    steps,
  });

  const {
    documentManagerSearchResultById,
    documentManagerKindOptions,
    documentManagerLinkedStepFilterOptions,
    documentManagerPhaseOptions,
    filteredDocumentManagerDocs,
    moveTaskModalDoc,
    moveTaskStepOptions,
    permitDocuments,
    phaseOptions,
    primaryBlueprintChoices,
    primaryPhotoChoices,
    projectDocuments,
    taskAttachmentsModalAttachableDocuments,
    taskAttachmentsModalDoc,
    taskAttachmentsModalStep,
    topbarSearchResults,
  } = useBuildWizardDocumentManagerData({
    attachExistingDocFilterByReceiptId,
    attachableProjectDocuments,
    buildTabs: BUILD_TABS,
    docKindOptions,
    documentManagerKindFilter,
    documentManagerPhaseFilter,
    documentManagerQuery,
    documentManagerSearchResults,
    documentManagerStepFilter,
    documents,
    linkedStepOptions,
    moveTaskModalDocId,
    stepById,
    stepByIdMap,
    stepPhaseBucket,
    steps,
    taskAttachmentsModalDocId,
    topbarSearchDocumentResults,
    topbarSearchQuery,
  });

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

  const launcherProjects = React.useMemo(() => projects.filter((candidate) => Number(candidate.is_template || 0) !== 1), [projects]);
  const templateProjects = React.useMemo(() => projects.filter((candidate) => Number(candidate.is_template || 0) === 1), [projects]);
  const isTemplateProject = Number(project?.is_template || 0) === 1;
  const { onBackFromWorkspace, onBackToLauncher, onCloseWizard, onCreateNewBuild, onCreateTemplate, onOpenTemplateEditor, onSaveTemplate, openBuild } = useBuildWizardLauncherActions({
    buildEntryPoint,
    createProject,
    isTemplateProject,
    newHomeWastewaterKind,
    newHomeWaterKind,
    onSetLauncherView: (nextView, nextEntryPoint) => {
      setView(nextView);
      setBuildEntryPoint(nextEntryPoint);
    },
    openProject,
    projectId,
    setActiveTab,
    templateProjectsLength: templateProjects.length,
    updateProject,
  });

  const {
    changeCurrencyEdit,
    clearStepDraft,
    closeStepEditModal,
    finishCurrencyEdit,
    noteEditedAtLabel,
    onRefreshStepActualCost,
    onTimelineStepChange,
    openStepEditModal,
    renderCurrencyInputValue,
    startCurrencyEdit,
    updateStepDraft,
  } = useBuildWizardStepUiActions({
    activeCurrencyInputKey,
    currencyInputByKey,
    onToast,
    setActiveCurrencyInputKey,
    setCurrencyInputByKey,
    setRefreshingActualCostByStepId,
    setStepDrafts,
    setStepEditModalStepId,
    setVerifiedActualCostSignatureByStepId,
    stepById,
    stepDrafts,
    stepEditModalStepId,
    updateStep,
  });

  const {
    onCancelEditNote,
    onDeleteDocument,
    onDeleteStepNoteById,
    onRemoveDocumentFromStep,
    onReplaceDocumentFile,
    onSaveEditedNote,
    onStartEditNote,
    onSubmitNote,
  } = useBuildWizardNoteDocumentActions({
    addStepNote,
    deleteDocument,
    deleteStepNote,
    deletingDocumentId,
    deletingNoteId,
    editingNoteTextById,
    noteDraftByStep,
    onToast,
    replacingDocumentId,
    replaceDocument,
    requestConfirmation,
    setDeletingDocumentId,
    setDeletingNoteId,
    setEditingNoteTextById,
    setNoteDraftByStep,
    setReplacingDocumentId,
    setSavingNoteId,
    setUnlinkingDocumentId,
    unlinkingDocumentId,
    updateDocument,
    updateStepNote,
    savingNoteId,
  });

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

  const {
    onAddContactToStep,
    onAddDeskPhaseAssignment,
    onAddDeskStepAssignment,
    onAutoAssignDeskStepsToTimeline,
    onDeleteDeskContact,
    onSaveDeskContact,
    onStartNewDeskContact,
  } = useBuildWizardDeskActions({
    addContactAssignment,
    aiBusy,
    deleteContact,
    deskAssignmentPhaseKey,
    deskAssignmentStepId,
    deskAutoAssignBusy,
    deskContactDraft,
    deskContacts,
    generateStepsFromAi,
    onToast,
    projectId,
    requestConfirmation,
    saveContact,
    selectedDeskContact,
    setDeskAutoAssignBusy,
    setDeskContactDraft,
    setDeskCreateMode,
    setDeskSelectedContactId,
    setStepContactCandidateByStepId,
    setStepContactPickerOpenByStepId,
    steps,
    updateStep,
    toStringOrNull,
  });

  const { clampStepDatesWithinRange, expandPhaseRangeForStep, onSaveDocument, taskVendorOptions } = useBuildWizardDocumentStepData({
    contacts,
    documentSavingId,
    documents,
    projectId,
    resolvePhaseDateRange,
    savePhaseDateRange,
    setDocumentSavingId,
    stepPhaseBucket,
    updateDocument,
  });

  const {
    buildDocumentDraft,
    onAttachExistingDocumentToReceipt,
    onAttachExistingDocumentToStep,
    onMoveReceiptToStep,
    onSaveDocumentDraft,
    onUploadReceiptAttachments,
    openMoveTaskModal,
    openTaskAttachmentsModal,
    updateDocumentDraft,
  } = useBuildWizardDocumentDraftActions({
    attachExistingDocByReceiptId,
    attachExistingDocByStepId,
    buildDocumentDraftDeps: { documentDrafts, parseTaskMetaFromReceiptNotes, setTaskDateOverrideInReceiptNotes, taskUsesManualDateOverride },
    documents,
    moveTaskModalDoc,
    moveTaskModalTargetStepId,
    onSaveDocument,
    onToast,
    setAttachExistingDocByReceiptId,
    setAttachExistingDocByStepId,
    setAttachExistingDocFilterByReceiptId,
    setDocumentDrafts,
    setMoveTaskModalDocId,
    setMoveTaskModalTargetStepId,
    setPendingScrollReceiptId,
    setTaskAttachmentsModalDocId,
    stepByIdMap,
    uploadDocument,
  });
  const {
    autosaveExistingReceiptDraftForStep,
    onSaveReceiptForStep,
    onStartEditReceiptForStep,
    saveInlineReceiptEdit,
    startInlineReceiptEdit,
  } = useBuildWizardReceiptActions({
    createStepReceipt,
    documents,
    editingReceiptDocumentIdByStep,
    inlineReceiptDraftByDocId,
    onSaveDocument,
    parseTaskMetaFromReceiptNotes,
    pendingScrollReceiptId,
    projectId,
    receiptAttachmentDraftByStep,
    receiptDraftByStep,
    receiptEditorRefByStepId,
    receiptRowRefByDocId,
    setEditingReceiptDocumentIdByStep,
    setInlineEditingReceiptFieldByDocId,
    setInlineReceiptDraftByDocId,
    setPendingScrollReceiptId,
    setReceiptAttachmentDraftByStep,
    setReceiptDraftByStep,
    setReceiptEditorOpenByStep,
    taskUsesManualDateOverride,
    uploadDocument,
  });

  const { onCompleteWithAi, onEstimateMissingWithAi } = useBuildWizardAiConfirmActions({
    generateStepsFromAi,
    requestConfirmation,
  });
  const { onRunSingletreeRecovery, onUploadRecoveryFiles } = useBuildWizardRecoveryUiActions({
    clearedLegacyTaskDatesByProjectRef,
    documents,
    fetchSingletreeRecoveryStatus,
    isAdmin,
    isLegacyAutoStampedTaskDate,
    onToast,
    openProject,
    parseTaskMetaFromReceiptNotes,
    projectId,
    recoverSingletreeDocuments,
    recoveryBusy,
    recoveryJobId,
    recoveryPolling,
    recoveryStagedRoot,
    recoveryStatus,
    recoveryUploadBusy,
    recoveryUploadInputRef,
    requestConfirmation,
    setRecoveryJobId,
    setRecoveryPolling,
    setRecoveryReportJson,
    setRecoveryReportOpen,
    setRecoveryStagedCount,
    setRecoveryStagedRoot,
    setRecoveryStatus,
    setRecoveryUploadBusy,
    setRecoveryUploadToken,
    setTaskDateOverrideInReceiptNotes,
    stageSingletreeSourceFiles,
  });

  const { autoReorderPhaseByTimeline, saveStepEditModal } = useBuildWizardStepEditActions({
    clearStepDraft,
    documents,
    expandPhaseRangeForStep,
    onToast,
    parseTaskMetaFromReceiptNotes,
    reorderSteps,
    setStepEditModalStepId,
    setStepEditSaving,
    stepDrafts,
    stepEditModalStep,
    stepEditSaving,
    steps,
    updateStep,
  });

  useBuildWizardPhaseRangeAutoSync({
    projectId,
    resolvePhaseDateRange,
    savePhaseDateRange,
    stepPhaseBucket,
    steps,
    toStringOrNull,
  });
  const { beginStepDrag, clearStepDragState, onDropMakeChild, onDropReorder } = useBuildWizardStepDragActions({
    activeTabTreeRows,
    clampStepDatesWithinRange,
    draggingStepId,
    reorderSteps,
    setDragOverInsertIndex,
    setDragOverParentStepId,
    setDraggingStepId,
    stepById,
    steps,
    updateStep,
  });

  const formatAuditValue = React.useCallback((value: unknown, fieldName?: string): string => {
    return formatAuditValueBase(value, fieldName, formatCurrency);
  }, []);

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
        onRemoveDocumentFromStep={(id) => onRemoveDocumentFromStep(id)}
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

  const workspaceModalProps = useBuildWizardWorkspaceModalProps({
    aiToolsProps: {
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
    },
    documentUploadProps: {
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
    },
    lightboxProps: {
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
    },
    projectOverviewProps: {
      formatCurrency,
      onClose: () => setProjectOverviewOpen(false),
      open: projectOverviewOpen,
      projectOverviewRange,
      projectOverviewSections,
      projectOverviewTotals,
      steps,
    },
    recoveryReportProps: {
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
    },
    stepEditProps: {
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
    },
    stepInfoProps: {
      activeTabStepNumbers,
      formatAuditValue,
      formatDate,
      noteEditedAtLabel,
      onClose: () => setStepInfoModalStepId(0),
      open: Boolean(stepInfoModalStep),
      step: stepInfoModalStep,
    },
    workspaceActionModalProps: {
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
    },
  });
  const buildWorkspaceProps = useBuildWizardWorkspaceMainProps({
    activeTab,
    activeTabStepNumbers,
    chromeProps: {
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
    },
    completedSectionProps: {
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
    },
    deskWorkspaceProps: {
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
        onDeleteDeskContact,
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
    },
    docKind,
    docKindOptions,
    docPhaseKey,
    docStepId,
    documents,
    filteredTabSteps,
    footerRange,
    footerTimelineSteps,
    onSetDocKind: setDocKind,
    onSetDocPhaseKey: setDocPhaseKey,
    onSetDocStepId: setDocStepId,
    onTimelineStepChange,
    onUploadDocument: (file) => {
      void uploadDocument(docKind, file, docStepId > 0 ? docStepId : undefined, undefined, docPhaseKey);
    },
    overviewSectionProps: {
      aiBusy,
      focusNextStep: (step) => focusStepInBuildView(stepPhaseBucket(step), step.id),
      formatCurrency,
      formatDate,
      formatTimelineDate,
      onEstimateMissingWithAi,
      overviewMetrics,
      projectPhotosSection: renderProjectPhotosAndKeyPaperwork(),
    },
    phaseOptions,
    phaseTaskListCardRef,
    renderDocumentGallery,
    renderEditableStepCards,
    selectableDocSteps,
    startSectionProps: {
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
    },
    stickyTopOffset,
  });

  const renderBuildWorkspace = () => (
    <BuildWizardWorkspaceMain {...buildWorkspaceProps}>
      <BuildWizardWorkspaceModals {...workspaceModalProps} />
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
