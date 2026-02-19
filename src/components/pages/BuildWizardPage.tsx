import React from 'react';
import { PageLayout } from '../layout/PageLayout';
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

type StepDraftMap = Record<number, IBuildWizardStep>;

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(Number(value))) {
    return '-';
  }
  return Number(value).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function formatDate(value: string | null): string {
  return value || '-';
}

function phaseLabel(phaseKey: string): string {
  return String(phaseKey || 'general')
    .split('_')
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() + p.slice(1))
    .join(' ');
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

export function BuildWizardPage({
  viewer,
  isAdmin = false,
  onLoginClick,
  onLogout,
  onAccountClick,
  mysteryTitle,
  onToast,
}: BuildWizardPageProps) {
  const {
    loading,
    saving,
    aiBusy,
    projectId,
    projects,
    project,
    questions,
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
    addStepNote,
    uploadDocument,
    packageForAi,
    generateStepsFromAi,
  } = useBuildWizard(onToast);

  const [docKind, setDocKind] = React.useState<string>('blueprint');
  const [newBuildTitle, setNewBuildTitle] = React.useState<string>('New Dawsonville Residential Build');
  const [activePhase, setActivePhase] = React.useState<string>('');
  const [noteDraftByStep, setNoteDraftByStep] = React.useState<Record<number, string>>({});
  const [stepDrafts, setStepDrafts] = React.useState<StepDraftMap>({});
  const [projectDraft, setProjectDraft] = React.useState(questionnaire);

  React.useEffect(() => {
    setProjectDraft(questionnaire);
  }, [questionnaire]);

  React.useEffect(() => {
    setStepDrafts((prev) => {
      const next: StepDraftMap = { ...prev };
      const validIds = new Set<number>();

      steps.forEach((s) => {
        validIds.add(s.id);
        if (!next[s.id]) {
          next[s.id] = { ...s };
        }
      });

      Object.keys(next).forEach((k) => {
        const id = Number(k);
        if (!validIds.has(id)) {
          delete next[id];
        }
      });

      return next;
    });
  }, [steps]);

  const phases = React.useMemo(() => {
    const map = new Map<string, { firstOrder: number; steps: IBuildWizardStep[] }>();
    steps.forEach((s) => {
      const key = s.phase_key || 'general';
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { firstOrder: s.step_order, steps: [s] });
      } else {
        existing.firstOrder = Math.min(existing.firstOrder, s.step_order);
        existing.steps.push(s);
      }
    });

    return Array.from(map.entries())
      .map(([phaseKey, value]) => ({ phaseKey, firstOrder: value.firstOrder, steps: value.steps }))
      .sort((a, b) => a.firstOrder - b.firstOrder);
  }, [steps]);

  React.useEffect(() => {
    if (!phases.length) {
      setActivePhase('');
      return;
    }
    if (!activePhase || !phases.some((p) => p.phaseKey === activePhase)) {
      setActivePhase(phases[0].phaseKey);
    }
  }, [phases, activePhase]);

  const activePhaseSteps = React.useMemo(() => {
    return phases.find((p) => p.phaseKey === activePhase)?.steps || [];
  }, [phases, activePhase]);

  const projectProgress = React.useMemo(() => {
    const totalSteps = steps.length;
    const completedSteps = steps.filter((s) => Number(s.is_completed) === 1).length;
    const completionPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    const totalEstimatedCost = steps.reduce((sum, s) => sum + (Number(s.estimated_cost) || 0), 0);
    const totalActualCost = steps.reduce((sum, s) => sum + (Number(s.actual_cost) || 0), 0);

    return {
      totalSteps,
      completedSteps,
      completionPct,
      totalEstimatedCost,
      totalActualCost,
    };
  }, [steps]);

  const onNoteSubmit = async (step: IBuildWizardStep) => {
    const draft = String(noteDraftByStep[step.id] || '').trim();
    if (!draft) {
      return;
    }
    await addStepNote(step.id, draft);
    setNoteDraftByStep((prev) => ({ ...prev, [step.id]: '' }));
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

  const commitStepPatch = async (step: IBuildWizardStep, patch: Partial<IBuildWizardStep>) => {
    await updateStep(step.id, patch);
  };

  const openSummary = (
    <div className="build-wizard-card">
      <h2>Build Launcher</h2>
      <p className="build-wizard-muted">Start a new build or open an existing one.</p>

      <div className="build-wizard-project-create">
        <input
          type="text"
          value={newBuildTitle}
          onChange={(e) => setNewBuildTitle(e.target.value)}
          placeholder="Build name"
        />
        <button
          className="btn btn-primary"
          disabled={loading}
          onClick={() => void createProject(newBuildTitle)}
        >
          Start New Build
        </button>
      </div>

      <div className="build-wizard-project-list">
        {projects.length ? projects.map((p) => {
          const isActive = Number(p.id) === Number(projectId);
          return (
            <button
              key={p.id}
              className={`build-wizard-project-pill${isActive ? ' is-active' : ''}`}
              onClick={() => void openProject(p.id)}
            >
              <span className="build-wizard-project-title">{p.title}</span>
              <span>{p.completed_step_count}/{p.step_count} complete</span>
            </button>
          );
        }) : <div className="build-wizard-muted">No builds yet.</div>}
      </div>
    </div>
  );

  return (
    <PageLayout
      page="build_wizard"
      title="Build Wizard"
      viewer={viewer}
      isAdmin={isAdmin}
      onLoginClick={onLoginClick}
      onLogout={onLogout}
      onAccountClick={onAccountClick}
      mysteryTitle={mysteryTitle}
    >
      <section className="build-wizard-page section">
        <div className="container">
          <div className="build-wizard-hero">
            <h1>Build Wizard</h1>
            <p>Dawsonville, GA focused planning workspace with phase tabs, permit checkpoints, and inline-editable build data.</p>
          </div>

          {openSummary}

          {!project ? null : (
            <>
              <div className="build-wizard-card">
                <h2>Build Profile (Inline Editable)</h2>
                <p className="build-wizard-muted">All profile fields update in place when you leave each field.</p>
                <div className="build-wizard-grid">
                  <label>
                    Build Name
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
                    Square Feet
                    <input
                      type="number"
                      value={projectDraft.square_feet ?? ''}
                      onChange={(e) => setProjectDraft((prev) => ({ ...prev, square_feet: toNumberOrNull(e.target.value) }))}
                      onBlur={() => void updateProject({ square_feet: projectDraft.square_feet })}
                    />
                  </label>
                  <label>
                    Style of Home
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
                    Lot Address
                    <input
                      type="text"
                      value={projectDraft.lot_address || ''}
                      onChange={(e) => setProjectDraft((prev) => ({ ...prev, lot_address: e.target.value }))}
                      onBlur={() => void updateProject({ lot_address: projectDraft.lot_address || '' })}
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
                  House Specifications Notes
                  <textarea
                    value={projectDraft.wizard_notes || ''}
                    onChange={(e) => setProjectDraft((prev) => ({ ...prev, wizard_notes: e.target.value }))}
                    onBlur={() => void updateProject({ wizard_notes: projectDraft.wizard_notes || '' })}
                    rows={4}
                  />
                </label>

                {saving ? <div className="build-wizard-muted">Saving updates...</div> : null}
              </div>

              <div className="build-wizard-card">
                <h2>Dawson County Permit & Approval Checklist</h2>
                <div className="build-wizard-checklist">
                  <div>Residential building permit with site plan / construction plans.</div>
                  <div>Land disturbance or erosion-control approval before grading (if required by scope).</div>
                  <div>Driveway approval for county roads or encroachment permit for state-route access (as applicable).</div>
                  <div>Environmental Health septic permit (or sewer utility approval) before permit closeout.</div>
                  <div>Electrical, plumbing, and mechanical rough/final inspections and certificate of occupancy.</div>
                </div>
              </div>

              <div className="build-wizard-card">
                <h2>Phase Tabs</h2>
                <div className="build-wizard-stats-row">
                  <span>Progress: {projectProgress.completedSteps}/{projectProgress.totalSteps} ({projectProgress.completionPct}%)</span>
                  <span>Estimated Budget: {formatCurrency(projectProgress.totalEstimatedCost)}</span>
                  <span>Actual Cost: {formatCurrency(projectProgress.totalActualCost)}</span>
                </div>

                <div className="build-wizard-phase-tabs">
                  {phases.map((p) => (
                    <button
                      key={p.phaseKey}
                      className={`build-wizard-phase-tab${activePhase === p.phaseKey ? ' is-active' : ''}`}
                      onClick={() => setActivePhase(p.phaseKey)}
                    >
                      {phaseLabel(p.phaseKey)}
                    </button>
                  ))}
                </div>

                <div className="build-wizard-step-table-wrap">
                  <table className="build-wizard-step-table">
                    <thead>
                      <tr>
                        <th>Done</th>
                        <th>Step</th>
                        <th>Description</th>
                        <th>Permit?</th>
                        <th>Permit Name</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Days</th>
                        <th>Est. Cost</th>
                        <th>Actual Cost</th>
                        <th>Completed At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePhaseSteps.map((step) => {
                        const draft = stepDrafts[step.id] || step;
                        return (
                          <tr key={step.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={Number(step.is_completed) === 1}
                                onChange={(e) => void toggleStep(step, e.target.checked)}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={draft.title || ''}
                                onChange={(e) => updateStepDraft(step.id, { title: e.target.value })}
                                onBlur={() => void commitStepPatch(step, { title: (stepDrafts[step.id]?.title || '').trim() })}
                              />
                            </td>
                            <td>
                              <textarea
                                rows={2}
                                value={draft.description || ''}
                                onChange={(e) => updateStepDraft(step.id, { description: e.target.value })}
                                onBlur={() => void commitStepPatch(step, { description: stepDrafts[step.id]?.description || '' })}
                              />
                            </td>
                            <td>
                              <select
                                value={Number(draft.permit_required) === 1 ? '1' : '0'}
                                onChange={(e) => {
                                  const next = e.target.value === '1' ? 1 : 0;
                                  updateStepDraft(step.id, { permit_required: next });
                                  void commitStepPatch(step, { permit_required: next });
                                }}
                              >
                                <option value="0">No</option>
                                <option value="1">Yes</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="text"
                                value={draft.permit_name || ''}
                                onChange={(e) => updateStepDraft(step.id, { permit_name: e.target.value })}
                                onBlur={() => void commitStepPatch(step, { permit_name: toStringOrNull(stepDrafts[step.id]?.permit_name || '') })}
                              />
                            </td>
                            <td>
                              <input
                                type="date"
                                value={draft.expected_start_date || ''}
                                onChange={(e) => updateStepDraft(step.id, { expected_start_date: toStringOrNull(e.target.value) })}
                                onBlur={() => void commitStepPatch(step, { expected_start_date: toStringOrNull(stepDrafts[step.id]?.expected_start_date || '') })}
                              />
                            </td>
                            <td>
                              <input
                                type="date"
                                value={draft.expected_end_date || ''}
                                onChange={(e) => updateStepDraft(step.id, { expected_end_date: toStringOrNull(e.target.value) })}
                                onBlur={() => void commitStepPatch(step, { expected_end_date: toStringOrNull(stepDrafts[step.id]?.expected_end_date || '') })}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={draft.expected_duration_days ?? ''}
                                onChange={(e) => updateStepDraft(step.id, { expected_duration_days: toNumberOrNull(e.target.value) })}
                                onBlur={() => void commitStepPatch(step, { expected_duration_days: toNumberOrNull(String(stepDrafts[step.id]?.expected_duration_days ?? '')) })}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                value={draft.estimated_cost ?? ''}
                                onChange={(e) => updateStepDraft(step.id, { estimated_cost: toNumberOrNull(e.target.value) })}
                                onBlur={() => void commitStepPatch(step, { estimated_cost: toNumberOrNull(String(stepDrafts[step.id]?.estimated_cost ?? '')) })}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                value={draft.actual_cost ?? ''}
                                onChange={(e) => updateStepDraft(step.id, { actual_cost: toNumberOrNull(e.target.value) })}
                                onBlur={() => void commitStepPatch(step, { actual_cost: toNumberOrNull(String(stepDrafts[step.id]?.actual_cost ?? '')) })}
                              />
                            </td>
                            <td>{formatDate(step.completed_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="build-wizard-card">
                <h2>Step Notes</h2>
                <div className="build-wizard-step-list">
                  {activePhaseSteps.map((step) => (
                    <div className="build-wizard-step" key={step.id}>
                      <div className="build-wizard-step-top">
                        <strong>#{step.step_order} {step.title}</strong>
                        <span>{phaseLabel(step.phase_key)}</span>
                      </div>
                      <div className="build-wizard-note-row">
                        <input
                          type="text"
                          placeholder="Add step note..."
                          value={noteDraftByStep[step.id] || ''}
                          onChange={(e) => setNoteDraftByStep((prev) => ({ ...prev, [step.id]: e.target.value }))}
                        />
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => void onNoteSubmit(step)}>Add Note</button>
                      </div>
                      {Array.isArray(step.notes) && step.notes.length ? (
                        <div className="build-wizard-note-list">
                          {step.notes.map((n) => (
                            <div key={n.id}><strong>{n.created_at}</strong>: {n.note_text}</div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="build-wizard-card">
                <h2>Documents</h2>
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
                  {documents.length ? documents.map((doc) => (
                    <a key={doc.id} href={doc.public_url} target="_blank" rel="noreferrer">
                      {doc.kind}: {doc.original_name}
                    </a>
                  )) : <div className="build-wizard-muted">No documents uploaded yet.</div>}
                </div>
              </div>

              <div className="build-wizard-card">
                <div className="build-wizard-ai-header">
                  <div>
                    <h2>AI Package</h2>
                    <p className="build-wizard-muted">Builds structured JSON from profile + documents + phase steps.</p>
                  </div>
                  <div className="build-wizard-ai-actions">
                    <button className="btn btn-success" disabled={aiBusy} onClick={() => void packageForAi()}>Build AI Package</button>
                    <button className="btn btn-primary" disabled={aiBusy} onClick={() => void generateStepsFromAi()}>
                      {aiBusy ? 'Sending to AI...' : 'Send to AI + Ingest Steps'}
                    </button>
                  </div>
                </div>

                <label>
                  Prompt Text
                  <textarea value={aiPromptText || ''} readOnly rows={4} />
                </label>
                <label>
                  Payload JSON
                  <textarea value={aiPayloadJson || ''} readOnly rows={10} />
                </label>
              </div>

              <div className="build-wizard-muted">Leading questions used for this workflow:</div>
              <div className="build-wizard-leading-questions">
                {questions.map((q) => (
                  <div key={q} className="build-wizard-question-item">{q}</div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </PageLayout>
  );
}
