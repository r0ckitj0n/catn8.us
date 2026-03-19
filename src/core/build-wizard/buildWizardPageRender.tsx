import React from 'react';

import { useBuildWizard } from '../../hooks/useBuildWizard';
import {
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
import { BuildWizardEditableStepCards } from './buildWizardEditableStepCards';
import { BuildWizardWorkspaceMain } from './buildWizardWorkspaceMain';
import { BuildWizardWorkspaceModals } from './buildWizardWorkspaceModals';
import { useBuildWizardConfirmationActions } from './useBuildWizardConfirmationActions';
import { useBuildWizardDeskActions } from './useBuildWizardDeskActions';
import { useBuildWizardDocumentManagerData } from './useBuildWizardDocumentManagerData';
import { useBuildWizardLauncherActions } from './useBuildWizardLauncherActions';
import { useBuildWizardDocumentPreview } from './useBuildWizardDocumentPreview';
import { useBuildWizardPhaseRangeActions } from './useBuildWizardPhaseRangeActions';
import { useBuildWizardNoteDocumentActions } from './useBuildWizardNoteDocumentActions';
import { useBuildWizardOverviewData } from './useBuildWizardOverviewData';
import { useBuildWizardStepUiActions } from './useBuildWizardStepUiActions';
import { useBuildWizardDropdownData } from './useBuildWizardDropdownData';
import { useBuildWizardActiveTabTree } from './useBuildWizardActiveTabTree';
import { useBuildWizardStepWorkspaceMeta } from './useBuildWizardStepWorkspaceMeta';
import { useBuildWizardWorkspaceData } from './useBuildWizardWorkspaceData';
import { useBuildWizardWorkspaceSelectionData } from './useBuildWizardWorkspaceSelectionData';
import { useBuildWizardWorkspaceCleanupEffects } from './useBuildWizardWorkspaceCleanupEffects';
import { useBuildWizardWorkspaceSearchEffects } from './useBuildWizardWorkspaceSearchEffects';
import { useBuildWizardProjectDeskEffects } from './useBuildWizardProjectDeskEffects';
import { useBuildWizardSelectionEffects } from './useBuildWizardSelectionEffects';
import { useBuildWizardRenderers } from './useBuildWizardRenderers';
import { useBuildWizardWorkspaceChromeEffects } from './useBuildWizardWorkspaceChromeEffects';
import { useBuildWizardDocumentActionSetup } from './useBuildWizardDocumentActionSetup';
import { useBuildWizardWorkflowActionSetup } from './useBuildWizardWorkflowActionSetup';
import { useBuildWizardWorkspaceComposedProps } from './useBuildWizardWorkspaceComposedProps';
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

  useBuildWizardWorkspaceChromeEffects({
    activeTab,
    initialUrlState,
    lotSizeSqftToDisplayInput,
    onToast,
    openProject,
    phaseTaskListCardRef,
    previousActiveTabRef,
    projectId,
    questionnaire,
    setActiveTab,
    setBuildEntryPoint,
    setDropdownSettings,
    setLotSizeInput,
    setProjectDraft,
    setRefreshingActualCostByStepId,
    setStickyHeadHeight,
    setStickyTopOffset,
    setVerifiedActualCostSignatureByStepId,
    setView,
    stickyHeadHeight,
    stickyHeadRef,
    stickyTopOffset,
    view,
  });

  const {
    docKindOptions,
    lotSizeDetectedUnit,
    permitStatusOptions,
    purchaseUnitOptions,
  } = useBuildWizardDropdownData({
    docKind,
    dropdownSettings,
    lotSizeInput,
    setDocKind,
  });

  useBuildWizardWorkspaceCleanupEffects({
    documents,
    moveTaskModalDocId,
    setAttachExistingDocFilterByReceiptId,
    setAttachExistingDocFilterByStepId,
    setAttachExistingPickerOpenByStepId,
    setDependencyCandidateByStepId,
    setExpandedStepById,
    setMoveTaskModalDocId,
    setMoveTaskModalTargetStepId,
    setReceiptAttachmentDraftByStep,
    setReceiptDraftByStep,
    setReceiptEditorOpenByStep,
    setStepDrafts,
    setStepInfoModalStepId,
    setTaskAttachmentsModalDocId,
    stepInfoModalStepId,
    steps,
    taskAttachmentsModalDocId,
  });
  useBuildWizardWorkspaceSearchEffects({
    documentManagerQuery,
    projectId,
    searchContent,
    setDocumentManagerSearchLoading,
    setDocumentManagerSearchResults,
    setTopbarSearchDocumentResults,
    setTopbarSearchLoading,
    setTopbarSearchOpen,
    steps,
    topbarSearchBoxRef,
    topbarSearchFocusStepId,
    topbarSearchOpen,
    topbarSearchQuery,
  });

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

  useBuildWizardProjectDeskEffects({
    deskContacts,
    deskCreateMode,
    deskSelectedContactId,
    documentManagerLinkedStepFilterOptions,
    documentManagerStepFilter,
    documents,
    docStepId,
    normalizeContactType,
    parseTaskMetaFromReceiptNotes,
    projectDeskOpen,
    selectedDeskContact,
    selectableDocSteps,
    setDeskContactDraft,
    setDeskCreateMode,
    setDeskSelectedContactId,
    setDocStepId,
    setDocumentDrafts,
    setDocumentManagerKindFilter,
    setDocumentManagerPhaseFilter,
    setDocumentManagerQuery,
    setDocumentManagerStepFilter,
    setDocumentUploadFile,
    setDocumentUploadModalOpen,
    taskUsesManualDateOverride,
  });

  useBuildWizardSelectionEffects({
    moveStepModalStepId,
    phaseProgressOrder: PHASE_PROGRESS_ORDER,
    setMoveStepModalStepId,
    setMoveStepModalTargetTab,
    setStepCardAssigneeIdFilter,
    setStepEditModalStepId,
    stepById,
    stepCardAssigneeIdFilter,
    stepEditModalStepId,
    stepFilterContactOptions,
    stepPhaseBucket,
  });

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

  const {
    autosaveExistingReceiptDraftForStep,
    buildDocumentDraft,
    clampStepDatesWithinRange,
    expandPhaseRangeForStep,
    onAttachExistingDocumentToReceipt,
    onAttachExistingDocumentToStep,
    onMoveReceiptToStep,
    onSaveDocument,
    onSaveDocumentDraft,
    onSaveReceiptForStep,
    onStartEditReceiptForStep,
    onUploadReceiptAttachments,
    openMoveTaskModal,
    openTaskAttachmentsModal,
    saveInlineReceiptEdit,
    startInlineReceiptEdit,
    taskVendorOptions,
    updateDocumentDraft,
  } = useBuildWizardDocumentActionSetup({
    attachExistingDocByReceiptId,
    attachExistingDocByStepId,
    buildDocumentDraftDeps: { documentDrafts, parseTaskMetaFromReceiptNotes, setTaskDateOverrideInReceiptNotes, taskUsesManualDateOverride },
    contacts,
    createStepReceipt,
    documents,
    documentSavingId,
    editingReceiptDocumentIdByStep,
    inlineReceiptDraftByDocId,
    moveTaskModalDoc,
    moveTaskModalTargetStepId,
    onToast,
    parseTaskMetaFromReceiptNotes,
    pendingScrollReceiptId,
    projectId,
    receiptAttachmentDraftByStep,
    receiptDraftByStep,
    receiptEditorRefByStepId,
    receiptRowRefByDocId,
    resolvePhaseDateRange,
    savePhaseDateRange,
    setAttachExistingDocByReceiptId,
    setAttachExistingDocByStepId,
    setAttachExistingDocFilterByReceiptId,
    setDocumentDrafts,
    setDocumentSavingId,
    setEditingReceiptDocumentIdByStep,
    setInlineEditingReceiptFieldByDocId,
    setInlineReceiptDraftByDocId,
    setMoveTaskModalDocId,
    setMoveTaskModalTargetStepId,
    setPendingScrollReceiptId,
    setReceiptAttachmentDraftByStep,
    setReceiptDraftByStep,
    setReceiptEditorOpenByStep,
    setTaskAttachmentsModalDocId,
    stepByIdMap,
    stepPhaseBucket,
    taskUsesManualDateOverride,
    updateDocument,
    uploadDocument,
  });

  const {
    autoReorderPhaseByTimeline,
    beginStepDrag,
    clearStepDragState,
    onCompleteWithAi,
    onDropMakeChild,
    onDropReorder,
    onEstimateMissingWithAi,
    onRunSingletreeRecovery,
    onUploadRecoveryFiles,
    saveStepEditModal,
  } = useBuildWizardWorkflowActionSetup({
    activeTabTreeRows,
    clampStepDatesWithinRange,
    clearedLegacyTaskDatesByProjectRef,
    clearStepDraft,
    documents,
    draggingStepId,
    expandPhaseRangeForStep,
    fetchSingletreeRecoveryStatus,
    generateStepsFromAi,
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
    reorderSteps,
    requestConfirmation,
    setDragOverInsertIndex,
    setDragOverParentStepId,
    setDraggingStepId,
    setRecoveryJobId,
    setRecoveryPolling,
    setRecoveryReportJson,
    setRecoveryReportOpen,
    setRecoveryStagedCount,
    setRecoveryStagedRoot,
    setRecoveryStatus,
    setRecoveryUploadBusy,
    setRecoveryUploadToken,
    setStepEditModalStepId,
    setStepEditSaving,
    setTaskDateOverrideInReceiptNotes,
    stageSingletreeSourceFiles,
    stepById,
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

  const { projectPhotosSection, renderDocumentGallery, renderLauncher, renderTemplateEditor } = useBuildWizardRenderers({
    deletingProjectId,
    docKind,
    docKindOptions,
    docPhaseKey,
    docStepId,
    formatDate,
    isPlanPreviewDoc,
    isSpreadsheetPreviewDoc,
    launcherProjects,
    newHomeWastewaterKind,
    newHomeWaterKind,
    onBackToLauncher,
    onCloseWizard,
    onCreateNewBuild,
    onCreateTemplate,
    onDeleteProject,
    onOpenTemplateEditor,
    onRemoveDocumentFromStep,
    openBuild,
    openDocumentPreview,
    phaseOptions,
    primaryBlueprintChoices,
    primaryPhotoChoices,
    project,
    projectDocuments,
    selectableDocSteps,
    setDocKind,
    setDocPhaseKey,
    setDocStepId,
    setNewHomeWastewaterKind,
    setNewHomeWaterKind,
    templateProjects,
    unlinkingDocumentId,
    updateProject,
    uploadDocument,
  });

  const workspaceComposedOptions = {
    LIGHTBOX_ZOOM_MAX, LIGHTBOX_ZOOM_MIN, LIGHTBOX_ZOOM_STEP, TAB_DEFAULT_PHASE_KEY,
    activePhaseDateRange, activePhaseHasStoredDateRange, activeTab, activeTabStepNumbers, activeTabTreeRows, addStep,
    aiBusy, aiPayloadJson, aiPromptText, aiToolsOpen,
    attachExistingDocByReceiptId, attachExistingDocByStepId, attachExistingDocFilterByReceiptId, attachExistingDocFilterByStepId, attachExistingPickerOpenByStepId,
    attachableProjectDocuments, authorityContacts, autosaveExistingReceiptDraftForStep, beginStepDrag, buildDocumentDraft, buildEntryPoint,
    changeCurrencyEdit, closeConfirmation, closeLightbox, completedSteps, confirmState, contactTypeChipClass, contactTypeLabel, contacts,
    deleteContactAssignment, deleteStep, deletingDocumentId, deletingNoteId, dependencyCandidateByStepId,
    deskAssignmentPhaseKey, deskAssignmentStepId, deskAutoAssignBusy, deskContactAssignmentCountById, deskContactDraft, deskContactQuery, deskContactTypeFilter, deskContacts, deskSelectedContactId,
    docKind, docKindOptions, docPhaseKey, docStepId,
    documentManagerKindFilter, documentManagerKindOptions, documentManagerLinkedStepFilterOptions, documentManagerPhaseFilter, documentManagerPhaseOptions,
    documentManagerQuery, documentManagerSearchLoading, documentManagerSearchResultById: documentManagerSearchResultById as Map<number, { snippet?: string }>, documentManagerStepFilter, documentSavingId,
    documents, dragOverInsertIndex, dragOverParentStepId, draggingStepId, editingNoteTextById, editingReceiptDocumentIdByStep, expandedStepById,
    fetchSingletreeRecoveryStatus, filteredDeskContacts, filteredDocumentManagerDocs, filteredTabSteps, finishCurrencyEdit, footerRange, footerTimelineSteps,
    formatCurrency, formatDate, formatTimelineDate, focusStepInBuildView, generateStepsFromAi, getTaskEffectiveDate, incompleteDescendantCountByStepId,
    inlineEditingReceiptFieldByDocId, inlineReceiptDraftByDocId, isPlanPreviewDoc, isSpreadsheetPreviewDoc, isTemplateProject,
    lightboxDoc, lightboxSpreadsheetSheetIndex, lightboxSupportsZoom, lightboxZoom, linkedStepDisplayNumberById, linkedStepOptions,
    lotSizeDetectedUnit, lotSizeInput, lotSizeInputToSqftAuto, moveStepModalStep, moveStepModalTargetTab, moveStepPhaseTabOptions, moveTaskModalDoc, moveTaskModalTargetStepId, moveTaskStepOptions, movingStep,
    normalizeContactType, noteDraftByStep, noteEditedAtLabel, noteEditorOpenByStep,
    onAddContactToStep, onAddDeskPhaseAssignment, onAddDeskStepAssignment, onAttachExistingDocumentToReceipt, onAttachExistingDocumentToStep, onAutoAssignDeskStepsToTimeline,
    onBackFromWorkspace, onCancelEditNote, onCloseWizard, onCompleteWithAi, onDeleteDeskContact, onDeleteDocument, onDeleteStepNoteById, onDropMakeChild, onEstimateMissingWithAi,
    onLightboxWheelZoom, onMoveReceiptToStep, onMoveStepFromModal, onOpenDocumentPreview: openDocumentPreview, onOpenMoveStepModal, onPhaseDateRangeChange, onRefreshStepActualCost,
    onReplaceDocumentFile, onSaveDeskContact, onSaveDocumentDraft, onSaveEditedNote, onSaveReceiptForStep, onSaveTemplate, onStartEditNote, onStartEditReceiptForStep, onStartNewDeskContact, onSubmitNote,
    onTimelineStepChange, onToast, onUploadReceiptAttachments, openDocumentPreview, openMoveTaskModal, openStepEditModal, openTaskAttachmentsModal,
    overviewMetrics, packageForAi, parseTaskMetaFromReceiptNotes, permitDocuments, permitStatusOptions, phaseOptions, phaseTaskListCardRef, phaseTotals,
    project, projectDeskOpen, projectDeskSteps, projectDraft, projectId, projectOverviewOpen, projectOverviewRange, projectOverviewSections, projectOverviewTotals, projectPhotosSection, projectTotals,
    purchaseUnitOptions, receiptDraftByStep, receiptEditorOpenByStep, receiptEditorRefByStepId, receiptMetricsByStepId, receiptRowRefByDocId,
    recoveryJobId, recoveryPolling, recoveryReportJson, recoveryReportOpen, recoveryStagedCount, recoveryStagedRoot, recoveryStatus,
    refreshingActualCostByStepId, renderCurrencyInputValue, renderDocumentGallery, replaceFileInputByDocId, replacingDocumentId, requestConfirmation, resetLightboxZoom,
    saveInlineReceiptEdit, savePhaseDateRange, saveStepEditModal, saving, savingNoteId, selectableDocSteps, selectTopbarSearchResult, selectedContactAssignments, selectedDeskContact,
    setActiveTab, setAiToolsOpen, setAttachExistingDocByReceiptId, setAttachExistingDocFilterByReceiptId, setAttachExistingDocByStepId, setAttachExistingDocFilterByStepId, setAttachExistingPickerOpenByStepId,
    setDependencyCandidateByStepId, setDeskAssignmentPhaseKey, setDeskAssignmentStepId, setDeskContactDraft, setDeskContactQuery, setDeskContactTypeFilter, setDeskCreateMode, setDeskSelectedContactId,
    setDocKind, setDocPhaseKey, setDocStepId, setDocumentManagerKindFilter, setDocumentManagerPhaseFilter, setDocumentManagerQuery, setDocumentManagerStepFilter,
    setDocumentUploadBusy, setDocumentUploadFile, setDocumentUploadModalOpen, setDragOverInsertIndex, setDragOverParentStepId, setEditingNoteTextById, setEditingReceiptDocumentIdByStep, setExpandedStepById,
    setInlineReceiptDraftByDocId, setLightboxSpreadsheetSheetIndex, setLotSizeInput, setMoveStepModalStepId, setMoveStepModalTargetTab, setMoveTaskModalDocId, setMoveTaskModalTargetStepId,
    setNoteDraftByStep, setNoteEditorOpenByStep, setProjectDeskOpen, setProjectDraft, setProjectOverviewOpen, setReceiptAttachmentDraftByStep, setReceiptDraftByStep, setReceiptEditorOpenByStep,
    setRecoveryJobId, setRecoveryPolling, setRecoveryReportJson, setRecoveryReportOpen, setRecoveryStatus, setStepCardAssigneeIdFilter, setStepCardAssigneeTypeFilter, setStepCardTextFilter,
    setStepContactCandidateByStepId, setStepContactPickerOpenByStepId, setStepInfoModalStepId, setTaskAttachmentsModalDocId, setTopbarSearchOpen, setTopbarSearchQuery,
    startCurrencyEdit, startInlineReceiptEdit, stepAssigneesByStepId, stepById, stepByIdMap, stepCardAssigneeIdFilter, stepCardAssigneeTypeFilter, stepCardTextFilter, stepCardTextFilterTokens,
    stepContactCandidateByStepId, stepContactPickerOpenByStepId, stepCostTotalExcludingQuotes, stepDrafts, stepEditModalDependencyIds, stepEditModalDependencyOptions, stepEditModalDraft, stepEditModalStep,
    stepEditSaving, stepFilterContactOptions, stepInfoModalStep, stepPhaseBucket, stepSearchTextById, stepUsesManualDateOverride: taskUsesManualDateOverride,
    stickyHeadHeight, stickyHeadRef, stickyTopOffset, steps, taskAttachmentsModalAttachableDocuments, taskAttachmentsModalDoc, taskAttachmentsModalStep,
    taskTypeOptions: TASK_TYPE_OPTIONS, taskUsesManualDateOverride, taskVendorOptions, toNumberOrNull, toStringOrNull, toggleStep,
    topbarSearchBoxRef, topbarSearchLoading, topbarSearchOpen, topbarSearchQuery, topbarSearchResults, updateDocumentDraft, updateProject, updateStepDraft, uploadDocument,
    verifiedActualCostSignatureByStepId, zoomLightboxBy,
  };
  const { buildWorkspaceProps, workspaceModalProps } = useBuildWizardWorkspaceComposedProps(workspaceComposedOptions);

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
