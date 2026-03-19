import React from 'react';

import { IBuildWizardContentSearchResult } from '../../types/buildWizard';
import { IBuildWizardDropdownSettings } from '../../types/buildWizardDropdowns';
import { BuildTabId, DocumentDraftMap, StepDraftMap, WizardView } from '../../types/pages/buildWizardPage';
import { DEFAULT_BUILD_WIZARD_DROPDOWN_SETTINGS } from '../buildWizardDropdownSettings';
import { lotSizeSqftToDisplayInput, parseUrlState } from '../../components/pages/build-wizard/buildWizardUtils';
import { BuildWizardContactType, BuildWizardTaskMeta, BuildWizardTaskType, InlineReceiptField, LightboxPreview } from './buildWizardPageRenderTypes';

export function useBuildWizardPageState(questionnaire: any) {
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
  const [deskContactDraft, setDeskContactDraft] = React.useState({
    display_name: '',
    email: '',
    phone: '',
    company: '',
    role_title: '',
    notes: '',
    contact_type: 'contact' as BuildWizardContactType,
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
  const [replacingDocumentId, setReplacingDocumentId] = React.useState<number>(0);

  const recoveryUploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const replaceFileInputByDocId = React.useRef<Record<number, HTMLInputElement | null>>({});
  const receiptEditorRefByStepId = React.useRef<Record<number, HTMLDivElement | null>>({});
  const receiptRowRefByDocId = React.useRef<Record<number, HTMLDivElement | null>>({});
  const clearedLegacyTaskDatesByProjectRef = React.useRef<Set<number>>(new Set());
  const stickyHeadRef = React.useRef<HTMLDivElement | null>(null);
  const phaseTaskListCardRef = React.useRef<HTMLDivElement | null>(null);
  const topbarSearchBoxRef = React.useRef<HTMLDivElement | null>(null);
  const previousActiveTabRef = React.useRef<BuildTabId>('start');

  return {
    activeCurrencyInputKey, activeTab, aiToolsOpen, attachExistingDocByReceiptId, attachExistingDocByStepId, attachExistingDocFilterByReceiptId,
    attachExistingDocFilterByStepId, attachExistingPickerOpenByStepId, buildEntryPoint, clearedLegacyTaskDatesByProjectRef, currencyInputByKey,
    deletingDocumentId, deletingNoteId, deletingProjectId, dependencyCandidateByStepId, deskAssignmentPhaseKey, deskAssignmentStepId,
    deskAutoAssignBusy, deskContactDraft, deskContactQuery, deskContactTypeFilter, deskCreateMode, deskSelectedContactId, docKind, docPhaseKey,
    docStepId, documentDrafts, documentManagerKindFilter, documentManagerPhaseFilter, documentManagerQuery, documentManagerSearchLoading,
    documentManagerSearchResults, documentManagerStepFilter, documentSavingId, documentUploadBusy, documentUploadFile, documentUploadModalOpen,
    dragOverInsertIndex, dragOverParentStepId, draggingStepId, dropdownSettings, editingNoteTextById, editingReceiptDocumentIdByStep, expandedStepById,
    footerRange, initialUrlState, inlineEditingReceiptFieldByDocId, inlineReceiptDraftByDocId, lightboxDoc, lightboxSpreadsheetSheetIndex,
    lightboxZoom, lotSizeInput, moveStepModalStepId, moveStepModalTargetTab, moveTaskModalDocId, moveTaskModalTargetStepId, movingStep,
    newHomeWastewaterKind, newHomeWaterKind, noteDraftByStep, noteEditorOpenByStep, pendingScrollReceiptId, phaseTaskListCardRef,
    previousActiveTabRef, projectDeskOpen, projectDraft, projectOverviewOpen, receiptAttachmentDraftByStep, receiptDraftByStep,
    receiptEditorOpenByStep, receiptEditorRefByStepId, receiptRowRefByDocId, recoveryJobId, recoveryPolling, recoveryReportJson,
    recoveryReportOpen, recoveryStagedCount, recoveryStagedRoot, recoveryStatus, recoveryUploadBusy, recoveryUploadInputRef, recoveryUploadToken,
    refreshingActualCostByStepId, replaceFileInputByDocId, replacingDocumentId, savingNoteId,
    setActiveCurrencyInputKey, setActiveTab, setAiToolsOpen, setAttachExistingDocByReceiptId, setAttachExistingDocByStepId,
    setAttachExistingDocFilterByReceiptId, setAttachExistingDocFilterByStepId, setAttachExistingPickerOpenByStepId, setBuildEntryPoint,
    setCurrencyInputByKey, setDeletingDocumentId, setDeletingNoteId, setDeletingProjectId, setDependencyCandidateByStepId,
    setDeskAssignmentPhaseKey, setDeskAssignmentStepId, setDeskAutoAssignBusy, setDeskContactDraft, setDeskContactQuery,
    setDeskContactTypeFilter, setDeskCreateMode, setDeskSelectedContactId, setDocKind, setDocPhaseKey, setDocStepId, setDocumentDrafts,
    setDocumentManagerKindFilter, setDocumentManagerPhaseFilter, setDocumentManagerQuery, setDocumentManagerSearchLoading,
    setDocumentManagerSearchResults, setDocumentManagerStepFilter, setDocumentSavingId, setDocumentUploadBusy, setDocumentUploadFile,
    setDocumentUploadModalOpen, setDragOverInsertIndex, setDragOverParentStepId, setDraggingStepId, setDropdownSettings,
    setEditingNoteTextById, setEditingReceiptDocumentIdByStep, setExpandedStepById, setFooterRange, setLightboxDoc,
    setLightboxSpreadsheetSheetIndex, setLightboxZoom, setLotSizeInput, setMoveStepModalStepId, setMoveStepModalTargetTab, setMoveTaskModalDocId,
    setMoveTaskModalTargetStepId, setMovingStep, setNewHomeWastewaterKind, setNewHomeWaterKind, setNoteDraftByStep, setNoteEditorOpenByStep,
    setPendingScrollReceiptId, setProjectDeskOpen, setProjectDraft, setProjectOverviewOpen, setReceiptAttachmentDraftByStep, setReceiptDraftByStep,
    setReceiptEditorOpenByStep, setRecoveryJobId, setRecoveryPolling, setRecoveryReportJson, setRecoveryReportOpen, setRecoveryStagedCount,
    setRecoveryStagedRoot, setRecoveryStatus, setRecoveryUploadBusy, setRecoveryUploadToken, setRefreshingActualCostByStepId,
    setReplacingDocumentId, setSavingNoteId, setStepCardAssigneeIdFilter, setStepCardAssigneeTypeFilter, setStepCardTextFilter,
    setStepContactCandidateByStepId, setStepContactPickerOpenByStepId, setStepDrafts, setStepEditModalStepId, setStepEditSaving,
    setStepInfoModalStepId, setStickyHeadHeight, setStickyTopOffset, setTaskAttachmentsModalDocId, setTopbarSearchDocumentResults,
    setTopbarSearchFocusStepId, setTopbarSearchLoading, setTopbarSearchOpen, setTopbarSearchQuery, setUnlinkingDocumentId,
    setVerifiedActualCostSignatureByStepId, stepCardAssigneeIdFilter, stepCardAssigneeTypeFilter, stepCardTextFilter,
    stepContactCandidateByStepId, stepContactPickerOpenByStepId, stepDrafts, stepEditModalStepId, stepEditSaving, stepInfoModalStepId,
    stickyHeadHeight, stickyHeadRef, stickyTopOffset, taskAttachmentsModalDocId, topbarSearchBoxRef, topbarSearchDocumentResults,
    topbarSearchFocusStepId, topbarSearchLoading, topbarSearchOpen, topbarSearchQuery, unlinkingDocumentId, verifiedActualCostSignatureByStepId,
    view, setView,
  };
}
