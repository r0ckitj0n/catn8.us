import React from 'react';

import { FooterPhaseTimeline } from '../../components/pages/build-wizard/BuildWizardTimeline';
import { IBuildWizardDocument, IBuildWizardStep } from '../../types/buildWizard';
import { BuildTabId } from '../../types/pages/buildWizardPage';
import { BuildWizardCompletedSection, BuildWizardOverviewSection } from './buildWizardOverviewSections';
import { BuildWizardProjectDeskWorkspace } from './buildWizardProjectDeskWorkspace';
import { BuildWizardStartSection } from './buildWizardStartSection';
import { BuildWizardWorkspaceChrome } from './buildWizardWorkspaceChrome';

interface BuildWizardWorkspaceMainProps {
  activeTab: BuildTabId;
  activeTabStepNumbers: Map<number, number>;
  chromeProps: React.ComponentProps<typeof BuildWizardWorkspaceChrome>;
  children?: React.ReactNode;
  completedSectionProps: React.ComponentProps<typeof BuildWizardCompletedSection>;
  deskWorkspaceProps: React.ComponentProps<typeof BuildWizardProjectDeskWorkspace>;
  docKind: string;
  docKindOptions: Array<{ value: string; label: string }>;
  docPhaseKey: string;
  docStepId: number;
  documents: IBuildWizardDocument[];
  filteredTabSteps: IBuildWizardStep[];
  footerRange: { start: string; end: string };
  footerTimelineSteps: IBuildWizardStep[];
  onSetDocKind: (value: string) => void;
  onSetDocPhaseKey: (value: string) => void;
  onSetDocStepId: (value: number) => void;
  onTimelineStepChange: (stepId: number, patch: { expected_start_date: string | null; expected_end_date: string | null; expected_duration_days: number | null }) => void;
  onUploadDocument: (file: File) => void;
  overviewSectionProps: React.ComponentProps<typeof BuildWizardOverviewSection>;
  phaseOptions: Array<{ value: string; label: string }>;
  phaseTaskListCardRef: React.RefObject<HTMLDivElement | null>;
  renderDocumentGallery: (items: IBuildWizardDocument[], emptyText: string, readOnly?: boolean) => React.ReactNode;
  renderEditableStepCards: (stepsForTab: IBuildWizardStep[]) => React.ReactNode;
  selectableDocSteps: IBuildWizardStep[];
  startSectionProps: React.ComponentProps<typeof BuildWizardStartSection>;
  stickyTopOffset: number;
}

export function BuildWizardWorkspaceMain({
  activeTab,
  activeTabStepNumbers,
  chromeProps,
  children,
  completedSectionProps,
  deskWorkspaceProps,
  docKind,
  docKindOptions,
  docPhaseKey,
  docStepId,
  documents,
  filteredTabSteps,
  footerRange,
  footerTimelineSteps,
  onSetDocKind,
  onSetDocPhaseKey,
  onSetDocStepId,
  onTimelineStepChange,
  onUploadDocument,
  overviewSectionProps,
  phaseOptions,
  phaseTaskListCardRef,
  renderDocumentGallery,
  renderEditableStepCards,
  selectableDocSteps,
  startSectionProps,
  stickyTopOffset,
}: BuildWizardWorkspaceMainProps) {
  return (
    <div className="build-wizard-shell build-wizard-has-footer-space" style={{ ['--build-wizard-sticky-top' as string]: `${stickyTopOffset}px` }}>
      <div className="build-wizard-workspace">
        <BuildWizardWorkspaceChrome {...chromeProps} />

        {activeTab === 'overview' ? <BuildWizardOverviewSection {...overviewSectionProps} /> : null}

        {activeTab === 'start' ? <BuildWizardStartSection {...startSectionProps} /> : null}

        {activeTab !== 'overview' && activeTab !== 'start' && activeTab !== 'completed' ? (
          <div className="build-wizard-card" ref={phaseTaskListCardRef}>
            {activeTab === 'desk' ? (
              <div className="build-wizard-desk-grid">
                <div>
                  <h3>Documents</h3>
                  <div className="build-wizard-upload-row">
                    <select value={docKind} onChange={(e) => onSetDocKind(e.target.value)}>
                      {docKindOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <select value={docPhaseKey} onChange={(e) => onSetDocPhaseKey(e.target.value)}>
                      {phaseOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <select value={docStepId > 0 ? String(docStepId) : ''} onChange={(e) => onSetDocStepId(Number(e.target.value || '0'))}>
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
                          onUploadDocument(file);
                        }
                        e.currentTarget.value = '';
                      }}
                    />
                  </div>
                  <div className="build-wizard-doc-list">
                    {renderDocumentGallery(documents, 'No documents uploaded yet.')}
                  </div>
                </div>
              </div>
            ) : null}

            {renderEditableStepCards(filteredTabSteps)}
          </div>
        ) : null}

        {activeTab === 'completed' ? <BuildWizardCompletedSection {...completedSectionProps} /> : null}
      </div>

      <footer className="build-wizard-footer-chart">
        <div className="build-wizard-footer-inner">
          <FooterPhaseTimeline
            steps={footerTimelineSteps}
            rangeStart={footerRange.start}
            rangeEnd={footerRange.end}
            activeTab={activeTab}
            editable={true}
            displayNumberById={activeTabStepNumbers}
            onStepTimelineChange={onTimelineStepChange}
          />
        </div>
      </footer>

      <BuildWizardProjectDeskWorkspace {...deskWorkspaceProps} />
      {children}
    </div>
  );
}
