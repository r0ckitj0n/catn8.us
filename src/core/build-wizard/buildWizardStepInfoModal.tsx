import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';
import { IBuildWizardStep } from '../../types/buildWizard';

interface BuildWizardStepInfoModalProps {
  activeTabStepNumbers: Map<number, number>;
  formatAuditValue: (value: unknown, field?: string) => string;
  formatDate: (value: string | null | undefined) => string;
  noteEditedAtLabel: (note: IBuildWizardStep['notes'][number]) => string;
  onClose: () => void;
  open: boolean;
  step: IBuildWizardStep | null;
}

export function BuildWizardStepInfoModal({
  activeTabStepNumbers,
  formatAuditValue,
  formatDate,
  noteEditedAtLabel,
  onClose,
  open,
  step,
}: BuildWizardStepInfoModalProps) {
  if (!open || !step) {
    return null;
  }

  return (
    <div className="build-wizard-doc-manager" onClick={onClose}>
      <div className="build-wizard-doc-manager-inner build-wizard-step-info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="build-wizard-doc-manager-head">
          <h3>Step #{activeTabStepNumbers.get(step.id) || step.step_order} Information</h3>
          <div className="build-wizard-doc-manager-actions">
            <StandardIconButton
              iconKey="close"
              ariaLabel="Close step information"
              title="Close"
              className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
              onClick={onClose}
            />
          </div>
        </div>

        <div className="build-wizard-step-info-grid">
          <div className="build-wizard-step-info-card">
            <h4>Timestamps</h4>
            <div><strong>Created:</strong> {formatDate(step.created_at)}</div>
            <div><strong>Updated:</strong> {formatDate(step.updated_at)}</div>
            <div><strong>Completed:</strong> {formatDate(step.completed_at)}</div>
          </div>

          <div className="build-wizard-step-info-card">
            <h4>Record History</h4>
            {Array.isArray(step.audit_logs) && step.audit_logs.length > 0 ? (
              <div className="build-wizard-step-history-list">
                {step.audit_logs.map((log) => {
                  const changeEntries = log.changes && typeof log.changes === 'object'
                    ? Object.entries(log.changes as Record<string, unknown>)
                    : [];
                  return (
                    <div className="build-wizard-step-history-item" key={`step-log-${log.id}`}>
                      <div className="build-wizard-step-history-head">
                        <span>{String(log.action_key || 'updated').replace(/_/g, ' ')}</span>
                        <span>{formatDate(log.created_at)}</span>
                      </div>
                      {changeEntries.length > 0 ? (
                        <div className="build-wizard-step-history-changes">
                          {changeEntries.map(([field, value]) => {
                            const change = value as { before?: unknown; after?: unknown };
                            const hasBeforeAfter = change && typeof change === 'object'
                              && Object.prototype.hasOwnProperty.call(change, 'before')
                              && Object.prototype.hasOwnProperty.call(change, 'after');
                            return (
                              <div key={`step-log-${log.id}-${field}`}>
                                <strong>{field}</strong>: {hasBeforeAfter
                                  ? `${formatAuditValue(change.before, field)} -> ${formatAuditValue(change.after, field)}`
                                  : formatAuditValue(value, field)}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="build-wizard-muted">No field-level delta recorded.</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="build-wizard-muted">No record history yet.</div>
            )}
          </div>

          <div className="build-wizard-step-info-card">
            <h4>Step Notes</h4>
            {step.notes.length > 0 ? (
              <div className="build-wizard-step-history-list">
                {step.notes.map((note) => (
                  <div className="build-wizard-step-history-item" key={`step-note-modal-${note.id}`}>
                    <div className="build-wizard-step-history-head">
                      <span>Note #{note.id}</span>
                      <span>
                        Created {formatDate(note.created_at)}
                        {noteEditedAtLabel(note) ? ` | Edited ${noteEditedAtLabel(note)}` : ''}
                      </span>
                    </div>
                    <div>{note.note_text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="build-wizard-muted">No notes recorded.</div>
            )}
          </div>

          <div className="build-wizard-step-info-card">
            <h4>Backend Snapshot</h4>
            <pre className="build-wizard-step-info-json">
              {JSON.stringify(step, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
