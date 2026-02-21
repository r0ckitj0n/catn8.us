import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';
import { StandardIconLink } from '../../components/common/StandardIconLink';
import { WebpImage } from '../../components/common/WebpImage';
import { ApiClient } from '../ApiClient';
import { useBuildWizard } from '../../hooks/useBuildWizard';
import { IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
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
  stepCostTotal,
} from '../../components/pages/build-wizard/buildWizardConstants';
import {
  calculateDurationDays,
  detectLotSizeUnit,
  fileExtensionFromName,
  formatCurrency,
  formatDate,
  formatTimelineDate,
  getDefaultRange,
  isPdfDocument,
  lotSizeInputToSqftAuto,
  lotSizeSqftToDisplayInput,
  parseDate,
  parseUrlState,
  prettyPhaseLabel,
  pushUrlState,
  sortAlpha,
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

type LightboxPreview =
  | { mode: 'image'; src: string; title: string }
  | { mode: 'loading'; src: string; title: string }
  | { mode: 'spreadsheet'; src: string; title: string; sheets: SpreadsheetPreviewSheet[]; truncated: boolean }
  | { mode: 'plan'; src: string; title: string; text: string; truncated: boolean; format: 'text' | 'hex' }
  | { mode: 'error'; src: string; title: string; message: string };

export function renderBuildWizardPage({ onToast, isAdmin }: BuildWizardPageProps) {
  const {
    aiBusy,
    recoveryBusy,
    projectId,
    projects,
    project,
    questionnaire,
    updateProject,
    steps,
    documents,
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
    uploadDocument,
    replaceDocument,
    deleteDocument,
    updateDocument,
    findPurchaseOptions,
    packageForAi,
    generateStepsFromAi,
    recoverSingletreeDocuments,
    fetchSingletreeRecoveryStatus,
    stageSingletreeSourceFiles,
  } = useBuildWizard(onToast);

  const initialUrlState = React.useMemo(() => parseUrlState(), []);
  const [view, setView] = React.useState<WizardView>(initialUrlState.view);
  const [activeTab, setActiveTab] = React.useState<BuildTabId>('start');
  const [docKind, setDocKind] = React.useState<string>('blueprint');
  const [docPhaseKey, setDocPhaseKey] = React.useState<string>('general');
  const [docStepId, setDocStepId] = React.useState<number>(0);
  const [dropdownSettings, setDropdownSettings] = React.useState<IBuildWizardDropdownSettings>(DEFAULT_BUILD_WIZARD_DROPDOWN_SETTINGS);
  const [projectDraft, setProjectDraft] = React.useState(questionnaire);
  const [lotSizeInput, setLotSizeInput] = React.useState<string>(lotSizeSqftToDisplayInput(questionnaire.lot_size_sqft));
  const [stepDrafts, setStepDrafts] = React.useState<StepDraftMap>({});
  const [noteDraftByStep, setNoteDraftByStep] = React.useState<Record<number, string>>({});
  const [noteEditorOpenByStep, setNoteEditorOpenByStep] = React.useState<Record<number, boolean>>({});
  const [footerRange, setFooterRange] = React.useState<{ start: string; end: string }>({ start: '', end: '' });
  const [lightboxDoc, setLightboxDoc] = React.useState<LightboxPreview | null>(null);
  const [lightboxSpreadsheetSheetIndex, setLightboxSpreadsheetSheetIndex] = React.useState<number>(0);
  const [documentManagerOpen, setDocumentManagerOpen] = React.useState<boolean>(false);
  const [documentManagerKindFilter, setDocumentManagerKindFilter] = React.useState<string>('all');
  const [documentManagerPhaseFilter, setDocumentManagerPhaseFilter] = React.useState<string>('all');
  const [projectDeskOpen, setProjectDeskOpen] = React.useState<boolean>(false);
  const [documentDrafts, setDocumentDrafts] = React.useState<DocumentDraftMap>({});
  const [documentSavingId, setDocumentSavingId] = React.useState<number>(0);
  const [deletingDocumentId, setDeletingDocumentId] = React.useState<number>(0);
  const [deletingProjectId, setDeletingProjectId] = React.useState<number>(0);
  const [findingStepId, setFindingStepId] = React.useState<number>(0);
  const [purchaseOptionsByStep, setPurchaseOptionsByStep] = React.useState<Record<number, Array<any>>>({});
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
  const [expandedStepOrderSelectId, setExpandedStepOrderSelectId] = React.useState<number>(0);
  const recoveryUploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const replaceFileInputByDocId = React.useRef<Record<number, HTMLInputElement | null>>({});
  const stickyHeadRef = React.useRef<HTMLDivElement | null>(null);
  const [replacingDocumentId, setReplacingDocumentId] = React.useState<number>(0);

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

  const phaseTotals = React.useMemo(() => {
    if (!PHASE_PROGRESS_ORDER.includes(activeTab)) {
      return { phaseTotal: 0, projectToDateTotal: 0 };
    }

    const phaseOrderIndex = PHASE_PROGRESS_ORDER.indexOf(activeTab);
    const phaseTotal = filteredTabSteps.reduce((sum, step) => sum + stepCostTotal(step), 0);
    const projectToDateTotal = steps.reduce((sum, step) => {
      const stepPhase = stepPhaseBucket(step);
      const stepOrderIndex = PHASE_PROGRESS_ORDER.indexOf(stepPhase);
      if (stepOrderIndex >= 0 && stepOrderIndex <= phaseOrderIndex) {
        return sum + stepCostTotal(step);
      }
      return sum;
    }, 0);

    return { phaseTotal, projectToDateTotal };
  }, [activeTab, filteredTabSteps, steps]);

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
    const totalEstimated = steps.reduce((sum, s) => sum + (Number(s.estimated_cost) || 0), 0);
    const totalActual = steps.reduce((sum, s) => sum + (Number(s.actual_cost) || 0), 0);
    const doneCount = steps.filter((s) => Number(s.is_completed) === 1).length;
    return {
      totalEstimated,
      totalActual,
      doneCount,
      totalCount: steps.length,
    };
  }, [steps]);

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

    const spentActual = steps.reduce((sum, s) => sum + Math.max(0, Number(s.actual_cost) || 0), 0);
    const projectedTotal = steps.reduce((sum, s) => {
      const actual = Number(s.actual_cost);
      if (Number.isFinite(actual) && actual > 0) {
        return sum + actual;
      }
      return sum + Math.max(0, Number(s.estimated_cost) || 0);
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
  }, [project?.target_completion_date, project?.target_start_date, steps]);

  const projectDocuments = React.useMemo(() => {
    return documents.filter((d) => !d.step_id || Number(d.step_id) <= 0);
  }, [documents]);

  const permitDocuments = React.useMemo(() => {
    return documents
      .filter((d) => String(d.kind || '') === 'permit')
      .sort((a, b) => sortAlpha(String(a.original_name || ''), String(b.original_name || '')));
  }, [documents]);

  const permitUsageByDocumentId = React.useMemo(() => {
    const usage = new Map<number, number>();
    steps.forEach((step) => {
      const permitDocumentId = Number(step.permit_document_id || 0);
      if (permitDocumentId <= 0) {
        return;
      }
      usage.set(permitDocumentId, (usage.get(permitDocumentId) || 0) + 1);
    });
    return usage;
  }, [steps]);

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
    return [...steps].sort((a, b) => {
      const aLabel = `${prettyPhaseLabel(a.phase_key)} ${a.title}`;
      const bLabel = `${prettyPhaseLabel(b.phase_key)} ${b.title}`;
      return sortAlpha(aLabel, bLabel);
    });
  }, [steps]);

  const documentManagerKindOptions = React.useMemo(() => {
    const fromDocs = documents
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

  const filteredDocumentManagerDocs = React.useMemo(() => {
    return documents.filter((doc) => {
      const docKindValue = String(doc.kind || '').trim();
      if (documentManagerKindFilter !== 'all' && docKindValue !== documentManagerKindFilter) {
        return false;
      }
      const docPhaseValue = String(doc.step_phase_key || '').trim() || 'general';
      if (documentManagerPhaseFilter !== 'all' && docPhaseValue !== documentManagerPhaseFilter) {
        return false;
      }
      return true;
    });
  }, [documents, documentManagerKindFilter, documentManagerPhaseFilter]);

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
    if (!documentManagerOpen) {
      return;
    }
    const nextDrafts: DocumentDraftMap = {};
    documents.forEach((doc) => {
      nextDrafts[doc.id] = {
        kind: doc.kind || 'other',
        caption: doc.caption || '',
        step_id: Number(doc.step_id || 0),
      };
    });
    setDocumentDrafts(nextDrafts);
    setDocumentManagerKindFilter('all');
    setDocumentManagerPhaseFilter('all');
  }, [documentManagerOpen, documents]);

  const openBuild = async (nextProjectId: number) => {
    await openProject(nextProjectId);
    setActiveTab('overview');
    setView('build');
    pushUrlState('build', nextProjectId);
  };

  const onCreateNewBuild = async () => {
    const today = toIsoDate(new Date());
    const nextId = await createProject(`New Home Plan ${today}`, 'blank');
    if (nextId > 0) {
      setActiveTab('start');
      setView('build');
      pushUrlState('build', nextId);
    }
  };

  const onBackToLauncher = () => {
    setView('launcher');
    pushUrlState('launcher', null);
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

  const onSubmitNote = async (step: IBuildWizardStep): Promise<boolean> => {
    const draft = String(noteDraftByStep[step.id] || '').trim();
    if (!draft) {
      return false;
    }
    await addStepNote(step.id, draft);
    setNoteDraftByStep((prev) => ({ ...prev, [step.id]: '' }));
    return true;
  };

  const onDeleteDocument = async (docId: number, docName: string) => {
    if (docId <= 0 || deletingDocumentId === docId) {
      return;
    }
    const confirmed = window.confirm(`Delete "${docName}"? This cannot be undone.`);
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

  const openDocumentPreview = React.useCallback(async (doc: IBuildWizardDocument) => {
    const src = String(doc.public_url || '').trim();
    const title = String(doc.original_name || 'Document');
    if (!src) {
      onToast?.({ tone: 'error', message: `Unable to open ${title}` });
      return;
    }

    if (Number(doc.is_image) === 1) {
      setLightboxDoc({ mode: 'image', src, title });
      return;
    }

    if (!isSpreadsheetPreviewDoc(doc) && !isPlanPreviewDoc(doc)) {
      window.open(src, '_blank', 'noopener,noreferrer');
      return;
    }

    setLightboxDoc({ mode: 'loading', src, title });
    setLightboxSpreadsheetSheetIndex(0);

    try {
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
  }, [isPlanPreviewDoc, isSpreadsheetPreviewDoc, onToast]);

  const onDeleteProject = async (projectSummary: { id: number; title: string }) => {
    if (deletingProjectId === projectSummary.id || projectSummary.id <= 0) {
      return;
    }
    const confirmed = window.confirm(
      `Delete "${projectSummary.title}"?\n\nThis will permanently purge this project and all related records from the database.`,
    );
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

  const onRunSingletreeRecovery = async (apply: boolean) => {
    if (!isAdmin) {
      return;
    }
    if (recoveryBusy) {
      return;
    }
    if (apply) {
      const confirmed = window.confirm(
        'Apply Singletree recovery now?\n\nThis will write document mappings/blobs for "Cabin - 91 Singletree Ln".',
      );
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

  const onSaveDocument = async (documentId: number, patch: { kind?: string; caption?: string | null; step_id?: number | null }) => {
    if (documentSavingId === documentId) {
      return;
    }
    setDocumentSavingId(documentId);
    try {
      await updateDocument(documentId, patch);
    } finally {
      setDocumentSavingId(0);
    }
  };

  const updateDocumentDraft = (documentId: number, patch: Partial<{ kind: string; caption: string; step_id: number }>) => {
    setDocumentDrafts((prev) => ({
      ...prev,
      [documentId]: {
        kind: patch.kind ?? (prev[documentId]?.kind || 'other'),
        caption: patch.caption ?? (prev[documentId]?.caption || ''),
        step_id: patch.step_id ?? (prev[documentId]?.step_id || 0),
      },
    }));
  };

  const onSaveDocumentDraft = async (doc: IBuildWizardDocument) => {
    const draft = documentDrafts[doc.id] || { kind: doc.kind || 'other', caption: doc.caption || '', step_id: Number(doc.step_id || 0) };
    await onSaveDocument(doc.id, {
      kind: draft.kind,
      caption: draft.caption.trim() || null,
      step_id: draft.step_id > 0 ? draft.step_id : null,
    });
  };

  const onFindPurchase = async (step: IBuildWizardStep) => {
    if (findingStepId === step.id) {
      return;
    }
    setFindingStepId(step.id);
    try {
      const draft = stepDrafts[step.id] || step;
      const res = await findPurchaseOptions(step.id, draft.purchase_url || '');
      if (!res) {
        return;
      }
      setPurchaseOptionsByStep((prev) => ({ ...prev, [step.id]: res.options || [] }));
      if (res.step) {
        setStepDrafts((prev) => ({ ...prev, [step.id]: { ...res.step! } }));
      }
      if (!res.options.length) {
        onToast?.({ tone: 'warning', message: 'No product options found for this step.' });
      }
    } finally {
      setFindingStepId(0);
    }
  };

  const onUsePurchaseOption = async (step: IBuildWizardStep, option: any) => {
    const patch: Partial<IBuildWizardStep> = {
      title: option.title || step.title,
      purchase_url: option.url || null,
      purchase_vendor: option.vendor || null,
      purchase_unit_price: typeof option.unit_price === 'number' ? option.unit_price : (step.purchase_unit_price ?? null),
      purchase_brand: step.purchase_brand || null,
      purchase_model: step.purchase_model || null,
    };
    updateStepDraft(step.id, patch);
    await commitStep(step.id, patch);
  };

  const onEstimateMissingWithAi = async () => {
    const confirmed = window.confirm('Ask AI to estimate missing timeline and budget values for this project?');
    if (!confirmed) {
      return;
    }
    await generateStepsFromAi('fill_missing');
  };

  const onCompleteWithAi = async () => {
    const confirmed = window.confirm(
      'Run Complete w/ AI?\n\nThis can reorder/add/update steps across phases using your project data and documents.',
    );
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
    const withoutDragged = flatIds.filter((id) => id !== draggingStepId);
    const boundedInsertIndex = Math.max(0, Math.min(insertIndex, withoutDragged.length));
    withoutDragged.splice(boundedInsertIndex, 0, draggingStepId);

    const activePhaseKey = TAB_DEFAULT_PHASE_KEY[activeTab] || 'general';
    try {
      const draggedStep = stepById.get(draggingStepId);
      if (draggedStep && Number(draggedStep.parent_step_id || 0) > 0) {
        await updateStep(draggingStepId, { parent_step_id: null });
      }
      await reorderSteps(activePhaseKey, withoutDragged);
    } finally {
      clearStepDragState();
    }
  };

  const onReorderStepByDisplayNumber = async (stepId: number, targetDisplayNumber: number) => {
    if (stepId <= 0 || targetDisplayNumber <= 0) {
      return;
    }
    const flatIds = activeTabTreeRows.map((row) => row.step.id);
    const currentIndex = flatIds.indexOf(stepId);
    if (currentIndex < 0) {
      return;
    }
    const boundedTargetIndex = Math.max(0, Math.min(targetDisplayNumber - 1, flatIds.length - 1));
    if (boundedTargetIndex === currentIndex) {
      return;
    }
    const reorderedIds = [...flatIds];
    reorderedIds.splice(currentIndex, 1);
    reorderedIds.splice(boundedTargetIndex, 0, stepId);

    const activePhaseKey = TAB_DEFAULT_PHASE_KEY[activeTab] || 'general';
    const step = stepById.get(stepId);
    if (step && Number(step.parent_step_id || 0) > 0) {
      await updateStep(stepId, { parent_step_id: null });
    }
    await reorderSteps(activePhaseKey, reorderedIds);
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

    const activePhaseKey = TAB_DEFAULT_PHASE_KEY[activeTab] || 'general';
    const withoutDragged = flatIds.filter((id) => id !== draggingStepId);
    const targetIndex = withoutDragged.indexOf(targetStepId);
    const insertIndex = targetIndex >= 0 ? (targetIndex + 1) : withoutDragged.length;
    withoutDragged.splice(insertIndex, 0, draggingStepId);

    try {
      await updateStep(draggingStepId, { parent_step_id: targetStepId });
      await reorderSteps(activePhaseKey, withoutDragged);
    } finally {
      clearStepDragState();
    }
  };

  const renderEditableStepCards = (tabSteps: IBuildWizardStep[]) => {
    if (!tabSteps.length) {
      return <div className="build-wizard-muted">No steps in this tab yet.</div>;
    }
    const rows = activeTabTreeRows;

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
        {rows.map((row, rowIndex) => {
          const step = row.step;
          const stepReadOnly = Number(step.is_completed) === 1;
          const stepDisplayNumber = activeTabStepNumbers.get(step.id) || step.step_order;
          const draft = stepDrafts[step.id] || step;
          const parentStep = Number(draft.parent_step_id || 0) > 0 ? stepById.get(Number(draft.parent_step_id || 0)) : null;
          const childDateMin = parentStep?.expected_start_date || undefined;
          const childDateMax = parentStep?.expected_end_date || undefined;
          const incompleteDescendantCount = incompleteDescendantCountByStepId.get(step.id) || 0;
          const completionLocked = Number(step.is_completed) !== 1 && incompleteDescendantCount > 0;
          const durationDays = calculateDurationDays(draft.expected_start_date, draft.expected_end_date)
            ?? (draft.expected_duration_days ?? null);
          const aiEstimated = new Set(Array.isArray(draft.ai_estimated_fields) ? draft.ai_estimated_fields : []);
          const dependencyTitles = (Array.isArray(draft.depends_on_step_ids) ? draft.depends_on_step_ids : [])
            .map((id) => steps.find((candidate) => candidate.id === id))
            .filter((dependency): dependency is IBuildWizardStep => Boolean(dependency))
            .map((dependency) => `#${activeTabStepNumbers.get(dependency.id) || dependency.step_order} ${dependency.title}`);
          return (
            <React.Fragment key={step.id}>
            <div
              className={`build-wizard-step ${row.level > 0 ? 'is-child' : ''} ${dragOverParentStepId === step.id ? 'is-parent-target' : ''} ${stepReadOnly ? 'is-readonly' : ''}`}
              style={{ '--bw-indent-level': String(row.level) } as React.CSSProperties}
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
              <div className="build-wizard-step-phase-accent" style={{ background: TAB_PHASE_COLORS[stepPhaseBucket(step)] }} />
	          <div className="build-wizard-step-header">
	            <div className="build-wizard-step-header-left">
                  <button
                    type="button"
                    className="build-wizard-step-drag-handle"
                    title="Drag to reorder"
                    aria-label="Drag to reorder"
                    draggable={!stepReadOnly}
                    disabled={stepReadOnly}
                    onDragStart={(e) => {
                      if (stepReadOnly) {
                        return;
                      }
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingStepId(step.id);
                    }}
                    onDragEnd={() => clearStepDragState()}
                  >
                    <span aria-hidden="true">⋮⋮</span>
                  </button>
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
	                    <select
	                      className={`build-wizard-step-order-select ${expandedStepOrderSelectId === step.id ? 'is-expanded' : ''}`}
	                      value={String(stepDisplayNumber)}
                        disabled={stepReadOnly}
	                      onChange={(e) => {
	                        const targetDisplayNumber = Number(e.target.value || '0');
	                        if (targetDisplayNumber > 0) {
	                          void onReorderStepByDisplayNumber(step.id, targetDisplayNumber);
	                        }
	                      }}
	                      onFocus={() => setExpandedStepOrderSelectId(step.id)}
	                      onBlur={() => setExpandedStepOrderSelectId((prev) => (prev === step.id ? 0 : prev))}
	                      title="Move this step to a different step number"
	                      aria-label={`Step number for ${step.title}`}
	                    >
	                      {rows.map((optionRow, optionIndex) => (
	                        <option key={optionRow.step.id} value={String(optionIndex + 1)}>
	                          {expandedStepOrderSelectId === step.id ? `#${optionIndex + 1} ${optionRow.step.title}` : `#${optionIndex + 1}`}
	                        </option>
	                      ))}
	                    </select>
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
                    <label className="build-wizard-duration-inline">
                      Duration (Days)
                      <input type="number" value={durationDays ?? ''} readOnly />
                    </label>
                    <label className="build-wizard-date-inline">
                      Start {aiEstimated.has('expected_start_date') ? '*' : ''}
                      <input
                        type="date"
                        value={draft.expected_start_date || ''}
                        min={childDateMin}
                        max={childDateMax}
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
                          const nextDuration = calculateDurationDays(nextStartDate, nextDraft.expected_end_date)
                            ?? (nextDraft.expected_duration_days ?? null);
                          void commitStep(step.id, {
                            expected_start_date: nextStartDate,
                            expected_duration_days: nextDuration,
                          });
                        }}
                      />
                    </label>
                    <label className="build-wizard-date-inline">
                      End {aiEstimated.has('expected_end_date') ? '*' : ''}
                      <input
                        type="date"
                        value={draft.expected_end_date || ''}
                        min={childDateMin}
                        max={childDateMax}
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
                          const nextEndDate = toStringOrNull(nextDraft.expected_end_date || '');
                          const nextDuration = calculateDurationDays(nextDraft.expected_start_date, nextEndDate)
                            ?? (nextDraft.expected_duration_days ?? null);
                          void commitStep(step.id, {
                            expected_end_date: nextEndDate,
                            expected_duration_days: nextDuration,
                          });
                        }}
                      />
                    </label>
                    <label className="build-wizard-date-inline">
                      Type
                      <select
                        value={(draft.step_type || 'construction') as StepType}
                        onChange={(e) => {
                          const nextType = e.target.value as StepType;
                          const previousSameType = [...steps]
                            .filter((candidate) => candidate.id !== step.id && ((stepDrafts[candidate.id]?.step_type || candidate.step_type) === nextType))
                            .sort((a, b) => {
                              if (a.step_order !== b.step_order) {
                                return b.step_order - a.step_order;
                              }
                              return b.id - a.id;
                            })[0];
                          const previousDraft = previousSameType ? (stepDrafts[previousSameType.id] || previousSameType) : null;
                          const nextPatch: Partial<IBuildWizardStep> = {
                            step_type: nextType,
                          };
                          if (previousDraft) {
                            if (nextType === 'construction') {
                              nextPatch.permit_required = Number(previousDraft.permit_required) === 1 ? 1 : 0;
                              nextPatch.permit_document_id = previousDraft.permit_document_id ?? null;
                              nextPatch.permit_name = previousDraft.permit_name ?? null;
                              nextPatch.permit_authority = previousDraft.permit_authority ?? null;
                              nextPatch.permit_status = previousDraft.permit_status ?? null;
                              nextPatch.permit_application_url = previousDraft.permit_application_url ?? null;
                            } else if (nextType === 'purchase') {
                              nextPatch.purchase_category = previousDraft.purchase_category ?? null;
                              nextPatch.purchase_vendor = previousDraft.purchase_vendor ?? null;
                              nextPatch.purchase_unit = previousDraft.purchase_unit ?? null;
                            } else if (nextType === 'utility') {
                              nextPatch.purchase_vendor = previousDraft.purchase_vendor ?? null;
                              nextPatch.purchase_url = previousDraft.purchase_url ?? null;
                              nextPatch.source_ref = previousDraft.source_ref ?? null;
                            } else if (nextType === 'delivery') {
                              nextPatch.purchase_vendor = previousDraft.purchase_vendor ?? null;
                              nextPatch.source_ref = previousDraft.source_ref ?? null;
                            }
                          }
                          if (nextType !== 'construction') {
                            nextPatch.permit_required = 0;
                            nextPatch.permit_document_id = null;
                            nextPatch.permit_name = null;
                            nextPatch.permit_authority = null;
                            nextPatch.permit_status = null;
                            nextPatch.permit_application_url = null;
                          }
                          updateStepDraft(step.id, nextPatch);
                          void commitStep(step.id, nextPatch);
                        }}
                      >
                        {STEP_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <div className="build-wizard-step-header-right">
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
                      const ok = window.confirm('Delete this step?');
                      if (ok) {
                        void deleteStep(step.id);
                      }
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                  <span className="build-wizard-meta-chip">Completed At: {formatDate(step.completed_at)}</span>
                </div>
              </div>

              <fieldset className="build-wizard-step-fields" disabled={stepReadOnly}>
              <div className="build-wizard-step-grid">
                {dependencyTitles.length ? (
                  <div className="build-wizard-type-note">Depends on: {dependencyTitles.join(', ')}</div>
                ) : null}
                {parentStep ? (
                  <div className="build-wizard-type-note">Child of: #{activeTabStepNumbers.get(parentStep.id) || parentStep.step_order} {parentStep.title}</div>
                ) : null}
                <label>
                  Step Title
                  <input
                    type="text"
                    value={draft.title || ''}
                    onChange={(e) => updateStepDraft(step.id, { title: e.target.value })}
                    onBlur={() => void commitStep(step.id, { title: String(stepDrafts[step.id]?.title || '').trim() })}
                  />
                </label>
                {draft.step_type === 'construction' ? (
                  <label>
                    Permit Required
                    <select
                      value={Number(draft.permit_required) === 1 ? '1' : '0'}
                      onChange={(e) => {
                        const next = e.target.value === '1' ? 1 : 0;
                        const nextPatch: Partial<IBuildWizardStep> = { permit_required: next };
                        if (next !== 1) {
                          nextPatch.permit_document_id = null;
                          nextPatch.permit_name = null;
                          nextPatch.permit_authority = null;
                          nextPatch.permit_status = null;
                          nextPatch.permit_application_url = null;
                        }
                        updateStepDraft(step.id, nextPatch);
                        void commitStep(step.id, nextPatch);
                      }}
                    >
                      <option value="0">No</option>
                      <option value="1">Yes</option>
                    </select>
                  </label>
                ) : null}
                {draft.step_type === 'construction' && Number(draft.permit_required) === 1 ? (
                  <>
                    <label>
                      Saved Permit
                      <select
                        value={Number(draft.permit_document_id || 0) > 0 ? String(draft.permit_document_id) : ''}
                        onChange={(e) => {
                          const permitDocumentId = Number(e.target.value || '0');
                          const selectedPermitDoc = permitDocuments.find((doc) => doc.id === permitDocumentId);
                          const nextPatch: Partial<IBuildWizardStep> = {
                            permit_document_id: permitDocumentId > 0 ? permitDocumentId : null,
                            permit_name: permitDocumentId > 0 ? (selectedPermitDoc?.original_name || draft.permit_name || null) : null,
                            permit_application_url: permitDocumentId > 0 ? (selectedPermitDoc?.public_url || draft.permit_application_url || null) : null,
                          };
                          updateStepDraft(step.id, nextPatch);
                          void commitStep(step.id, nextPatch);
                        }}
                      >
                        <option value="">Select permit</option>
                        {permitDocuments.map((doc) => {
                          const usageCount = permitUsageByDocumentId.get(doc.id) || 0;
                          const currentDocId = Number(draft.permit_document_id || 0);
                          const usedElsewhere = usageCount > 0 && currentDocId !== doc.id;
                          return (
                            <option key={doc.id} value={doc.id}>
                              {usedElsewhere ? '✓ ' : ''}{doc.original_name}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    {permitDocuments.length ? (
                      <div className="build-wizard-permit-usage-note">✓ means this permit is already linked to another step.</div>
                    ) : (
                      <div className="build-wizard-permit-usage-note">Upload permit documents first to pick from saved permits.</div>
                    )}
                    <label>
                      Authority
                      <input
                        type="text"
                        value={draft.permit_authority || ''}
                        onChange={(e) => updateStepDraft(step.id, { permit_authority: e.target.value })}
                        onBlur={() => void commitStep(step.id, { permit_authority: toStringOrNull(stepDrafts[step.id]?.permit_authority || '') })}
                      />
                    </label>
                    <label>
                      Permit Status
                      <select
                        value={draft.permit_status || ''}
                        onChange={(e) => updateStepDraft(step.id, { permit_status: e.target.value || null })}
                        onBlur={() => void commitStep(step.id, { permit_status: toStringOrNull(stepDrafts[step.id]?.permit_status || '') })}
                      >
                        {permitStatusOptions.map((status) => (
                          <option key={status} value={status}>{status === '' ? 'Select status' : status}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Permit URL
                      <input
                        type="url"
                        value={draft.permit_application_url || ''}
                        onChange={(e) => updateStepDraft(step.id, { permit_application_url: e.target.value })}
                        onBlur={() => void commitStep(step.id, { permit_application_url: toStringOrNull(stepDrafts[step.id]?.permit_application_url || '') })}
                      />
                    </label>
                  </>
                ) : null}
                {draft.step_type === 'purchase' ? (
                  <>
                    <label>
                      Category
                      <input
                        type="text"
                        value={draft.purchase_category || ''}
                        onChange={(e) => updateStepDraft(step.id, { purchase_category: e.target.value })}
                        onBlur={() => void commitStep(step.id, { purchase_category: toStringOrNull(stepDrafts[step.id]?.purchase_category || '') })}
                      />
                    </label>
                    <label>
                      Brand
                      <input
                        type="text"
                        value={draft.purchase_brand || ''}
                        onChange={(e) => updateStepDraft(step.id, { purchase_brand: e.target.value })}
                        onBlur={() => void commitStep(step.id, { purchase_brand: toStringOrNull(stepDrafts[step.id]?.purchase_brand || '') })}
                      />
                    </label>
                    <label>
                      Model
                      <input
                        type="text"
                        value={draft.purchase_model || ''}
                        onChange={(e) => updateStepDraft(step.id, { purchase_model: e.target.value })}
                        onBlur={() => void commitStep(step.id, { purchase_model: toStringOrNull(stepDrafts[step.id]?.purchase_model || '') })}
                      />
                    </label>
                    <label>
                      SKU
                      <input
                        type="text"
                        value={draft.purchase_sku || ''}
                        onChange={(e) => updateStepDraft(step.id, { purchase_sku: e.target.value })}
                        onBlur={() => void commitStep(step.id, { purchase_sku: toStringOrNull(stepDrafts[step.id]?.purchase_sku || '') })}
                      />
                    </label>
                    <label>
                      Qty
                      <input
                        type="number"
                        step="0.01"
                        value={draft.purchase_qty ?? ''}
                        onChange={(e) => updateStepDraft(step.id, { purchase_qty: toNumberOrNull(e.target.value) })}
                        onBlur={() => void commitStep(step.id, { purchase_qty: toNumberOrNull(String(stepDrafts[step.id]?.purchase_qty ?? '')) })}
                      />
                    </label>
                    <label>
                      Unit
                      <select
                        value={draft.purchase_unit || ''}
                        onChange={(e) => updateStepDraft(step.id, { purchase_unit: e.target.value || null })}
                        onBlur={() => void commitStep(step.id, { purchase_unit: toStringOrNull(stepDrafts[step.id]?.purchase_unit || '') })}
                      >
                        {purchaseUnitOptions.map((unit) => (
                          <option key={unit} value={unit}>{unit === '' ? 'Select unit' : unit}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Unit Price
                      <input
                        type="number"
                        step="0.01"
                        value={draft.purchase_unit_price ?? ''}
                        onChange={(e) => updateStepDraft(step.id, { purchase_unit_price: toNumberOrNull(e.target.value) })}
                        onBlur={() => void commitStep(step.id, { purchase_unit_price: toNumberOrNull(String(stepDrafts[step.id]?.purchase_unit_price ?? '')) })}
                      />
                    </label>
                    <label>
                      Vendor
                      <input
                        type="text"
                        value={draft.purchase_vendor || ''}
                        onChange={(e) => updateStepDraft(step.id, { purchase_vendor: e.target.value })}
                        onBlur={() => void commitStep(step.id, { purchase_vendor: toStringOrNull(stepDrafts[step.id]?.purchase_vendor || '') })}
                      />
                    </label>
                    <label>
                      Product URL
                      <input
                        type="url"
                        value={draft.purchase_url || ''}
                        onChange={(e) => updateStepDraft(step.id, { purchase_url: e.target.value })}
                        onBlur={() => void commitStep(step.id, { purchase_url: toStringOrNull(stepDrafts[step.id]?.purchase_url || '') })}
                      />
                    </label>
                  </>
                ) : null}
                {draft.step_type === 'utility' ? (
                  <>
                    <label>
                      Utility Provider
                      <input
                        type="text"
                        value={draft.purchase_vendor || ''}
                        onChange={(e) => updateStepDraft(step.id, { purchase_vendor: e.target.value })}
                        onBlur={() => void commitStep(step.id, { purchase_vendor: toStringOrNull(stepDrafts[step.id]?.purchase_vendor || '') })}
                      />
                    </label>
                    <label>
                      Utility Account / Ref
                      <input
                        type="text"
                        value={draft.source_ref || ''}
                        onChange={(e) => updateStepDraft(step.id, { source_ref: e.target.value })}
                        onBlur={() => void commitStep(step.id, { source_ref: toStringOrNull(stepDrafts[step.id]?.source_ref || '') })}
                      />
                    </label>
                    <label>
                      Utility Portal URL
                      <input
                        type="url"
                        value={draft.purchase_url || ''}
                        onChange={(e) => updateStepDraft(step.id, { purchase_url: e.target.value })}
                        onBlur={() => void commitStep(step.id, { purchase_url: toStringOrNull(stepDrafts[step.id]?.purchase_url || '') })}
                      />
                    </label>
                  </>
                ) : null}
                {draft.step_type === 'delivery' ? (
                  <>
                    <label>
                      Delivery Vendor
                      <input
                        type="text"
                        value={draft.purchase_vendor || ''}
                        onChange={(e) => updateStepDraft(step.id, { purchase_vendor: e.target.value })}
                        onBlur={() => void commitStep(step.id, { purchase_vendor: toStringOrNull(stepDrafts[step.id]?.purchase_vendor || '') })}
                      />
                    </label>
                    <label>
                      Delivery Ref / Tracking
                      <input
                        type="text"
                        value={draft.source_ref || ''}
                        onChange={(e) => updateStepDraft(step.id, { source_ref: e.target.value })}
                        onBlur={() => void commitStep(step.id, { source_ref: toStringOrNull(stepDrafts[step.id]?.source_ref || '') })}
                      />
                    </label>
                  </>
                ) : null}
                {draft.step_type === 'photos' ? (
                  <div className="build-wizard-type-note">Photos step: upload site/progress images and keep notes minimal.</div>
                ) : null}
                {draft.step_type === 'blueprints' ? (
                  <div className="build-wizard-type-note">Blueprints step: upload plans/specs and mark a primary blueprint on the Start tab.</div>
                ) : null}
                {draft.step_type === 'milestone' ? (
                  <div className="build-wizard-type-note">Milestone step: keep title/date simple and mark complete when achieved.</div>
                ) : null}
                {draft.step_type === 'closeout' ? (
                  <div className="build-wizard-type-note">Closeout step: final docs, warranties, and handoff items.</div>
                ) : null}
                {['construction', 'purchase', 'inspection', 'permit', 'documentation', 'utility', 'delivery'].includes(draft.step_type) ? (
                  <>
                    <label>
                      Estimated Cost {aiEstimated.has('estimated_cost') ? '*' : ''}
                      <input
                        type="number"
                        step="0.01"
                        value={draft.estimated_cost ?? ''}
                        onChange={(e) => updateStepDraft(step.id, { estimated_cost: toNumberOrNull(e.target.value) })}
                        onBlur={() => void commitStep(step.id, { estimated_cost: toNumberOrNull(String(stepDrafts[step.id]?.estimated_cost ?? '')) })}
                      />
                    </label>
                    <label>
                      Actual Cost
                      <input
                        type="number"
                        step="0.01"
                        value={draft.actual_cost ?? ''}
                        onChange={(e) => updateStepDraft(step.id, { actual_cost: toNumberOrNull(e.target.value) })}
                        onBlur={() => void commitStep(step.id, { actual_cost: toNumberOrNull(String(stepDrafts[step.id]?.actual_cost ?? '')) })}
                      />
                    </label>
                  </>
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
                {draft.step_type === 'purchase' ? (
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => void onFindPurchase(step)}
                    disabled={findingStepId === step.id}
                  >
                    {findingStepId === step.id ? 'Finding...' : 'Find'}
                  </button>
                ) : null}
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
              </div>

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

              {draft.step_type === 'purchase' && (purchaseOptionsByStep[step.id] || []).length > 0 ? (
                <div className="build-wizard-purchase-options">
                  {(purchaseOptionsByStep[step.id] || []).map((opt: any, idx: number) => (
                    <div className="build-wizard-purchase-option" key={`${step.id}-opt-${idx}`}>
                      <div className="build-wizard-purchase-option-title">
                        <span>{opt.title}</span>
                        <span className={`build-wizard-purchase-tier is-${String(opt.tier || '').toLowerCase() || 'standard'}`}>
                          {opt.tier_label || 'Standard'}
                        </span>
                      </div>
                      <div className="build-wizard-purchase-option-meta">
                        <span>{opt.vendor || 'Unknown vendor'}</span>
                        <span>{typeof opt.unit_price === 'number' ? formatCurrency(opt.unit_price) : '-'}</span>
                        <a href={opt.url} target="_blank" rel="noreferrer">Open</a>
                      </div>
                      <div className="build-wizard-purchase-option-summary">{opt.summary || ''}</div>
                      <button className="btn btn-sm btn-outline-success" onClick={() => void onUsePurchaseOption(step, opt)}>Use Option</button>
                    </div>
                  ))}
                </div>
              ) : null}
              </fieldset>

              <div className="build-wizard-step-media">
                {renderDocumentGallery(
                  documents.filter((d) => Number(d.step_id || 0) === step.id),
                  'No media attached to this step yet.',
                  stepReadOnly
                )}
              </div>

              {step.notes.length > 0 ? (
                <div className="build-wizard-note-list">
                  {step.notes.map((n) => (
                    <div key={n.id}><strong>{n.created_at}</strong>: {n.note_text}</div>
                  ))}
                </div>
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
              <a href={doc.public_url} target="_blank" rel="noreferrer" className="build-wizard-doc-thumb-link" title="Open PDF">
                <WebpImage src={doc.thumbnail_url || doc.public_url} alt={`${doc.original_name} preview`} className="build-wizard-doc-thumb" />
              </a>
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
              <a href={doc.public_url} target="_blank" rel="noreferrer" className="build-wizard-doc-file-link build-wizard-doc-file-link-rich">
                <span className="build-wizard-doc-file-glyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5" />
                    <path d="M9 13h6M9 16h6" />
                  </svg>
                </span>
                <span className="build-wizard-doc-file-ext">{thumbnailKindLabel(doc)}</span>
                <span className="build-wizard-doc-file-open">Open file</span>
              </a>
            )}
            <button
              type="button"
              className="build-wizard-doc-delete-btn"
              title="Delete file"
              aria-label={`Delete ${doc.original_name}`}
              onClick={() => void onDeleteDocument(doc.id, doc.original_name)}
              disabled={readOnly || deletingDocumentId === doc.id}
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
          <button className="build-wizard-launch-card is-new" onClick={() => void onCreateNewBuild()}>
            <div className="build-wizard-thumb">
              <div className="build-wizard-thumb-roof" />
              <div className="build-wizard-thumb-body" />
            </div>
            <span className="build-wizard-launch-title">Build a New Home</span>
          </button>

          {projects.map((p) => (
            <div
              key={p.id}
              className="build-wizard-launch-card build-wizard-launch-card-with-delete"
              style={{ ['--thumb-tone' as any]: `${(p.id * 37) % 360}deg` }}
            >
              <button
                type="button"
                className="build-wizard-launch-card-open"
                onClick={() => void openBuild(p.id)}
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
        </div>
      </div>
    </div>
  );

  const renderBuildWorkspace = () => (
    <div className="build-wizard-shell build-wizard-has-footer-space" style={{ ['--build-wizard-sticky-top' as string]: `${stickyTopOffset}px` }}>
      <div className="build-wizard-workspace">
        <div className="build-wizard-sticky-head" ref={stickyHeadRef}>
          <div className="build-wizard-topbar">
            <button className="btn btn-outline-secondary" onClick={onBackToLauncher}>Back to Launcher</button>
            <div className="build-wizard-topbar-title">{project?.title || 'Home Build'}</div>
            <div className="build-wizard-topbar-actions">
              <button className="btn btn-primary btn-sm" onClick={() => void onCompleteWithAi()} disabled={aiBusy}>
                {aiBusy ? 'AI Running...' : 'Complete w/ AI'}
              </button>
              <button className="btn btn-outline-primary btn-sm" onClick={() => setDocumentManagerOpen(true)}>Document Manager</button>
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
                  onBlur={() => void updateProject({ kitchens_count: projectDraft.kitchens_count })}
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
                  type="number"
                  step="0.01"
                  value={projectDraft.hoa_fee_monthly ?? ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, hoa_fee_monthly: toNumberOrNull(e.target.value) }))}
                  onBlur={() => void updateProject({ hoa_fee_monthly: projectDraft.hoa_fee_monthly })}
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
            <div className="build-wizard-phase-head">
              <h2>{BUILD_TABS.find((t) => t.id === activeTab)?.label}</h2>
              <div className="build-wizard-phase-totals">
                <span>Phase Total: <span className="build-wizard-phase-total-value">{formatCurrency(phaseTotals.phaseTotal)}</span></span>
                <span>Project Total To Date: <span className="build-wizard-phase-total-value">{formatCurrency(phaseTotals.projectToDateTotal)}</span></span>
              </div>
              <button
                type="button"
                className="build-wizard-phase-add"
                title="Add step"
                aria-label="Add step"
                onClick={() => void addStep(TAB_DEFAULT_PHASE_KEY[activeTab] || 'general')}
              >
                +
              </button>
            </div>

            <div className="build-wizard-step-drag-hint">
              Drag the handle to reorder. Drop on another step card to make it a child.
            </div>

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
                <div>
                  <h3>AI Package</h3>
                  <div className="build-wizard-ai-actions">
                    <button className="btn btn-success" disabled={aiBusy} onClick={() => void packageForAi()}>Build AI Package</button>
                    <button className="btn btn-primary" disabled={aiBusy} onClick={() => void generateStepsFromAi('optimize')}>
                      {aiBusy ? 'Sending to AI...' : 'Send to AI + Ingest'}
                    </button>
                  </div>
                  <label>
                    Prompt Text
                    <textarea value={aiPromptText || ''} readOnly rows={4} />
                  </label>
                  <label>
                    Payload JSON
                    <textarea value={aiPayloadJson || ''} readOnly rows={6} />
                  </label>
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
                      <span>{formatCurrency(step.actual_cost !== null ? step.actual_cost : step.estimated_cost)}</span>
                    </div>
                    <div className="build-wizard-completed-date">Date: {formatDate(step.completed_at || step.expected_end_date || step.expected_start_date)}</div>
                    {step.notes.length ? (
                      <div className="build-wizard-completed-notes">
                        {step.notes.map((note) => (
                          <div key={note.id}><strong>{note.created_at}</strong>: {note.note_text}</div>
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
          <FooterPhaseTimeline steps={footerTimelineSteps} rangeStart={footerRange.start} rangeEnd={footerRange.end} />
        </div>
      </footer>

      {documentManagerOpen ? (
        <div className="build-wizard-doc-manager" onClick={() => setDocumentManagerOpen(false)}>
          <div className="build-wizard-doc-manager-inner" onClick={(e) => e.stopPropagation()}>
            <div className="build-wizard-doc-manager-head">
              <h3>Document Manager</h3>
              <StandardIconButton
                iconKey="close"
                ariaLabel="Close document manager"
                title="Close"
                className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
                onClick={() => setDocumentManagerOpen(false)}
              />
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
                </div>
                {filteredDocumentManagerDocs.length ? filteredDocumentManagerDocs.map((doc) => {
                  const draft = documentDrafts[doc.id] || { kind: doc.kind || 'other', caption: doc.caption || '', step_id: Number(doc.step_id || 0) };
                  const selectedStep = steps.find((step) => step.id === Number(draft.step_id || 0));
                  const phaseLabel = prettyPhaseLabel(selectedStep?.phase_key || doc.step_phase_key || 'general');

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
                          <a href={doc.public_url} target="_blank" rel="noreferrer" className="build-wizard-doc-thumb-link" title="Open PDF">
                            <WebpImage src={doc.thumbnail_url || doc.public_url} alt={`${doc.original_name} preview`} className="build-wizard-doc-thumb" />
                          </a>
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
                          <a href={doc.public_url} target="_blank" rel="noreferrer" className="build-wizard-doc-file-link build-wizard-doc-file-link-rich">
                            <span className="build-wizard-doc-file-glyph" aria-hidden="true">
                              <svg viewBox="0 0 24 24">
                                <path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5" />
                                <path d="M9 13h6M9 16h6" />
                              </svg>
                            </span>
                            <span className="build-wizard-doc-file-ext">{thumbnailKindLabel(doc)}</span>
                            <span className="build-wizard-doc-file-open">Open file</span>
                          </a>
                        )}
                      </div>
                      <div className="build-wizard-doc-manager-fields">
                        <div className="build-wizard-doc-manager-title">{doc.original_name}</div>
                        <div className="build-wizard-doc-manager-meta">Uploaded: {formatTimelineDate(doc.uploaded_at)} | Phase: {phaseLabel}</div>
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
                              {linkedStepOptions.map((step) => (
                                <option key={step.id} value={step.id}>
                                  {prettyPhaseLabel(step.phase_key)} - #{step.step_order} {step.title}
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
                            <StandardIconLink
                              iconKey="view"
                              ariaLabel={`Open ${doc.original_name}`}
                              title="Open"
                              className="btn btn-outline-primary btn-sm catn8-action-icon-btn"
                              href={doc.public_url}
                              target="_blank"
                              rel="noreferrer"
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
        </div>
      ) : null}

      {projectDeskOpen ? (
        <div className="build-wizard-doc-manager" onClick={() => setProjectDeskOpen(false)}>
          <div className="build-wizard-doc-manager-inner" onClick={(e) => e.stopPropagation()}>
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
              <div>
                <h3>AI Package</h3>
                <div className="build-wizard-ai-actions">
                  <button className="btn btn-success" disabled={aiBusy} onClick={() => void packageForAi()}>Build AI Package</button>
                  <button className="btn btn-primary" disabled={aiBusy} onClick={() => void generateStepsFromAi('optimize')}>
                    {aiBusy ? 'Sending to AI...' : 'Send to AI + Ingest'}
                  </button>
                </div>
                <label>
                  Prompt Text
                  <textarea value={aiPromptText || ''} readOnly rows={4} />
                </label>
                <label>
                  Payload JSON
                  <textarea value={aiPayloadJson || ''} readOnly rows={6} />
                </label>
              </div>
            </div>
            {renderEditableStepCards(projectDeskSteps)}
          </div>
        </div>
      ) : null}

      {lightboxDoc ? (
        <div className="build-wizard-lightbox" onClick={() => setLightboxDoc(null)}>
          <div className="build-wizard-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <div className="build-wizard-lightbox-actions">
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
                onClick={() => setLightboxDoc(null)}
              />
            </div>
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
            {lightboxDoc.mode === 'plan' ? (
              <div className="build-wizard-lightbox-plan-wrap">
                <pre className="build-wizard-lightbox-plan">{lightboxDoc.text}</pre>
                <div className="build-wizard-lightbox-note">
                  {lightboxDoc.format === 'hex' ? 'Binary .plan preview (hex + ASCII).' : 'Text preview.'}
                  {lightboxDoc.truncated ? ' Preview truncated for performance.' : ''}
                </div>
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
            <div className="build-wizard-lightbox-title">{lightboxDoc.title}</div>
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

  return view === 'launcher' ? renderLauncher() : renderBuildWorkspace();
}
