import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';
import { BUILD_TABS, PHASE_PROGRESS_ORDER, TAB_PHASE_COLORS } from '../../components/pages/build-wizard/buildWizardConstants';
import { toStringOrNull } from '../../components/pages/build-wizard/buildWizardUtils';
import { BuildTabId } from '../../types/pages/buildWizardPage';
import { BuildWizardContactType, contactTypeLabel, normalizeContactType } from './buildWizardPageRenderTypes';

interface BuildWizardWorkspaceChromeProps {
  activePhaseDateRange: { start: string | null; end: string | null };
  activePhaseHasStoredDateRange: boolean;
  activeTab: BuildTabId;
  buildEntryPoint: 'launcher' | 'template_editor';
  formatCurrency: (value: number) => string;
  isTemplateProject: boolean;
  onAddStep: () => Promise<unknown>;
  onBackFromWorkspace: () => void;
  onCloseWizard: () => void;
  onOpenAiTools: () => void;
  onOpenProjectDesk: () => void;
  onOpenProjectOverview: () => void;
  onPhaseDateRangeChange: (patch: { start?: string | null; end?: string | null }) => void;
  onRefreshPhaseOrder: () => Promise<unknown>;
  onResetFilters: () => void;
  onSaveTemplate: () => Promise<unknown>;
  onSelectTab: (tab: BuildTabId) => void;
  onSetStepCardAssigneeIdFilter: (value: number) => void;
  onSetStepCardAssigneeTypeFilter: (value: 'all' | BuildWizardContactType) => void;
  onSetStepCardTextFilter: (value: string) => void;
  onTopbarSearchQueryChange: (value: string) => void;
  onTopbarSearchSelect: (result: { id: string; kind: 'document' | 'step' | 'phase'; title: string; subtitle: string }) => void;
  onTopbarSearchToggle: (open: boolean) => void;
  phaseTotals: { phaseTotal: number; projectToDateTotal: number };
  project: { title?: string | null } | null;
  projectId: number;
  savePhaseDateRange: (projectId: number, phaseKey: 'land' | 'permits' | 'site' | 'framing' | 'mep' | 'finishes', start: string | null, end: string | null) => Promise<unknown>;
  saving: boolean;
  stepCardAssigneeIdFilter: number;
  stepCardAssigneeTypeFilter: 'all' | BuildWizardContactType;
  stepCardTextFilter: string;
  stepCardTextFilterTokens: string[];
  stepFilterContactOptions: Array<{ id: number; display_name: string; contact_type?: 'vendor' | 'contact' | 'authority' | null; is_vendor?: number | null }>;
  stickyHeadHeight: number;
  stickyHeadRef: React.RefObject<HTMLDivElement | null>;
  topbarSearchBoxRef: React.RefObject<HTMLDivElement | null>;
  topbarSearchLoading: boolean;
  topbarSearchOpen: boolean;
  topbarSearchQuery: string;
  topbarSearchResults: Array<{ id: string; kind: 'document' | 'step' | 'phase'; title: string; subtitle: string }>;
}

