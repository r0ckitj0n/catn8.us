import React from 'react';

import { WebpImage } from '../common/WebpImage';
import { useBuildWizard } from '../../hooks/useBuildWizard';
import { IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
import './BuildWizardPage.css';

interface BuildWizardPageProps {
  viewer: any;
  isAdmin?: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
  onAccountClick: () => void;
  mysteryTitle?: string;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

type WizardView = 'launcher' | 'build';
type BuildTabId = 'start' | 'land' | 'permits' | 'site' | 'framing' | 'mep' | 'finishes' | 'desk' | 'completed';
type StepDraftMap = Record<number, IBuildWizardStep>;
type DocumentDraftMap = Record<number, { kind: string; caption: string; step_id: number }>;
type StepType = IBuildWizardStep['step_type'];

const BUILD_TABS: Array<{ id: BuildTabId; label: string }> = [
  { id: 'start', label: '1. Start' },
  { id: 'land', label: '2. Land & Survey' },
  { id: 'permits', label: '3. Permits' },
  { id: 'site', label: '4. Site & Foundation' },
  { id: 'framing', label: '5. Framing & Shell' },
  { id: 'mep', label: '6. MEP & Inspections' },
  { id: 'finishes', label: '7. Finishes' },
  { id: 'desk', label: '8. Project Desk' },
  { id: 'completed', label: '9. Completed' },
];

const PHASE_PROGRESS_ORDER: BuildTabId[] = ['land', 'permits', 'site', 'framing', 'mep', 'finishes', 'desk'];

const TAB_PHASE_COLORS: Record<BuildTabId, string> = {
  start: '#5b6f87',
  land: '#4c9f70',
  permits: '#c3833a',
  site: '#d4635c',
  framing: '#5b7bd5',
  mep: '#7d5cc8',
  finishes: '#3ca6ac',
  desk: '#6a7a8f',
  completed: '#2f8a4a',
};

const TAB_DEFAULT_PHASE_KEY: Partial<Record<BuildTabId, string>> = {
  land: 'land_due_diligence',
  permits: 'dawson_county_permits',
  site: 'site_preparation',
  framing: 'framing_shell',
  mep: 'mep_rough_in',
  finishes: 'interior_finishes',
  desk: 'general',
};

const STEP_TYPE_OPTIONS: Array<{ value: StepType; label: string }> = [
  { value: 'construction', label: 'Construction' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'permit', label: 'Permit' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'other', label: 'Other' },
];

const PERMIT_STATUS_OPTIONS = ['', 'not_started', 'drafting', 'submitted', 'approved', 'rejected', 'closed'];
const PURCHASE_UNIT_OPTIONS = ['', 'ea', 'ft', 'sqft', 'cuft', 'gal', 'lb', 'box', 'bundle', 'set', 'roll'];

const DOC_KIND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'site_photo', label: 'Site Photo' },
  { value: 'home_photo', label: 'Home Photo' },
  { value: 'blueprint', label: 'Blueprint' },
  { value: 'survey', label: 'Survey' },
  { value: 'permit', label: 'Permit' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'spec_sheet', label: 'Spec Sheet' },
  { value: 'other', label: 'Other' },
];

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(Number(value))) {
    return '-';
  }
  return Number(value).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function parseDate(input: string | null | undefined): Date | null {
  if (!input) {
    return null;
  }
  const str = String(input).trim();
  if (!str) {
    return null;
  }
  const normalized = str.length > 10 ? str.slice(0, 10) : str;
  const d = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(input: string | null | undefined): string {
  const d = parseDate(input);
  return d ? toIsoDate(d) : '-';
}

function formatTimelineDate(input: string | null | undefined): string {
  const d = parseDate(input);
  if (!d) {
    return '-';
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function tabLabelShort(tabId: BuildTabId): string {
  const label = BUILD_TABS.find((t) => t.id === tabId)?.label || tabId;
  return label.replace(/^\d+\.\s*/, '');
}

function withDownloadFlag(url: string): string {
  const clean = String(url || '').trim();
  if (!clean) {
    return '';
  }
  return `${clean}${clean.includes('?') ? '&' : '?'}download=1`;
}

function toNumberOrNull(value: string): number | null {
  const trimmed = String(value || '').trim();
  if (trimmed === '') {
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(value: string): string | null {
  const trimmed = String(value || '').trim();
  return trimmed === '' ? null : trimmed;
}

function calculateDurationDays(startDate: string | null | undefined, endDate: string | null | undefined): number | null {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) {
    return null;
  }
  const msDiff = end.getTime() - start.getTime();
  const days = Math.round(msDiff / 86400000) + 1;
  return Math.max(1, days);
}

function stepCostTotal(step: IBuildWizardStep): number {
  const actual = Number(step.actual_cost);
  if (Number.isFinite(actual) && actual > 0) {
    return actual;
  }
  const estimated = Number(step.estimated_cost);
  if (Number.isFinite(estimated) && estimated > 0) {
    return estimated;
  }
  return 0;
}

function stepPhaseBucket(step: IBuildWizardStep): BuildTabId {
  const key = String(step.phase_key || '').toLowerCase();

  if (key.includes('land') || key.includes('survey') || key.includes('due_diligence') || key.includes('purchase')) {
    return 'land';
  }
  if (key.includes('permit') || key.includes('approval')) {
    return 'permits';
  }
  if (key.includes('site') || key.includes('foundation') || key.includes('grading') || key.includes('excav')) {
    return 'site';
  }
  if (key.includes('framing') || key.includes('enclosure') || key.includes('roof') || key.includes('shell')) {
    return 'framing';
  }
  if (key.includes('plumb') || key.includes('elect') || key.includes('mechanical') || key.includes('hvac') || key.includes('mep') || key.includes('inspection')) {
    return 'mep';
  }
  if (key.includes('finish') || key.includes('interior') || key.includes('paint') || key.includes('cabinet') || key.includes('floor')) {
    return 'finishes';
  }
  return 'desk';
}

function prettyPhaseLabel(phaseKey: string | null | undefined): string {
  const raw = String(phaseKey || '').trim();
  if (!raw) {
    return 'General';
  }
  return raw.split('_').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function stepDateRange(step: IBuildWizardStep): { start: Date | null; end: Date | null } {
  const start = parseDate(step.expected_start_date) || parseDate(step.completed_at) || parseDate(step.expected_end_date);
  const end = parseDate(step.expected_end_date) || parseDate(step.completed_at) || parseDate(step.expected_start_date);

  if (!start && !end) {
    return { start: null, end: null };
  }
  if (start && end && end.getTime() < start.getTime()) {
    return { start: end, end: start };
  }
  return {
    start: start || end,
    end: end || start,
  };
}

function getDefaultRange(steps: IBuildWizardStep[]): { start: string; end: string } {
  const allDates: Date[] = [];
  steps.forEach((step) => {
    const r = stepDateRange(step);
    if (r.start) {
      allDates.push(r.start);
    }
    if (r.end) {
      allDates.push(r.end);
    }
  });

  if (!allDates.length) {
    const today = new Date();
    return { start: toIsoDate(today), end: toIsoDate(today) };
  }

  allDates.sort((a, b) => a.getTime() - b.getTime());
  return {
    start: toIsoDate(allDates[0]),
    end: toIsoDate(allDates[allDates.length - 1]),
  };
}

function parseUrlState(): { view: WizardView; projectId: number | null } {
  if (typeof window === 'undefined') {
    return { view: 'launcher', projectId: null };
  }
  const url = new URL(window.location.href);
  const viewParam = String(url.searchParams.get('view') || '').toLowerCase();
  const projectIdParam = Number(url.searchParams.get('project_id') || '0');
  return {
    view: (viewParam === 'build' ? 'build' : 'launcher'),
    projectId: Number.isFinite(projectIdParam) && projectIdParam > 0 ? projectIdParam : null,
  };
}

function pushUrlState(view: WizardView, projectId: number | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);

  if (view === 'build' && projectId && projectId > 0) {
    url.searchParams.set('view', 'build');
    url.searchParams.set('project_id', String(projectId));
  } else {
    url.searchParams.delete('view');
    url.searchParams.delete('project_id');
  }

  window.history.pushState({ view, projectId }, '', url.toString());
}

type DateRangeChartProps = {
  steps: IBuildWizardStep[];
  rangeStart: string;
  rangeEnd: string;
  compact?: boolean;
};

type FooterTimelineProps = {
  steps: IBuildWizardStep[];
  rangeStart: string;
  rangeEnd: string;
};

function segmentBackground(colors: string[]): string {
  if (colors.length <= 1) {
    return colors[0] || '#9fb0c7';
  }
  const stripeWidth = 8;
  const stops = colors
    .map((color, i) => {
      const start = i * stripeWidth;
      const end = (i + 1) * stripeWidth;
      return `${color} ${start}px ${end}px`;
    })
    .join(', ');
  return `repeating-linear-gradient(135deg, ${stops})`;
}

function FooterPhaseTimeline({ steps, rangeStart, rangeEnd }: FooterTimelineProps) {
  const startDate = parseDate(rangeStart);
  const endDate = parseDate(rangeEnd);

  if (!startDate || !endDate || endDate.getTime() < startDate.getTime()) {
    return <div className="build-wizard-muted">Invalid date range.</div>;
  }

  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
  const phaseByDay: Array<Set<BuildTabId>> = Array.from({ length: totalDays }, () => new Set<BuildTabId>());

  steps.forEach((step) => {
    const range = stepDateRange(step);
    if (!range.start || !range.end) {
      return;
    }
    if (range.end.getTime() < startDate.getTime() || range.start.getTime() > endDate.getTime()) {
      return;
    }
    const clampedStartMs = Math.max(range.start.getTime(), startDate.getTime());
    const clampedEndMs = Math.min(range.end.getTime(), endDate.getTime());
    const startOffset = Math.max(0, Math.round((clampedStartMs - startDate.getTime()) / 86400000));
    const endOffset = Math.min(totalDays - 1, Math.round((clampedEndMs - startDate.getTime()) / 86400000));
    const phase = stepPhaseBucket(step);
    for (let day = startOffset; day <= endOffset; day += 1) {
      phaseByDay[day].add(phase);
    }
  });

  const segments: Array<{ leftPercent: number; widthPercent: number; colors: string[]; key: string }> = [];
  let idx = 0;
  while (idx < totalDays) {
    const phaseIds = Array.from(phaseByDay[idx]).sort() as BuildTabId[];
    const key = phaseIds.join('|');
    let endIdx = idx;
    while (endIdx + 1 < totalDays) {
      const nextIds = Array.from(phaseByDay[endIdx + 1]).sort().join('|');
      if (nextIds !== key) {
        break;
      }
      endIdx += 1;
    }
    if (phaseIds.length > 0) {
      const runLen = (endIdx - idx) + 1;
      segments.push({
        key: `${idx}-${key}`,
        leftPercent: (idx / totalDays) * 100,
        widthPercent: (runLen / totalDays) * 100,
        colors: phaseIds.map((phaseId) => TAB_PHASE_COLORS[phaseId]),
      });
    }
    idx = endIdx + 1;
  }

  const quarterDate = toIsoDate(new Date(startDate.getTime() + ((endDate.getTime() - startDate.getTime()) * 0.25)));
  const midDate = toIsoDate(new Date(startDate.getTime() + ((endDate.getTime() - startDate.getTime()) * 0.5)));
  const threeQuarterDate = toIsoDate(new Date(startDate.getTime() + ((endDate.getTime() - startDate.getTime()) * 0.75)));
  const phaseStatus = new Map<BuildTabId, { total: number; done: number }>();

  steps.forEach((step) => {
    const phaseId = stepPhaseBucket(step);
    if (!phaseStatus.has(phaseId)) {
      phaseStatus.set(phaseId, { total: 0, done: 0 });
    }
    const stat = phaseStatus.get(phaseId)!;
    stat.total += 1;
    if (Number(step.is_completed) === 1) {
      stat.done += 1;
    }
  });

  const orderedStatusPhases = BUILD_TABS
    .map((t) => t.id)
    .filter((id): id is BuildTabId => id !== 'start' && id !== 'completed' && (phaseStatus.get(id)?.total || 0) > 0);

  return (
    <div className="build-wizard-phase-timeline">
      <div className="build-wizard-phase-range">
        {formatTimelineDate(rangeStart)} - {formatTimelineDate(rangeEnd)}
      </div>
      <div className="build-wizard-phase-track">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="build-wizard-phase-segment"
            style={{
              left: `${segment.leftPercent}%`,
              width: `${segment.widthPercent}%`,
              background: segmentBackground(segment.colors),
            }}
          />
        ))}
      </div>
      <div className="build-wizard-phase-ticks">
        <span className="is-edge is-start" style={{ left: '0%' }}>{formatTimelineDate(rangeStart)}</span>
        <span className="is-mid" style={{ left: '25%' }}>{formatTimelineDate(quarterDate)}</span>
        <span className="is-mid" style={{ left: '50%' }}>{formatTimelineDate(midDate)}</span>
        <span className="is-mid" style={{ left: '75%' }}>{formatTimelineDate(threeQuarterDate)}</span>
        <span className="is-edge is-end" style={{ left: '100%' }}>{formatTimelineDate(rangeEnd)}</span>
      </div>
      {orderedStatusPhases.length ? (
        <div className="build-wizard-phase-status">
          {orderedStatusPhases.map((phaseId) => {
            const stat = phaseStatus.get(phaseId)!;
            return (
              <div key={phaseId} className="build-wizard-phase-status-chip">
                <span className="build-wizard-phase-status-swatch" style={{ background: TAB_PHASE_COLORS[phaseId] }} />
                <span>{tabLabelShort(phaseId)}: {stat.done}/{stat.total}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function DateRangeChart({ steps, rangeStart, rangeEnd, compact = false }: DateRangeChartProps) {
  const startDate = parseDate(rangeStart);
  const endDate = parseDate(rangeEnd);

  if (!startDate || !endDate || endDate.getTime() < startDate.getTime()) {
    return <div className="build-wizard-muted">Invalid date range.</div>;
  }

  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);

  const rows = steps
    .map((step) => {
      const range = stepDateRange(step);
      if (!range.start || !range.end) {
        return null;
      }

      if (range.end.getTime() < startDate.getTime() || range.start.getTime() > endDate.getTime()) {
        return null;
      }

      const clampedStartMs = Math.max(range.start.getTime(), startDate.getTime());
      const clampedEndMs = Math.min(range.end.getTime(), endDate.getTime());

      const leftDays = Math.round((clampedStartMs - startDate.getTime()) / 86400000);
      const widthDays = Math.max(1, Math.round((clampedEndMs - clampedStartMs) / 86400000) + 1);

      return {
        step,
        leftPercent: (leftDays / totalDays) * 100,
        widthPercent: (widthDays / totalDays) * 100,
      };
    })
    .filter(Boolean) as Array<{ step: IBuildWizardStep; leftPercent: number; widthPercent: number }>;

  if (!rows.length) {
    return <div className="build-wizard-muted">No step dates in selected range.</div>;
  }

  return (
    <div className={`build-wizard-chart ${compact ? 'is-compact' : ''}`}>
      {rows.map((row) => (
        <div key={row.step.id} className="build-wizard-chart-row">
          <div className="build-wizard-chart-label">#{row.step.step_order} {row.step.title}</div>
          <div className="build-wizard-chart-track">
            <div
              className="build-wizard-chart-bar"
              style={{ left: `${row.leftPercent}%`, width: `${row.widthPercent}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BuildWizardPage({ onToast, isAdmin }: BuildWizardPageProps) {
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
    deleteStep,
    deleteProject,
    addStepNote,
    uploadDocument,
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
  const [projectDraft, setProjectDraft] = React.useState(questionnaire);
  const [stepDrafts, setStepDrafts] = React.useState<StepDraftMap>({});
  const [noteDraftByStep, setNoteDraftByStep] = React.useState<Record<number, string>>({});
  const [noteEditorOpenByStep, setNoteEditorOpenByStep] = React.useState<Record<number, boolean>>({});
  const [footerRange, setFooterRange] = React.useState<{ start: string; end: string }>({ start: '', end: '' });
  const [lightboxDoc, setLightboxDoc] = React.useState<{ src: string; title: string } | null>(null);
  const [documentManagerOpen, setDocumentManagerOpen] = React.useState<boolean>(false);
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
  const recoveryUploadInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (initialUrlState.view === 'build' && initialUrlState.projectId && initialUrlState.projectId !== projectId) {
      void openProject(initialUrlState.projectId);
    }
  }, [initialUrlState.view, initialUrlState.projectId, projectId, openProject]);

  React.useEffect(() => {
    const onPopState = () => {
      const state = parseUrlState();
      setView(state.view);
      if (state.view === 'build' && state.projectId && state.projectId !== projectId) {
        void openProject(state.projectId);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [openProject, projectId]);

  React.useEffect(() => {
    setProjectDraft(questionnaire);
  }, [questionnaire]);

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
    if (activeTab === 'completed' || activeTab === 'start') {
      return [] as IBuildWizardStep[];
    }
    return steps.filter((step) => stepPhaseBucket(step) === activeTab);
  }, [steps, activeTab]);

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
    if (activeTab === 'start' || activeTab === 'completed') {
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

  const projectDocuments = React.useMemo(() => {
    return documents.filter((d) => !d.step_id || Number(d.step_id) <= 0);
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
    return options;
  }, [steps]);

  const selectableDocSteps = React.useMemo(() => {
    if (!docPhaseKey || docPhaseKey === 'general') {
      return steps;
    }
    return steps.filter((step) => String(step.phase_key || 'general') === docPhaseKey);
  }, [steps, docPhaseKey]);

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
  }, [documentManagerOpen, documents]);

  const openBuild = async (nextProjectId: number) => {
    await openProject(nextProjectId);
    setActiveTab('start');
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

  const renderEditableStepCards = (tabSteps: IBuildWizardStep[]) => {
    if (!tabSteps.length) {
      return <div className="build-wizard-muted">No steps in this tab yet.</div>;
    }

    return (
      <div className="build-wizard-step-list">
        {tabSteps.map((step) => {
          const draft = stepDrafts[step.id] || step;
          const durationDays = calculateDurationDays(draft.expected_start_date, draft.expected_end_date)
            ?? (draft.expected_duration_days ?? null);
          return (
            <div className="build-wizard-step" key={step.id}>
              <div className="build-wizard-step-phase-accent" style={{ background: TAB_PHASE_COLORS[stepPhaseBucket(step)] }} />
              <div className="build-wizard-step-header">
                <div className="build-wizard-step-header-left">
                  <label className="build-wizard-inline-check">
                    <input
                      type="checkbox"
                      checked={Number(step.is_completed) === 1}
                      onChange={(e) => void toggleStep(step, e.target.checked)}
                    />
                    <span>#{step.step_order} Completed</span>
                  </label>
                  <div className="build-wizard-inline-metrics">
                    <label className="build-wizard-duration-inline">
                      Duration (Days)
                      <input type="number" value={durationDays ?? ''} readOnly />
                    </label>
                    <label className="build-wizard-date-inline">
                      Start
                      <input
                        type="date"
                        value={draft.expected_start_date || ''}
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
                      End
                      <input
                        type="date"
                        value={draft.expected_end_date || ''}
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
                          const nextPatch: Partial<IBuildWizardStep> = {
                            step_type: nextType,
                            permit_required: nextType === 'permit' ? 1 : draft.permit_required,
                          };
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
                    onClick={() => {
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

              <div className="build-wizard-step-grid">
                <label>
                  Step Title
                  <input
                    type="text"
                    value={draft.title || ''}
                    onChange={(e) => updateStepDraft(step.id, { title: e.target.value })}
                    onBlur={() => void commitStep(step.id, { title: String(stepDrafts[step.id]?.title || '').trim() })}
                  />
                </label>
                <label>
                  Permit Required
                  <select
                    value={Number(draft.permit_required) === 1 ? '1' : '0'}
                    onChange={(e) => {
                      const next = e.target.value === '1' ? 1 : 0;
                      updateStepDraft(step.id, { permit_required: next });
                      void commitStep(step.id, { permit_required: next });
                    }}
                  >
                    <option value="0">No</option>
                    <option value="1">Yes</option>
                  </select>
                </label>
                {draft.step_type === 'permit' ? (
                  <>
                    <label>
                      Permit Name
                      <input
                        type="text"
                        value={draft.permit_name || ''}
                        onChange={(e) => updateStepDraft(step.id, { permit_name: e.target.value })}
                        onBlur={() => void commitStep(step.id, { permit_name: toStringOrNull(stepDrafts[step.id]?.permit_name || '') })}
                      />
                    </label>
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
                        {PERMIT_STATUS_OPTIONS.map((status) => (
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
                        {PURCHASE_UNIT_OPTIONS.map((unit) => (
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
                <label>
                  Estimated Cost
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
                        void uploadDocument('progress_photo', file, step.id, step.title, step.phase_key);
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

              <div className="build-wizard-step-media">
                {renderDocumentGallery(
                  documents.filter((d) => Number(d.step_id || 0) === step.id),
                  'No media attached to this step yet.'
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
          );
        })}
      </div>
    );
  };

  const renderDocumentGallery = (items: typeof documents, emptyText: string) => {
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
                onClick={() => setLightboxDoc({ src: doc.public_url, title: doc.original_name })}
                title="Click to enlarge"
              >
                <WebpImage src={doc.thumbnail_url || doc.public_url} alt={doc.original_name} className="build-wizard-doc-thumb" />
              </button>
            ) : (
              <a href={doc.public_url} target="_blank" rel="noreferrer" className="build-wizard-doc-file-link">
                Open File
              </a>
            )}
            <button
              type="button"
              className="build-wizard-doc-delete-btn"
              title="Delete file"
              aria-label={`Delete ${doc.original_name}`}
              onClick={() => void onDeleteDocument(doc.id, doc.original_name)}
              disabled={deletingDocumentId === doc.id}
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

  const renderLauncher = () => (
    <div className="build-wizard-shell">
      <div className="build-wizard-launcher">
        <h1>Build Launcher</h1>
        <p>Choose an existing home build or start a new home plan.</p>

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
                <div className="build-wizard-thumb">
                  <div className="build-wizard-thumb-roof" />
                  <div className="build-wizard-thumb-body" />
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
    <div className="build-wizard-shell build-wizard-has-footer-space">
      <div className="build-wizard-workspace">
        <div className="build-wizard-topbar">
          <button className="btn btn-outline-secondary" onClick={onBackToLauncher}>Back to Launcher</button>
          <div className="build-wizard-topbar-title">{project?.title || 'Home Build'}</div>
          <div className="build-wizard-topbar-actions">
            {isAdmin ? (
              <>
                <button
                  className="btn btn-outline-success btn-sm"
                  onClick={() => recoveryUploadInputRef.current?.click()}
                  disabled={recoveryUploadBusy}
                  title="Upload Singletree source files to server staging"
                >
                  {recoveryUploadBusy ? 'Uploading...' : 'Upload Source Files'}
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => void onRunSingletreeRecovery(false)}
                  disabled={recoveryBusy}
                  title="Dry-run document recovery for Cabin - 91 Singletree Ln"
                >
                  {recoveryBusy ? 'Running...' : 'Singletree Recovery (Dry Run)'}
                </button>
                <button
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => void onRunSingletreeRecovery(true)}
                  disabled={recoveryBusy}
                  title="Apply document recovery for Cabin - 91 Singletree Ln"
                >
                  {recoveryBusy ? 'Running...' : 'Singletree Recovery (Apply)'}
                </button>
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => setRecoveryReportOpen(true)}
                  title="View last Singletree recovery report"
                >
                  Recovery Report
                </button>
                <input
                  ref={recoveryUploadInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => void onUploadRecoveryFiles(e.target.files)}
                />
              </>
            ) : null}
            <button className="btn btn-outline-primary btn-sm" onClick={() => setDocumentManagerOpen(true)}>Document Manager</button>
          </div>
        </div>

        <div className="build-wizard-tabs">
          {BUILD_TABS.map((tab) => (
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
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
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
                Number of Rooms
                <input
                  type="number"
                  value={projectDraft.room_count ?? ''}
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, room_count: toNumberOrNull(e.target.value) }))}
                  onBlur={() => void updateProject({ room_count: projectDraft.room_count })}
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

            <div className="build-wizard-section-divider" />
            <h3>Project Photos & Key Paperwork</h3>
            <div className="build-wizard-upload-row">
              <select value={docKind} onChange={(e) => setDocKind(e.target.value)}>
                {DOC_KIND_OPTIONS.map((opt) => (
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
            {renderDocumentGallery(projectDocuments, 'No project media yet.')}
          </div>
        ) : null}

        {activeTab !== 'start' && activeTab !== 'completed' ? (
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

            {activeTab === 'desk' ? (
              <div className="build-wizard-desk-grid">
                <div>
                  <h3>Documents</h3>
                  <div className="build-wizard-upload-row">
                    <select value={docKind} onChange={(e) => setDocKind(e.target.value)}>
                      {DOC_KIND_OPTIONS.map((opt) => (
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
                    <button className="btn btn-primary" disabled={aiBusy} onClick={() => void generateStepsFromAi()}>
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
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setDocumentManagerOpen(false)}>Close</button>
            </div>
            {documents.length ? (
              <div className="build-wizard-doc-manager-list">
                {documents.map((doc) => {
                  const draft = documentDrafts[doc.id] || { kind: doc.kind || 'other', caption: doc.caption || '', step_id: Number(doc.step_id || 0) };
                  const selectedStep = steps.find((step) => step.id === Number(draft.step_id || 0));
                  const phaseLabel = prettyPhaseLabel(selectedStep?.phase_key || doc.step_phase_key || 'general');

                  return (
                    <div className="build-wizard-doc-manager-row" key={doc.id}>
                      <div className="build-wizard-doc-manager-preview">
                        {Number(doc.is_image) === 1 ? (
                          <button
                            className="build-wizard-doc-thumb-btn"
                            onClick={() => setLightboxDoc({ src: doc.public_url, title: doc.original_name })}
                            title="Open preview"
                          >
                            <WebpImage src={doc.thumbnail_url || doc.public_url} alt={doc.original_name} className="build-wizard-doc-thumb" />
                          </button>
                        ) : (
                          <a href={doc.public_url} target="_blank" rel="noreferrer" className="build-wizard-doc-file-link">Open File</a>
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
                              {DOC_KIND_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Linked Step
                            <select
                              value={draft.step_id > 0 ? String(draft.step_id) : ''}
                              onChange={(e) => updateDocumentDraft(doc.id, { step_id: Number(e.target.value || '0') })}
                            >
                              <option value="">No step linked</option>
                              {steps.map((step) => (
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
                          <a className="btn btn-outline-primary btn-sm" href={doc.public_url} target="_blank" rel="noreferrer">Open</a>
                          <a className="btn btn-outline-secondary btn-sm" href={withDownloadFlag(doc.public_url)}>Download</a>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => void onSaveDocumentDraft(doc)}
                            disabled={documentSavingId === doc.id}
                          >
                            {documentSavingId === doc.id ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => void onDeleteDocument(doc.id, doc.original_name)}
                            disabled={deletingDocumentId === doc.id}
                          >
                            {deletingDocumentId === doc.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="build-wizard-muted">No documents uploaded yet.</div>
            )}
          </div>
        </div>
      ) : null}

      {lightboxDoc ? (
        <div className="build-wizard-lightbox" onClick={() => setLightboxDoc(null)}>
          <div className="build-wizard-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <div className="build-wizard-lightbox-actions">
              <a
                href={withDownloadFlag(lightboxDoc.src)}
                className="build-wizard-lightbox-download"
                title="Download"
                aria-label="Download"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42l2.3 2.3V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z" />
                </svg>
              </a>
              <button className="build-wizard-lightbox-close" onClick={() => setLightboxDoc(null)}>Close</button>
            </div>
            <WebpImage src={lightboxDoc.src} alt={lightboxDoc.title} className="build-wizard-lightbox-image" />
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
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setRecoveryReportOpen(false)}>Close</button>
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
