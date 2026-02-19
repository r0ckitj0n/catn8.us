import React from 'react';
import { CaseBriefingSection } from './sections/CaseBriefingSection';
import { CaseDetailsSection } from './sections/CaseDetailsSection';
import { ScenarioSnapshotSection } from './sections/ScenarioSnapshotSection';
import { CharactersInvolvedSection } from './sections/CharactersInvolvedSection';

interface CaseMgmtModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  busy: boolean;
  isAdmin: boolean;
  mysteryId: string | number;
  mysteries: any[];
  onMysteryIdChange: (val: string) => void;
  cases: any[];
  caseMgmtCaseId: string;
  setCaseMgmtCaseId: (val: string) => void;
  caseMgmtScenarios: any[];
  caseMgmtScenarioId: string;
  setCaseMgmtScenarioId: (val: string) => void;
  caseMgmtBriefingDraft: string;
  setCaseMgmtBriefingDraft: (val: string) => void;
  caseMgmtCaseTitleDraft: string;
  setCaseMgmtCaseTitleDraft: (val: string) => void;
  caseMgmtCaseSlugDraft: string;
  setCaseMgmtCaseSlugDraft: (val: string) => void;
  caseMgmtCaseDescriptionDraft: string;
  setCaseMgmtCaseDescriptionDraft: (val: string) => void;
  caseMgmtCaseArchivedDraft: boolean;
  setCaseMgmtCaseArchivedDraft: (val: boolean) => void;
  caseMgmtCaseTemplateDraft: boolean;
  setCaseMgmtCaseTemplateDraft: (val: boolean) => void;
  caseMgmtScenarioSnapshot: any;
  caseMgmtInvolvedCharacters: any[];
  caseMgmtExpandedEntityIds: number[];
  setCaseMgmtExpandedEntityIds: React.Dispatch<React.SetStateAction<number[]>>;
  caseMgmtDepositionBusyByEntityId: Record<string, boolean>;
  caseMgmtDepositionErrorByEntityId: Record<string, string>;
  caseMgmtDepositionByEntityId: Record<string, { text: string; updated_at: string }>;
  
  // Actions
  loadCaseMgmtScenariosAndBriefing: () => Promise<void>;
  saveCaseMgmtCaseDetails: () => Promise<void>;
  saveCaseMgmtBriefing: () => Promise<void>;
  loadCaseMgmtBriefingForScenarioId: (sid: number) => Promise<void>;
  loadCaseMgmtDepositionForEntity: (eid: number) => Promise<void>;
  enqueueCaseMgmtGenerateDeposition: (eid: number) => Promise<void>;
  removeCaseMgmtLawEnforcementCharacter: (sei: number) => Promise<void>;
  recomputeCaseMgmtRoles: () => Promise<void>;
  enqueueSpecificJob: (opts: { action: string; spec: any; requireScenario: boolean }) => Promise<void>;
  openAiPromptPreview: (opts: { title: string; payload: any }) => void;
}

/**
 * CaseMgmtModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function CaseMgmtModal(props: CaseMgmtModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={props.modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl catn8-modal-wide">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Case Management</div>
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            <CaseBriefingSection 
              busy={props.busy}
              isAdmin={props.isAdmin}
              caseMgmtCaseId={props.caseMgmtCaseId}
              caseMgmtScenarioId={props.caseMgmtScenarioId}
              caseMgmtBriefingDraft={props.caseMgmtBriefingDraft}
              setCaseMgmtBriefingDraft={props.setCaseMgmtBriefingDraft}
              loadCaseMgmtScenariosAndBriefing={props.loadCaseMgmtScenariosAndBriefing}
              saveCaseMgmtCaseDetails={props.saveCaseMgmtCaseDetails}
              saveCaseMgmtBriefing={props.saveCaseMgmtBriefing}
            />

            <CaseDetailsSection 
              busy={props.busy}
              isAdmin={props.isAdmin}
              mysteryId={props.mysteryId}
              mysteries={props.mysteries}
              onMysteryIdChange={props.onMysteryIdChange}
              cases={props.cases}
              caseMgmtCaseId={props.caseMgmtCaseId}
              setCaseMgmtCaseId={props.setCaseMgmtCaseId}
              caseMgmtScenarioId={props.caseMgmtScenarioId}
              setCaseMgmtScenarioId={props.setCaseMgmtScenarioId}
              caseMgmtScenarios={props.caseMgmtScenarios}
              loadCaseMgmtBriefingForScenarioId={props.loadCaseMgmtBriefingForScenarioId}
              setCaseMgmtExpandedEntityIds={props.setCaseMgmtExpandedEntityIds}
              caseMgmtCaseTitleDraft={props.caseMgmtCaseTitleDraft}
              setCaseMgmtCaseTitleDraft={props.setCaseMgmtCaseTitleDraft}
              caseMgmtCaseSlugDraft={props.caseMgmtCaseSlugDraft}
              setCaseMgmtCaseSlugDraft={props.setCaseMgmtCaseSlugDraft}
              caseMgmtCaseDescriptionDraft={props.caseMgmtCaseDescriptionDraft}
              setCaseMgmtCaseDescriptionDraft={props.setCaseMgmtCaseDescriptionDraft}
              caseMgmtCaseArchivedDraft={props.caseMgmtCaseArchivedDraft}
              setCaseMgmtCaseArchivedDraft={props.setCaseMgmtCaseArchivedDraft}
              caseMgmtCaseTemplateDraft={props.caseMgmtCaseTemplateDraft}
              setCaseMgmtCaseTemplateDraft={props.setCaseMgmtCaseTemplateDraft}
            />

            <div className="row g-3 mt-1">
              <ScenarioSnapshotSection 
                caseMgmtScenarioSnapshot={props.caseMgmtScenarioSnapshot}
                caseMgmtScenarioId={props.caseMgmtScenarioId}
              />

              <CharactersInvolvedSection 
                busy={props.busy}
                isAdmin={props.isAdmin}
                caseMgmtScenarioId={props.caseMgmtScenarioId}
                caseMgmtInvolvedCharacters={props.caseMgmtInvolvedCharacters}
                caseMgmtExpandedEntityIds={props.caseMgmtExpandedEntityIds}
                setCaseMgmtExpandedEntityIds={props.setCaseMgmtExpandedEntityIds}
                caseMgmtDepositionBusyByEntityId={props.caseMgmtDepositionBusyByEntityId}
                caseMgmtDepositionByEntityId={props.caseMgmtDepositionByEntityId}
                loadCaseMgmtDepositionForEntity={props.loadCaseMgmtDepositionForEntity}
                enqueueCaseMgmtGenerateDeposition={props.enqueueCaseMgmtGenerateDeposition}
                enqueueSpecificJob={props.enqueueSpecificJob}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
