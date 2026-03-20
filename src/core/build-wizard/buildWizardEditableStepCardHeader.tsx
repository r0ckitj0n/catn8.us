import React from 'react';

import { parseDate, toIsoDate } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardStep } from '../../types/buildWizard';

interface BuildWizardEditableStepCardHeaderProps {
  changeCurrencyEdit: (key: string, text: string) => void;
  commitStep: (stepId: number, patch: Partial<IBuildWizardStep>) => Promise<void>;
  completionLocked: boolean;
  durationDays: number | null;
  effectiveActualCost: number | null;
  estimatedCost: number | null;
  finishCurrencyEdit: (key: string, onCommit: (value: number | null) => void) => void;
  hasStepTasks: boolean;
  incompleteDescendantCount: number;
  isActualCostVerified: boolean;
  isExpanded: boolean;
  isRefreshingActualCost: boolean;
  onDeleteStep: () => void;
  onOpenMoveStepModal: (stepId: number) => void;
  onRefreshActualCost: () => void;
  onSetExpanded: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onSetStepInfoModalStepId: React.Dispatch<React.SetStateAction<number>>;
  onTimelineStepChange: (stepId: number, patch: {
    expected_start_date: string | null;
    expected_end_date: string | null;
    expected_duration_days: number | null;
  }) => void;
  openStepEditModal: (step: IBuildWizardStep) => void;
  renderCurrencyInputValue: (key: string, value: number | null | undefined) => string;
  rowLevel: number;
  step: IBuildWizardStep;
  stepDraft: IBuildWizardStep;
  stepAttachmentCount: number;
  stepDisplayNumber: number;
  stepTaskCount: number;
  stepReadOnly: boolean;
  startCurrencyEdit: (key: string, value: number | null | undefined) => void;
  toggleStep: (step: IBuildWizardStep, completed: boolean) => Promise<unknown>;
  updateStepDraft: (stepId: number, patch: Partial<IBuildWizardStep>) => void;
}

