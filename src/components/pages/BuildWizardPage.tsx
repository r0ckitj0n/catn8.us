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

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(Number(value))) {
    return '-';
  }
  return Number(value).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }
  return value;
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
    questions,
    questionnaire,
    setQuestionnaire,
    steps,
    documents,
    aiPromptText,
    aiPayloadJson,
    saveQuestionnaire,
    toggleStep,
    addStepNote,
    uploadDocument,
    packageForAi,
  } = useBuildWizard(onToast);

  const [docKind, setDocKind] = React.useState<string>('blueprint');
  const [noteDraftByStep, setNoteDraftByStep] = React.useState<Record<number, string>>({});

  const onNumberChange = (field: 'square_feet' | 'room_count' | 'bathroom_count' | 'stories_count', value: string) => {
    setQuestionnaire((prev) => ({
      ...prev,
      [field]: value.trim() === '' ? null : Number(value),
    }));
  };

  const onNoteSubmit = async (step: IBuildWizardStep) => {
    const draft = String(noteDraftByStep[step.id] || '').trim();
    if (!draft) {
      return;
    }
    await addStepNote(step.id, draft);
    setNoteDraftByStep((prev) => ({ ...prev, [step.id]: '' }));
  };

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
            <p>Plan your house build from permit to move-in, track timeline completion, and package everything for AI planning.</p>
          </div>

          <div className="build-wizard-card">
            <h2>1) Home Profile Questions</h2>
            <p className="build-wizard-muted">Answer these upfront so AI can generate the right build sequence from your blueprint and paperwork.</p>
            <div className="build-wizard-leading-questions">
              {questions.map((q) => (
                <div key={q} className="build-wizard-question-item">{q}</div>
              ))}
            </div>

            <div className="build-wizard-grid">
              <label>
                Square Feet
                <input type="number" value={questionnaire.square_feet ?? ''} onChange={(e) => onNumberChange('square_feet', e.target.value)} />
              </label>
              <label>
                Style of Home
                <input type="text" value={questionnaire.home_style || ''} onChange={(e) => setQuestionnaire((prev) => ({ ...prev, home_style: e.target.value }))} />
              </label>
              <label>
                Number of Rooms
                <input type="number" value={questionnaire.room_count ?? ''} onChange={(e) => onNumberChange('room_count', e.target.value)} />
              </label>
              <label>
                Number of Bathrooms
                <input type="number" value={questionnaire.bathroom_count ?? ''} onChange={(e) => onNumberChange('bathroom_count', e.target.value)} />
              </label>
              <label>
                Stories
                <input type="number" value={questionnaire.stories_count ?? ''} onChange={(e) => onNumberChange('stories_count', e.target.value)} />
              </label>
              <label>
                Lot Address
                <input type="text" value={questionnaire.lot_address || ''} onChange={(e) => setQuestionnaire((prev) => ({ ...prev, lot_address: e.target.value }))} />
              </label>
              <label>
                Target Start Date
                <input
                  type="date"
                  value={questionnaire.target_start_date || ''}
                  onChange={(e) => setQuestionnaire((prev) => ({ ...prev, target_start_date: e.target.value || null }))}
                />
              </label>
              <label>
                Target Completion Date
                <input
                  type="date"
                  value={questionnaire.target_completion_date || ''}
                  onChange={(e) => setQuestionnaire((prev) => ({ ...prev, target_completion_date: e.target.value || null }))}
                />
              </label>
            </div>

            <label className="build-wizard-notes-field">
              House Specifications Notes
              <textarea
                value={questionnaire.wizard_notes || ''}
                onChange={(e) => setQuestionnaire((prev) => ({ ...prev, wizard_notes: e.target.value }))}
                rows={5}
                placeholder="Add key requirements, room notes, materials preferences, inspection constraints, and anything AI should consider."
              />
            </label>

            <button className="btn btn-primary" disabled={saving || loading} onClick={() => void saveQuestionnaire()}>
              {saving ? 'Saving...' : 'Save Home Profile'}
            </button>
          </div>

          <div className="build-wizard-card">
            <h2>2) Blueprint and House Paperwork Uploads</h2>
            <p className="build-wizard-muted">Upload blueprint first, then permits/spec docs/surveys so the AI package has the full picture.</p>
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
                <h2>3) Package for AI Analysis</h2>
                <p className="build-wizard-muted">Builds a structured payload from profile + docs + timeline for your existing catn8 AI agent.</p>
              </div>
              <button className="btn btn-success" onClick={() => void packageForAi()}>Build AI Package</button>
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

          <div className="build-wizard-card">
            <h2>4) House Build Timeline</h2>
            <p className="build-wizard-muted">Seeded from your cabin spreadsheets. No steps are pre-completed. Checking a step stamps completion time.</p>
            <div className="build-wizard-step-list">
              {steps.map((step) => (
                <div className="build-wizard-step" key={step.id}>
                  <div className="build-wizard-step-top">
                    <label className="build-wizard-step-check">
                      <input
                        type="checkbox"
                        checked={Number(step.is_completed) === 1}
                        onChange={(e) => void toggleStep(step, e.target.checked)}
                      />
                      <span>
                        <strong>#{step.step_order}</strong> {step.title}
                      </span>
                    </label>
                    {Number(step.permit_required) === 1 ? <span className="badge bg-warning text-dark">Permit / Inspection</span> : null}
                  </div>

                  <div className="build-wizard-step-meta">
                    <span>Phase: {step.phase_key}</span>
                    <span>Estimated Cost: {formatCurrency(step.estimated_cost)}</span>
                    <span>Expected Duration: {step.expected_duration_days ?? '-'} days</span>
                    <span>Expected Start: {formatDate(step.expected_start_date)}</span>
                    <span>Expected End: {formatDate(step.expected_end_date)}</span>
                    <span>Completed At: {formatDate(step.completed_at)}</span>
                  </div>

                  <div className="build-wizard-step-desc">{step.description}</div>

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
        </div>
      </section>
    </PageLayout>
  );
}
