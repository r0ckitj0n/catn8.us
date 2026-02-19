import React from 'react';
import { IToast } from '../../../types/common';
import { useMotivesManager } from '../hooks/useMotivesManager';
import { MotiveSelectorSection } from './sections/MotiveSelectorSection';
import { MotiveDetailsSection } from './sections/MotiveDetailsSection';

interface MotivesModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  isAdmin: boolean;
  mysteryId: string | number;
  caseId: string | number;
  busy: boolean;
  showMysteryToast: (t: Partial<IToast>) => void;
}

/**
 * MotivesModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function MotivesModal({
  modalRef,
  isAdmin,
  mysteryId,
  caseId,
  busy,
  showMysteryToast,
}: MotivesModalProps) {
  const state = useMotivesManager(isAdmin, mysteryId, caseId, showMysteryToast);

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl catn8-modal-wide">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Motives</div>
            <div className="d-flex align-items-center gap-2">
              <div className="form-check">
                <input
                  id="motives-include-archived"
                  className="form-check-input"
                  type="checkbox"
                  checked={state.motivesIncludeArchived}
                  onChange={(e) => state.setMotivesIncludeArchived(e.target.checked)}
                  disabled={busy || state.motivesBusy}
                />
                <label className="form-check-label" htmlFor="motives-include-archived">Show archived</label>
              </div>
              <button 
                type="button" 
                className="btn btn-sm btn-outline-secondary" 
                onClick={state.loadMotives} 
                disabled={busy || state.motivesBusy}
              >
                Refresh
              </button>
              {isAdmin && state.motives.length === 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={state.importMasterMotivesToGlobal}
                  disabled={busy || state.motivesBusy || !isAdmin}
                  title={mysteryId ? 'Import legacy (mystery-scoped) motives' : 'Select a Mystery first'}
                >
                  Import from Asset Library
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  className={'btn btn-sm btn-primary catn8-dirty-save' + (state.motiveIsDirty ? ' catn8-dirty-save--visible' : '')}
                  onClick={() => void state.saveMotive()}
                  disabled={busy || state.motivesBusy || !isAdmin || !state.motiveIsDirty || state.motiveSelectedIsLocked}
                  aria-label="Save"
                  title={state.motiveSelectedIsLocked ? 'Motive is locked' : (state.motiveIsDirty ? 'Save changes' : 'No changes to save')}
                >
                  Save
                </button>
              )}
          {isAdmin && (
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => void state.generateMotive(true)}
              disabled={busy || state.motivesBusy || state.motiveSelectedIsLocked || !state.canGenerateMotiveDetails}
              title={state.canGenerateMotiveDetails ? 'Generate details' : 'Enter required fields first'}
            >
              Generate Details
            </button>
          )}
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-12 col-lg-4">
                <MotiveSelectorSection 
                  motives={state.motives}
                  motiveSelectedId={state.motiveSelectedId}
                  motiveSelectedIsLocked={state.motiveSelectedIsLocked}
                  motivesBusy={state.motivesBusy}
                  busy={busy}
                  isAdmin={isAdmin}
                  selectMotiveById={state.selectMotiveById}
                  setMotiveIsArchivedDraft={state.setMotiveIsArchivedDraft}
                  deleteMotiveAction={state.deleteMotiveAction}
                />
              </div>
              <div className="col-12 col-lg-8">
                <MotiveDetailsSection 
                  isAdmin={isAdmin}
                  motiveNameDraft={state.motiveNameDraft}
                  setMotiveNameDraft={state.setMotiveNameDraft}
                  motiveSlugDraft={state.motiveSlugDraft}
                  setMotiveSlugDraft={state.setMotiveSlugDraft}
                  motiveDescriptionDraft={state.motiveDescriptionDraft}
                  setMotiveDescriptionDraft={state.setMotiveDescriptionDraft}
                  motiveIsArchivedDraft={state.motiveIsArchivedDraft}
                  setMotiveIsArchivedDraft={state.setMotiveIsArchivedDraft}
                  busy={busy}
                  motivesBusy={state.motivesBusy}
                  motiveSelectedIsLocked={state.motiveSelectedIsLocked}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