export function BuildWizardEditableStepCardHeader({
  changeCurrencyEdit,
  commitStep,
  completionLocked,
  durationDays,
  effectiveActualCost,
  estimatedCost,
  finishCurrencyEdit,
  hasStepTasks,
  incompleteDescendantCount,
  isActualCostVerified,
  isExpanded,
  isRefreshingActualCost,
  onDeleteStep,
  onOpenMoveStepModal,
  onRefreshActualCost,
  onSetExpanded,
  onSetStepInfoModalStepId,
  onTimelineStepChange,
  openStepEditModal,
  renderCurrencyInputValue,
  rowLevel,
  step,
  stepDraft,
  stepAttachmentCount,
  stepDisplayNumber,
  stepTaskCount,
  stepReadOnly,
  startCurrencyEdit,
  toggleStep,
  updateStepDraft,
}: BuildWizardEditableStepCardHeaderProps) {
  const estimatedCostKey = `step-${step.id}-estimated_cost`;
  const actualCostKey = `step-${step.id}-actual_cost`;
  const [editingField, setEditingField] = React.useState<'duration' | 'start' | 'end' | 'estimated_cost' | 'actual_cost' | null>(null);

  const applyDatePatch = React.useCallback((patch: {
    expected_start_date: string | null;
    expected_end_date: string | null;
    expected_duration_days: number | null;
  }) => {
    updateStepDraft(step.id, patch);
    onTimelineStepChange(step.id, patch);
  }, [onTimelineStepChange, step.id, updateStepDraft]);

  const handleDurationChange = React.useCallback((rawValue: string) => {
    const nextDuration = rawValue.trim() === '' ? null : Math.max(1, Math.round(Number(rawValue)));
    if (nextDuration === null || !Number.isFinite(nextDuration)) {
      return;
    }
    const currentStart = stepDraft.expected_start_date || stepDraft.expected_end_date || null;
    const currentEnd = stepDraft.expected_end_date || stepDraft.expected_start_date || null;
    const anchorDate = parseDate(currentStart || currentEnd);
    if (!anchorDate) {
      updateStepDraft(step.id, { expected_duration_days: nextDuration });
      return;
    }
    const nextEndDate = new Date(anchorDate);
    nextEndDate.setDate(nextEndDate.getDate() + Math.max(0, nextDuration - 1));
    applyDatePatch({
      expected_start_date: currentStart || toIsoDate(anchorDate),
      expected_end_date: toIsoDate(nextEndDate),
      expected_duration_days: nextDuration,
    });
  }, [applyDatePatch, step.id, stepDraft.expected_end_date, stepDraft.expected_start_date, updateStepDraft]);

  const handleStartDateChange = React.useCallback((nextStartValue: string) => {
    const nextStart = nextStartValue || null;
    const nextEnd = stepDraft.expected_end_date || nextStart;
    applyDatePatch({
      expected_start_date: nextStart,
      expected_end_date: nextEnd,
      expected_duration_days: durationDays,
    });
  }, [applyDatePatch, durationDays, stepDraft.expected_end_date]);

  const handleEndDateChange = React.useCallback((nextEndValue: string) => {
    const nextEnd = nextEndValue || null;
    const nextStart = stepDraft.expected_start_date || nextEnd;
    applyDatePatch({
      expected_start_date: nextStart,
      expected_end_date: nextEnd,
      expected_duration_days: durationDays,
    });
  }, [applyDatePatch, durationDays, stepDraft.expected_start_date]);

  const commitCurrencyField = React.useCallback((field: 'estimated_cost' | 'actual_cost', value: number | null) => {
    updateStepDraft(step.id, { [field]: value });
    void commitStep(step.id, { [field]: value });
  }, [commitStep, step.id, updateStepDraft]);

  const closeInlineEditor = React.useCallback(() => {
    setEditingField(null);
  }, []);

  return (
    <div className="build-wizard-step-header">
      <div className="build-wizard-step-header-left">
        <div className="build-wizard-step-handle-stack">
          <button type="button" className="build-wizard-step-drag-handle-btn" draggable={!stepReadOnly} disabled={stepReadOnly} aria-label={stepReadOnly ? 'Step is read-only' : 'Drag to reorder step'} title={stepReadOnly ? 'Read-only step' : 'Drag to reorder'}>⋮⋮</button>
          {hasStepTasks ? <span className="build-wizard-step-task-indicator" aria-label={`Step has ${stepTaskCount} task${stepTaskCount === 1 ? '' : 's'}`} title={`Has ${stepTaskCount} task${stepTaskCount === 1 ? '' : 's'}`} /> : null}
          <button type="button" className="build-wizard-step-expand-btn" onClick={() => onSetExpanded((prev) => ({ ...prev, [step.id]: !isExpanded }))} aria-label={isExpanded ? 'Collapse step card' : 'Expand step card'} title={isExpanded ? 'Collapse step' : 'Expand step'}>
            {isExpanded ? '▾' : '▸'}
          </button>
        </div>
        {rowLevel > 0 ? <span className="build-wizard-child-glyph" aria-hidden="true">↳</span> : null}
        <div className="build-wizard-inline-check">
          <label className="build-wizard-inline-complete-toggle">
            <input type="checkbox" checked={Number(step.is_completed) === 1} disabled={completionLocked} onChange={(e) => void toggleStep(step, e.target.checked)} />
            <span>Complete</span>
          </label>
          <span className="build-wizard-step-order-pill" title="Step number is automatically set from timeline order">#{stepDisplayNumber}</span>
        </div>
        <div className="build-wizard-step-metrics-panel">
          <div className="build-wizard-step-title-display">{stepDraft.title || 'Untitled Step'}</div>
          <div className="build-wizard-inline-metrics">
            <label className="build-wizard-duration-inline">
              <span>Duration (Days)</span>
              {editingField === 'duration' ? (
                <input
                  type="number"
                  min="1"
                  step="1"
                  autoFocus
                  value={durationDays ?? ''}
                  disabled={stepReadOnly}
                  onChange={(e) => handleDurationChange(e.target.value)}
                  onBlur={closeInlineEditor}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                    if (e.key === 'Escape') {
                      closeInlineEditor();
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="build-wizard-inline-edit-trigger"
                  disabled={stepReadOnly}
                  onClick={() => setEditingField('duration')}
                >
                  {durationDays ?? '-'}
                </button>
              )}
            </label>
            <label className="build-wizard-date-inline">
              <span>Start</span>
              {editingField === 'start' ? (
                <input
                  type="date"
                  autoFocus
                  value={stepDraft.expected_start_date || ''}
                  disabled={stepReadOnly}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  onBlur={closeInlineEditor}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                    if (e.key === 'Escape') {
                      closeInlineEditor();
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="build-wizard-inline-edit-trigger"
                  disabled={stepReadOnly}
                  onClick={() => setEditingField('start')}
                >
                  {stepDraft.expected_start_date || '-'}
                </button>
              )}
            </label>
            <label className="build-wizard-date-inline">
              <span>End</span>
              {editingField === 'end' ? (
                <input
                  type="date"
                  autoFocus
                  value={stepDraft.expected_end_date || ''}
                  disabled={stepReadOnly}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  onBlur={closeInlineEditor}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                    if (e.key === 'Escape') {
                      closeInlineEditor();
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="build-wizard-inline-edit-trigger"
                  disabled={stepReadOnly}
                  onClick={() => setEditingField('end')}
                >
                  {stepDraft.expected_end_date || '-'}
                </button>
              )}
            </label>
            <label className="build-wizard-date-inline">
              <span>Estimated Cost</span>
              {editingField === 'estimated_cost' ? (
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={renderCurrencyInputValue(estimatedCostKey, estimatedCost)}
                  disabled={stepReadOnly}
                  onFocus={() => startCurrencyEdit(estimatedCostKey, estimatedCost)}
                  onChange={(e) => changeCurrencyEdit(estimatedCostKey, e.target.value)}
                  onBlur={() => {
                    finishCurrencyEdit(estimatedCostKey, (value) => commitCurrencyField('estimated_cost', value));
                    closeInlineEditor();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                    if (e.key === 'Escape') {
                      closeInlineEditor();
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="build-wizard-inline-edit-trigger"
                  disabled={stepReadOnly}
                  onClick={() => setEditingField('estimated_cost')}
                >
                  {estimatedCost !== null ? renderCurrencyInputValue(estimatedCostKey, estimatedCost) : '-'}
                </button>
              )}
            </label>
            <div className="build-wizard-date-inline">
              <span className="build-wizard-cost-label-row">
                <span>Actual Cost</span>
                <span className="build-wizard-cost-actions">
                  <button type="button" className="build-wizard-actual-cost-refresh-btn" disabled={stepReadOnly || isRefreshingActualCost} aria-label="Recalculate actual cost from tasks" title="Recalculate actual cost from tasks" onClick={onRefreshActualCost}>
                    {isRefreshingActualCost ? '⏳' : '🔄'}
                  </button>
                  {isActualCostVerified ? <span className="build-wizard-actual-cost-check" aria-label="Actual cost is up to date" title="Actual cost is up to date">✓</span> : null}
                </span>
              </span>
              {editingField === 'actual_cost' ? (
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={renderCurrencyInputValue(actualCostKey, effectiveActualCost)}
                  disabled={stepReadOnly}
                  onFocus={() => startCurrencyEdit(actualCostKey, effectiveActualCost)}
                  onChange={(e) => changeCurrencyEdit(actualCostKey, e.target.value)}
                  onBlur={() => {
                    finishCurrencyEdit(actualCostKey, (value) => commitCurrencyField('actual_cost', value));
                    closeInlineEditor();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                    if (e.key === 'Escape') {
                      closeInlineEditor();
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="build-wizard-inline-edit-trigger"
                  disabled={stepReadOnly}
                  onClick={() => setEditingField('actual_cost')}
                >
                  {effectiveActualCost !== null ? renderCurrencyInputValue(actualCostKey, effectiveActualCost) : '-'}
                </button>
              )}
            </div>
          </div>
        </div>
        {completionLocked ? <span className="build-wizard-parent-lock-note">Complete {incompleteDescendantCount} child step{incompleteDescendantCount === 1 ? '' : 's'} first</span> : null}
        {stepReadOnly ? <span className="build-wizard-step-readonly-note">Read-only (completed)</span> : null}
      </div>
      <div className="build-wizard-step-header-right">
        <button type="button" className="btn btn-outline-primary btn-sm" aria-label="Edit step" title="Edit step" disabled={stepReadOnly} onClick={() => openStepEditModal(step)}>Edit</button>
        {stepAttachmentCount > 0 ? (
          <span className="build-wizard-step-attachment-indicator" aria-label={`${stepAttachmentCount} attachment${stepAttachmentCount === 1 ? '' : 's'} on this step`} title={`${stepAttachmentCount} attachment${stepAttachmentCount === 1 ? '' : 's'}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12.5l6.2-6.2a3.5 3.5 0 0 1 5 5l-8.4 8.4a5.5 5.5 0 1 1-7.8-7.8L13.1 1.8" /></svg>
          </span>
        ) : null}
        <button type="button" className="btn btn-outline-primary btn-sm" aria-label="Move step" title="Move step to another phase" disabled={stepReadOnly} onClick={() => onOpenMoveStepModal(step.id)}>Move</button>
        <button type="button" className="build-wizard-step-info-btn" aria-label="Step information" title="Step information" onClick={() => onSetStepInfoModalStepId(step.id)}>i</button>
        <button type="button" className="build-wizard-step-delete" aria-label="Delete step" title="Delete step" disabled={stepReadOnly} onClick={onDeleteStep}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </div>
    </div>
  );
}
