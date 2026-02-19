import React from 'react';
import { DossierWizardHeader } from './sections/DossierWizardHeader';
import { BackstoryStepSection } from './sections/BackstoryStepSection';
import { CaseStepSection } from './sections/CaseStepSection';
import { CaseDetailsStepSection } from './sections/CaseDetailsStepSection';

interface GameMgmtModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  busy: boolean;
  isAdmin: boolean;
  mysteryId: string | number;
  backstoryId: string;
  setBackstoryId: (val: string) => void;
  backstories: any[];
  backstoryDetails: any;
  caseId: string;
  setCaseId: (val: string) => void;
  cases: any[];
  scenarioId: string;
  
  // Backstory creation state
  backStoryCreateSource: string;
  setBackStoryCreateSource: (val: string) => void;
  backStoryCreateTitle: string;
  setBackStoryCreateTitle: (val: string) => void;
  backStoryCreateLocationMasterId: string;
  setBackStoryCreateLocationMasterId: (val: string) => void;
  backStoryCreateFromSeed: boolean;
  masterLocations: any[];
  seedStories: any[];
  
  // Actions
  loadBackstories: (mid: string | number) => Promise<any[]>;
  loadBackstoryDetails: (id: string) => Promise<void>;
  loadStoryBookEntry: (id: string) => Promise<void>;
  createBackstory: (params?: any) => Promise<any>;
  spawnCaseFromBackstory: () => Promise<void>;
  loadCases: (mid: string | number) => Promise<any[]>;
  onOpenBackstoryModal: () => void;
  onOpenSeedStoryModal: () => void;
  onOpenAdvancedModal: () => void;
  onOpenAiConfig: () => void;
  onOpenScenariosModal: () => void;
  onOpenCaseSetupModal: () => void;
  showMysteryToast: (t: any) => void;
  jobs: any[];
  
  // Icons
  cogSvg: React.ReactNode;
  
  // Scenario info
  scenario: any;
  scenarioCrimeScene: any;
  entityNameById: Record<string, string>;
  scenarioEntities: any[];
  csiDetectiveEntityIdDraft: string;
  setCsiDetectiveEntityIdDraft: (val: string) => void;
  csiReportTextDraft: string;
  setCsiReportTextDraft: (val: string) => void;
  csiReportJsonDraft: string;
  setCsiReportJsonDraft: (val: string) => void;
  saveCsiReport: () => Promise<void>;
  generateCsiReport: (sid?: string | number) => Promise<void>;
}

/**
 * GameMgmtModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function GameMgmtModal(props: GameMgmtModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={props.modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl catn8-modal-wide">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Dossier</div>
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={props.onOpenAdvancedModal} disabled={props.busy}>
                Advanced
              </button>
              {props.isAdmin && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={props.onOpenAiConfig}
                  disabled={props.busy}
                  aria-label="AI Configuration"
                  title="AI Configuration"
                >
                  {props.cogSvg}
                  <span className="ms-1">Config</span>
                </button>
              )}
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            <DossierWizardHeader 
              backstoryId={props.backstoryId}
              caseId={props.caseId}
            />

            <BackstoryStepSection 
              busy={props.busy}
              isAdmin={props.isAdmin}
              mysteryId={props.mysteryId}
              backstoryId={props.backstoryId}
              setBackstoryId={props.setBackstoryId}
              backstories={props.backstories}
              backStoryCreateSource={props.backStoryCreateSource}
              setBackStoryCreateSource={props.setBackStoryCreateSource}
              seedStories={props.seedStories}
              loadBackstories={props.loadBackstories}
              onOpenSeedStoryModal={props.onOpenSeedStoryModal}
              onOpenBackstoryModal={props.onOpenBackstoryModal}
              loadStoryBookEntry={props.loadStoryBookEntry}
              createBackstory={props.createBackstory}
              showMysteryToast={props.showMysteryToast}
              jobs={props.jobs}
              setCaseId={props.setCaseId}
            />

            {props.backstoryId && (
              <CaseStepSection 
                busy={props.busy}
                isAdmin={props.isAdmin}
                mysteryId={props.mysteryId}
                backstoryId={props.backstoryId}
                caseId={props.caseId}
                setCaseId={props.setCaseId}
                cases={props.cases}
                loadCases={props.loadCases}
                spawnCaseFromBackstory={props.spawnCaseFromBackstory}
              />
            )}

            {props.caseId && props.backstoryId && props.cases.some(c => String(c.id) === String(props.caseId) && String(c.backstory_id) === String(props.backstoryId)) && (
              <CaseDetailsStepSection 
                busy={props.busy}
                isAdmin={props.isAdmin}
                caseId={props.caseId}
                scenarioId={props.scenarioId}
                onOpenScenariosModal={props.onOpenScenariosModal}
                onOpenCaseSetupModal={props.onOpenCaseSetupModal}
                scenario={props.scenario}
                scenarioCrimeScene={props.scenarioCrimeScene}
                entityNameById={props.entityNameById}
                scenarioEntities={props.scenarioEntities}
                csiDetectiveEntityIdDraft={props.csiDetectiveEntityIdDraft}
                setCsiDetectiveEntityIdDraft={props.setCsiDetectiveEntityIdDraft}
                csiReportTextDraft={props.csiReportTextDraft}
                setCsiReportTextDraft={props.setCsiReportTextDraft}
                csiReportJsonDraft={props.csiReportJsonDraft}
                setCsiReportJsonDraft={props.setCsiReportJsonDraft}
                saveCsiReport={props.saveCsiReport}
                generateCsiReport={props.generateCsiReport}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
