import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';
import { FooterPhaseTimeline } from '../../components/pages/build-wizard/BuildWizardTimeline';
import { buildWizardTokenLabel } from '../buildWizardDropdownSettings';
import { formatDate, formatTimelineDate } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardStep } from '../../types/buildWizard';
import { ProjectOverviewPhaseSection } from './buildWizardPageRenderTypes';

interface BuildWizardProjectOverviewModalProps {
  formatCurrency: (value: number | null | undefined) => string;
  onClose: () => void;
  open: boolean;
  projectOverviewRange: { end: string; start: string };
  projectOverviewSections: ProjectOverviewPhaseSection[];
  projectOverviewTotals: { completedCount: number; stepCount: number; totalCost: number };
  steps: IBuildWizardStep[];
}

export function BuildWizardProjectOverviewModal({
  formatCurrency,
  onClose,
  open,
  projectOverviewRange,
  projectOverviewSections,
  projectOverviewTotals,
  steps,
}: BuildWizardProjectOverviewModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="build-wizard-doc-manager" onClick={onClose}>
      <div className="build-wizard-doc-manager-inner build-wizard-project-overview-inner" onClick={(e) => e.stopPropagation()}>
        <div className="build-wizard-doc-manager-head">
          <h3>Project Overview</h3>
          <div className="build-wizard-doc-manager-actions">
            <StandardIconButton iconKey="close" ariaLabel="Close project overview" title="Close" className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn" onClick={onClose} />
          </div>
        </div>

        <div className="build-wizard-project-overview-summary">
          <div className="build-wizard-project-overview-summary-item"><span>Total Steps</span><strong>{projectOverviewTotals.stepCount}</strong></div>
          <div className="build-wizard-project-overview-summary-item"><span>Completed</span><strong>{projectOverviewTotals.completedCount}</strong></div>
          <div className="build-wizard-project-overview-summary-item"><span>Projected Cost</span><strong>{formatCurrency(projectOverviewTotals.totalCost)}</strong></div>
          <div className="build-wizard-project-overview-summary-item"><span>Range</span><strong>{formatTimelineDate(projectOverviewRange.start)} - {formatTimelineDate(projectOverviewRange.end)}</strong></div>
        </div>

        <div className="build-wizard-project-overview-timeline-card">
          <h4>Master Timeline</h4>
          <FooterPhaseTimeline steps={steps} rangeStart={projectOverviewRange.start} rangeEnd={projectOverviewRange.end} activeTab="overview" editable={false} />
        </div>

        <div className="build-wizard-project-overview-phase-list">
          {projectOverviewSections.map((section) => (
            <section key={section.tabId} className="build-wizard-project-overview-phase">
              <header className="build-wizard-project-overview-phase-head">
                <h4>
                  <span className="build-wizard-project-overview-phase-dot" style={{ background: section.phaseColor }} />
                  {section.label}
                </h4>
                <div className="build-wizard-project-overview-phase-meta">
                  <span>{section.completedCount}/{section.stepCount} complete</span>
                  <span>{formatTimelineDate(section.startIso)} - {formatTimelineDate(section.endIso)}</span>
                  <span>{formatCurrency(section.totalCost)}</span>
                </div>
              </header>
              <div className="build-wizard-project-overview-step-list">
                {section.rows.map((row) => (
                  <article key={row.stepId} className={`build-wizard-project-overview-step-row${row.isCompleted ? ' is-completed' : ''}`}>
                    <div className="build-wizard-project-overview-step-title">
                      <div className="build-wizard-project-overview-step-main">
                        <span className="build-wizard-project-overview-step-number">#{row.displayOrder}</span>
                        <strong>{row.title}</strong>
                        <span className="build-wizard-project-overview-step-type">{buildWizardTokenLabel(row.stepType, 'Other')}</span>
                        {row.isCompleted ? <span className="build-wizard-project-overview-step-status">Completed</span> : null}
                      </div>
                      <div className="build-wizard-project-overview-step-meta">
                        <span>{formatDate(row.startIso)} - {formatDate(row.endIso)}</span>
                        <span>{row.durationDays ? `${row.durationDays} day(s)` : 'No duration'}</span>
                        <span>{row.assigneeCount} assignee(s)</span>
                        <span>{row.documentCount} doc(s)</span>
                      </div>
                    </div>
                    <div className="build-wizard-project-overview-step-cost">
                      <div>{formatCurrency(row.totalCost)}</div>
                      <span>{row.costMode === 'actual' ? 'Actual' : (row.costMode === 'estimated' ? 'Estimated' : 'Missing')}</span>
                    </div>
                    <div className="build-wizard-project-overview-step-timeline">
                      {row.hasTimeline ? (
                        <div className="build-wizard-project-overview-step-bar" style={{ left: `${row.leftPercent}%`, width: `${row.widthPercent}%`, background: section.phaseColor }} />
                      ) : (
                        <div className="build-wizard-project-overview-step-no-timeline">No timeline dates</div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
