import React from 'react';
import { useBuildWizard } from '../../hooks/useBuildWizard';
import { IBuildWizardStep } from '../../types/buildWizard';
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
        <span className="is-edge" style={{ left: '0%' }}>{formatTimelineDate(rangeStart)}</span>
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

export function BuildWizardPage({ onToast }: BuildWizardPageProps) {
  const {
    loading,
    saving,
    aiBusy,
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
    addStepNote,
    uploadDocument,
    packageForAi,
    generateStepsFromAi,
  } = useBuildWizard(onToast);

  const initialUrlState = React.useMemo(() => parseUrlState(), []);
  const [view, setView] = React.useState<WizardView>(initialUrlState.view);
  const [activeTab, setActiveTab] = React.useState<BuildTabId>('start');
  const [docKind, setDocKind] = React.useState<string>('blueprint');
  const [projectDraft, setProjectDraft] = React.useState(questionnaire);
  const [stepDrafts, setStepDrafts] = React.useState<StepDraftMap>({});
  const [noteDraftByStep, setNoteDraftByStep] = React.useState<Record<number, string>>({});
  const [noteEditorOpenByStep, setNoteEditorOpenByStep] = React.useState<Record<number, boolean>>({});
  const [footerRange, setFooterRange] = React.useState<{ start: string; end: string }>({ start: '', end: '' });
  const [lightboxDoc, setLightboxDoc] = React.useState<{ src: string; title: string } | null>(null);

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
                    x
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
                <label className="btn btn-outline-secondary btn-sm build-wizard-upload-btn">
                  Upload
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={(e) => {
                      const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                      if (file) {
                        void uploadDocument('progress_photo', file, step.id, step.title);
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
                <img src={doc.thumbnail_url || doc.public_url} alt={doc.original_name} className="build-wizard-doc-thumb" />
              </button>
            ) : (
              <a href={doc.public_url} target="_blank" rel="noreferrer" className="build-wizard-doc-file-link">
                Open File
              </a>
            )}
            <div className="build-wizard-doc-name">{doc.original_name}</div>
            <div className="build-wizard-doc-meta">{doc.kind}</div>
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
            <button
              key={p.id}
              className="build-wizard-launch-card"
              style={{ ['--thumb-tone' as any]: `${(p.id * 37) % 360}deg` }}
              onClick={() => void openBuild(p.id)}
            >
              <div className="build-wizard-thumb">
                <div className="build-wizard-thumb-roof" />
                <div className="build-wizard-thumb-body" />
              </div>
              <span className="build-wizard-launch-title">{p.title}</span>
            </button>
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
                <option value="site_photo">Site Photo</option>
                <option value="home_photo">Home Photo</option>
                <option value="blueprint">Blueprint</option>
                <option value="survey">Survey</option>
                <option value="permit">Permit</option>
                <option value="receipt">Receipt</option>
                <option value="other">Other</option>
              </select>
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                  if (file) {
                    void uploadDocument(docKind, file);
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
                      <option value="blueprint">Blueprint</option>
                      <option value="permit">Permit Document</option>
                      <option value="survey">Survey</option>
                      <option value="spec_sheet">Spec Sheet</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                        if (file) {
                          void uploadDocument(docKind, file);
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
          <div className="build-wizard-footer-controls">
            <label>
              Range Start
              <input
                type="date"
                value={footerRange.start}
                onChange={(e) => setFooterRange((prev) => ({ ...prev, start: e.target.value }))}
              />
            </label>
            <label>
              Range End
              <input
                type="date"
                value={footerRange.end}
                onChange={(e) => setFooterRange((prev) => ({ ...prev, end: e.target.value }))}
              />
            </label>
            <div className="build-wizard-footer-meta">
              Viewing: {BUILD_TABS.find((t) => t.id === activeTab)?.label}
            </div>
            <div className="build-wizard-footer-meta">
              Saving: {saving || loading ? 'Yes' : 'No'}
            </div>
          </div>
          <FooterPhaseTimeline steps={footerTimelineSteps} rangeStart={footerRange.start} rangeEnd={footerRange.end} />
        </div>
      </footer>

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
            <img src={lightboxDoc.src} alt={lightboxDoc.title} className="build-wizard-lightbox-image" />
            <div className="build-wizard-lightbox-title">{lightboxDoc.title}</div>
          </div>
        </div>
      ) : null}
    </div>
  );

  return view === 'launcher' ? renderLauncher() : renderBuildWorkspace();
}
