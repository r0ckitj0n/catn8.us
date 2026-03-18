import React from 'react';

import { DateRangeChart } from '../../components/pages/build-wizard/BuildWizardTimeline';
import { IBuildWizardContact, IBuildWizardStep } from '../../types/buildWizard';

type OverviewNextStep = {
  phaseLabel: string;
  phaseStepNumber: number | null;
  step: IBuildWizardStep;
};

type OverviewMetrics = {
  aiEstimatedCostSteps: number;
  endCountdownDays: number | null;
  endDate: string | null;
  missingEstimateCount: number;
  missingTimelineCount: number;
  nextStep: OverviewNextStep | null;
  projectedTotal: number;
  remainingProjected: number;
  spentActual: number;
  startCountdownDays: number | null;
  startDate: string | null;
};

type StepAssigneeEntry = {
  contact: IBuildWizardContact;
  source: 'phase' | 'step';
};

interface BuildWizardOverviewSectionProps {
  aiBusy: boolean;
  focusNextStep: (step: IBuildWizardStep) => void;
  formatCurrency: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  formatTimelineDate: (value: string | null | undefined) => string;
  onEstimateMissingWithAi: () => Promise<unknown>;
  overviewMetrics: OverviewMetrics;
  projectPhotosSection: React.ReactNode;
}

export function BuildWizardOverviewSection({
  aiBusy,
  focusNextStep,
  formatCurrency,
  formatDate,
  formatTimelineDate,
  onEstimateMissingWithAi,
  overviewMetrics,
  projectPhotosSection,
}: BuildWizardOverviewSectionProps) {
  return (
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
        {overviewMetrics.nextStep ? (
          <button type="button" className="build-wizard-overview-metric build-wizard-overview-metric-button" onClick={() => focusNextStep(overviewMetrics.nextStep!.step)} title="Open this step in its phase timeline">
            <div className="build-wizard-overview-label">Next Looming Step</div>
            <div className="build-wizard-overview-value">
              {`${overviewMetrics.nextStep.phaseLabel}${overviewMetrics.nextStep.phaseStepNumber ? `, Step ${overviewMetrics.nextStep.phaseStepNumber}` : ''}: ${overviewMetrics.nextStep.step.title}`}
            </div>
            <div className="build-wizard-overview-sub">
              {`${formatDate(overviewMetrics.nextStep.step.expected_start_date)} - ${formatDate(overviewMetrics.nextStep.step.expected_end_date)}`}
            </div>
          </button>
        ) : (
          <div className="build-wizard-overview-metric">
            <div className="build-wizard-overview-label">Next Looming Step</div>
            <div className="build-wizard-overview-value">No upcoming step dates</div>
            <div className="build-wizard-overview-sub">Add expected dates to upcoming steps.</div>
          </div>
        )}
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
          <div className="build-wizard-overview-spent" style={{ width: `${overviewMetrics.projectedTotal > 0 ? Math.min(100, (overviewMetrics.spentActual / overviewMetrics.projectedTotal) * 100) : 0}%` }} />
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

      {projectPhotosSection}
    </div>
  );
}

interface BuildWizardCompletedSectionProps {
  completedSteps: IBuildWizardStep[];
  contactTypeChipClass: (value: string) => string;
  contactTypeLabel: (value: string) => string;
  footerRange: { end: string; start: string };
  formatCurrency: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  normalizeContactType: (contact: IBuildWizardContact) => string;
  noteEditedAtLabel: (note: { created_at: string; updated_at?: string | null }) => string;
  stepAssigneesByStepId: Map<number, StepAssigneeEntry[]>;
  stepCostTotalExcludingQuotes: (step: IBuildWizardStep) => number;
}

export function BuildWizardCompletedSection({
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
}: BuildWizardCompletedSectionProps) {
  return (
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
  );
}
