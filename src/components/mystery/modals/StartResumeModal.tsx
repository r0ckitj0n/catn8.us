import React from 'react';
import { DarkroomSection } from './sections/DarkroomSection';
import { StartResumeSection } from './sections/StartResumeSection';

interface StartResumeModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  startResumeTab: string;
  isAdmin: boolean;
  imageStyleMasterDirty: boolean;
  imageStyleMasterDraft: string;
  setImageStyleMasterDraft: (val: string) => void;
  locationImageStyleDraft: string;
  setLocationImageStyleDraft: (val: string) => void;
  mugshotImageStyleDraft: string;
  setMugshotImageStyleDraft: (val: string) => void;
  weaponImageStyleDraft: string;
  setWeaponImageStyleDraft: (val: string) => void;
  jobSpecText: string;
  setJobSpecText: (val: string) => void;
  caseId: string;
  setCaseId: (val: string) => void;
  scenarioId: string;
  setScenarioId: (val: string) => void;
  mysteryId: string | number;
  cases: any[];
  jobs: any[];
  clearQueueArmed: boolean;
  setClearQueueArmed: (val: boolean) => void;
  deleteJobArmedId: number;
  setDeleteJobArmedId: (val: number) => void;
  playResumables: any[];
  playBackstories: any[];
  playBusy: boolean;
  busy: boolean;
  
  // Names for display
  scenarioSheriffName: string;
  scenarioCsiDetectiveName: string;
  
  // Actions
  saveImageStyleSetting: (opts: { key: 'master' | 'location' | 'mugshot' | 'weapon', value: string }) => Promise<void>;
  loadJobs: (cid: string) => Promise<void>;
  clearCompletedJobs: () => Promise<void>;
  clearQueuedJobs: () => Promise<void>;
  deleteQueuedJob: (id: number) => Promise<void>;
  loadPlayBackstoriesAndResumables: () => void;
  resumeScenarioNow: (opts: { caseId: number; scenarioId: number; title: string }) => Promise<void>;
  takeCaseSelect: (cid: number) => Promise<void>;
  startSheriffLiveSession: () => Promise<void>;
  onOpenAiImageConfig: () => void;
  
  // Icons/SVGs
  cogSvg: React.ReactNode;
}

/**
 * StartResumeModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function StartResumeModal(props: StartResumeModalProps) {
  const getTitle = () => {
    const t = String(props.startResumeTab || 'start');
    if (t === 'start') return 'Start / Resume';
    if (t === 'tools') return 'Darkroom';
    if (t === 'case_file') return 'Case File';
    if (t === 'log') return 'Investigation Log';
    return 'Case Details';
  };

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={props.modalRef}>
      <div className="modal-dialog modal-dialog-centered catn8-case-details-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">{getTitle()}</div>
            <div className="d-flex align-items-center gap-2">
              {props.startResumeTab === 'tools' && props.isAdmin && props.imageStyleMasterDirty && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => void props.saveImageStyleSetting({ key: 'master', value: props.imageStyleMasterDraft })}
                  disabled={props.busy || !props.mysteryId}
                >
                  Save
                </button>
              )}
              {props.startResumeTab === 'tools' && props.isAdmin && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={props.onOpenAiImageConfig}
                  disabled={props.busy}
                  title="AI Image Configuration"
                >
                  {props.cogSvg}
                  <span className="ms-1">Config</span>
                </button>
              )}
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            <div className="catn8-card p-3 catn8-mystery-modal-card">
              {props.startResumeTab === 'tools' ? (
                <DarkroomSection 
                  busy={props.busy}
                  isAdmin={props.isAdmin}
                  mysteryId={props.mysteryId}
                  caseId={props.caseId}
                  setCaseId={props.setCaseId}
                  setScenarioId={props.setScenarioId}
                  cases={props.cases}
                  imageStyleMasterDraft={props.imageStyleMasterDraft}
                  setImageStyleMasterDraft={props.setImageStyleMasterDraft}
                  saveImageStyleSetting={props.saveImageStyleSetting}
                  jobs={props.jobs}
                  loadJobs={props.loadJobs}
                  deleteQueuedJob={props.deleteQueuedJob}
                />
              ) : props.startResumeTab === 'start' ? (
                <StartResumeSection 
                  playResumables={props.playResumables}
                  resumeScenarioNow={props.resumeScenarioNow}
                  playBackstories={props.playBackstories}
                  takeCaseSelect={props.takeCaseSelect}
                />
              ) : (
                <div className="text-muted">Content for {props.startResumeTab} coming soon...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