export function BuildWizardWorkspaceChrome({
  activePhaseDateRange,
  activePhaseHasStoredDateRange,
  activeTab,
  buildEntryPoint,
  formatCurrency,
  isTemplateProject,
  onAddStep,
  onBackFromWorkspace,
  onCloseWizard,
  onOpenAiTools,
  onOpenProjectDesk,
  onOpenProjectOverview,
  onPhaseDateRangeChange,
  onRefreshPhaseOrder,
  onResetFilters,
  onSaveTemplate,
  onSelectTab,
  onSetStepCardAssigneeIdFilter,
  onSetStepCardAssigneeTypeFilter,
  onSetStepCardTextFilter,
  onTopbarSearchQueryChange,
  onTopbarSearchSelect,
  onTopbarSearchToggle,
  phaseTotals,
  project,
  projectId,
  savePhaseDateRange,
  saving,
  stepCardAssigneeIdFilter,
  stepCardAssigneeTypeFilter,
  stepCardTextFilter,
  stepCardTextFilterTokens,
  stepFilterContactOptions,
  stickyHeadHeight,
  stickyHeadRef,
  topbarSearchBoxRef,
  topbarSearchLoading,
  topbarSearchOpen,
  topbarSearchQuery,
  topbarSearchResults,
}: BuildWizardWorkspaceChromeProps) {
  return (
    <>
      <div className="build-wizard-sticky-head" ref={stickyHeadRef}>
        <div className="build-wizard-topbar">
          <button className="btn btn-outline-secondary" onClick={onBackFromWorkspace}>
            {isTemplateProject || buildEntryPoint === 'template_editor' ? 'Back to Template Editor' : 'Back to Launcher'}
          </button>
          <div className="build-wizard-topbar-title">{project?.title || 'Home Build'}</div>
          <div className="build-wizard-topbar-search-shell" ref={topbarSearchBoxRef}>
            <input
              type="search"
              value={topbarSearchQuery}
              onFocus={() => onTopbarSearchToggle(true)}
              onChange={(e) => {
                onTopbarSearchQueryChange(e.target.value);
                onTopbarSearchToggle(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onTopbarSearchToggle(false);
                  return;
                }
                if (e.key === 'Enter' && topbarSearchResults.length > 0) {
                  e.preventDefault();
                  onTopbarSearchSelect(topbarSearchResults[0]);
                }
              }}
              className="form-control form-control-sm build-wizard-topbar-search-input"
              placeholder="Search docs, steps, phases..."
              aria-label="Search build wizard content"
            />
            {topbarSearchOpen && topbarSearchQuery.trim() ? (
              <div className="build-wizard-topbar-search-results" role="listbox" aria-label="Build wizard search results">
                {topbarSearchResults.length === 0 ? (
                  <div className="build-wizard-topbar-search-empty">
                    No matches yet.
                    {topbarSearchLoading ? ' Searching...' : ''}
                  </div>
                ) : (
                  topbarSearchResults.map((result) => (
                    <button key={result.id} type="button" className="build-wizard-topbar-search-result" onClick={() => onTopbarSearchSelect(result)}>
                      <span className="build-wizard-topbar-search-result-kind">
                        {result.kind === 'document' ? 'Doc' : result.kind === 'step' ? 'Step' : 'Phase'}
                      </span>
                      <span className="build-wizard-topbar-search-result-text">
                        <strong>{result.title}</strong>
                        <span>{result.subtitle}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <div className="build-wizard-topbar-actions">
            {isTemplateProject ? (
              <button className="btn btn-success btn-sm" onClick={() => { void onSaveTemplate(); }} disabled={saving}>
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            ) : null}
            <button className="btn btn-primary btn-sm" onClick={onOpenAiTools}>AI Tools</button>
            <button className="btn btn-outline-primary btn-sm" onClick={onOpenProjectOverview}>Project Overview</button>
            <button className="btn btn-outline-primary btn-sm" onClick={onOpenProjectDesk}>Project Desk</button>
            <StandardIconButton iconKey="close" ariaLabel="Close Build Wizard" title="Close Build Wizard" className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn" onClick={onCloseWizard} />
          </div>
        </div>

        <div className="build-wizard-tabs">
          {BUILD_TABS.filter((tab) => tab.id !== 'desk').map((tab) => (
            <button key={tab.id} className={`build-wizard-tab${activeTab === tab.id ? ' is-active' : ''}`} style={{ ['--tab-phase-color' as string]: TAB_PHASE_COLORS[tab.id] }} onClick={() => onSelectTab(tab.id)}>
              <span className="build-wizard-tab-swatch" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab !== 'overview' && activeTab !== 'start' && activeTab !== 'completed' ? (
          <div className="build-wizard-sticky-phase-controls">
            <div className="build-wizard-phase-head">
              <h2>{BUILD_TABS.find((t) => t.id === activeTab)?.label}</h2>
              <div className="build-wizard-phase-totals">
                <span>Phase Total: <span className="build-wizard-phase-total-value">{formatCurrency(phaseTotals.phaseTotal)}</span></span>
                <span>Project Total To Date: <span className="build-wizard-phase-total-value">{formatCurrency(phaseTotals.projectToDateTotal)}</span></span>
              </div>
              <div className="build-wizard-phase-date-range">
                <label>
                  Phase Start
                  <input type="date" value={activePhaseDateRange.start || ''} max={activePhaseDateRange.end || undefined} onChange={(e) => onPhaseDateRangeChange({ start: toStringOrNull(e.target.value) })} />
                </label>
                <label>
                  Phase End
                  <input type="date" value={activePhaseDateRange.end || ''} min={activePhaseDateRange.start || undefined} onChange={(e) => onPhaseDateRangeChange({ end: toStringOrNull(e.target.value) })} />
                </label>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm build-wizard-phase-range-reset"
                  disabled={!activePhaseHasStoredDateRange}
                  title="Reset phase dates to auto-derived step range"
                  onClick={() => {
                    if (!PHASE_PROGRESS_ORDER.includes(activeTab)) {
                      return;
                    }
                    void savePhaseDateRange(projectId, activeTab as 'land' | 'permits' | 'site' | 'framing' | 'mep' | 'finishes', null, null);
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="build-wizard-step-assignee-filters">
              <span>Step Card Filters</span>
              <select value={stepCardAssigneeTypeFilter} onChange={(e) => onSetStepCardAssigneeTypeFilter(e.target.value as 'all' | BuildWizardContactType)}>
                <option value="all">All Contacts</option>
                <option value="contact">Contacts Only</option>
                <option value="vendor">Vendors Only</option>
                <option value="authority">Authorities Only</option>
              </select>
              <select value={stepCardAssigneeIdFilter > 0 ? String(stepCardAssigneeIdFilter) : ''} onChange={(e) => onSetStepCardAssigneeIdFilter(Number(e.target.value || '0'))}>
                <option value="">All Assigned People</option>
                {stepFilterContactOptions.map((contact) => (
                  <option key={`step-filter-contact-${contact.id}`} value={contact.id}>
                    {contactTypeLabel(normalizeContactType({ contact_type: contact.contact_type || 'contact', is_vendor: contact.is_vendor ?? 0 }))}: {contact.display_name}
                  </option>
                ))}
              </select>
              <input type="search" className="form-control form-control-sm build-wizard-step-text-filter-input" placeholder="Filter step text..." aria-label="Filter steps by text" value={stepCardTextFilter} onChange={(e) => onSetStepCardTextFilter(e.target.value)} />
              {(stepCardAssigneeTypeFilter !== 'all' || stepCardAssigneeIdFilter > 0 || stepCardTextFilterTokens.length > 0) ? (
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onResetFilters}>
                  Clear Filters
                </button>
              ) : null}
              <button
                type="button"
                className="build-wizard-phase-add build-wizard-phase-refresh build-wizard-phase-add-in-filters"
                title="Refresh step order from dates"
                aria-label="Refresh step order from dates"
                onClick={() => { void onRefreshPhaseOrder(); }}
              >
                🔄
              </button>
              <button type="button" className="build-wizard-phase-add build-wizard-phase-add-in-filters" title="Add step" aria-label="Add step" onClick={() => { void onAddStep(); }}>
                +
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="build-wizard-sticky-head-spacer" aria-hidden="true" style={{ height: stickyHeadHeight }} />
    </>
  );
}
