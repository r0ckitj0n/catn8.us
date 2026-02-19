import React from 'react';
import { ScenarioSelectorSection } from './sections/ScenarioSelectorSection';
import { CrimeDetailsSection } from './sections/CrimeDetailsSection';

interface ScenariosModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  busy: boolean;
  isAdmin: boolean;
  caseId: string;
  setCaseId: (val: string) => void;
  mysteryId: string | number;
  cases: any[];
  scenarios: any[];
  scenarioId: string;
  setScenarioId: (val: string) => void;
  scenario: any;
  scenarioCrimeScene: any;
  newScenario: { title: string };
  setNewScenario: React.Dispatch<React.SetStateAction<{ title: string }>>;
  deleteScenarioArmed: boolean;
  setDeleteScenarioArmed: (val: boolean) => void;
  crimeSceneLocationIdDraft: string;
  setCrimeSceneLocationIdDraft: (val: string) => void;
  locations: any[];
  entityNameById: Record<string, string>;
  
  // Actions
  loadCases: (mid: string | number) => Promise<any[]>;
  createScenario: (e: React.FormEvent) => Promise<void>;
  deleteScenario: () => Promise<void>;
  ensureDefaultScenarioForCase: () => Promise<void>;
  reassignScenarioCase: (cid: string) => Promise<void>;
  saveCrimeSceneLocationId: () => Promise<void>;
  onOpenBackstories: () => void;
  onOpenDossier: () => void;
  onOpenAiConfig: () => void;
  
  // Optional/Context
  loadCaseMgmtBriefingForScenarioId?: (sid: number) => Promise<void>;
  setCaseMgmtExpandedEntityIds?: (val: number[]) => void;

  // Icons
  cogSvg: React.ReactNode;
}

/**
 * ScenariosModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function ScenariosModal(props: ScenariosModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={props.modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Crime Scenes</div>
            <div className="d-flex align-items-center gap-2">
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
            {!props.caseId ? (
              <div className="catn8-card p-2">
                Select a mystery and case first.
                <div className="mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={props.onOpenDossier}
                    disabled={props.busy}
                  >
                    Open Dossier
                  </button>
                </div>
              </div>
            ) : (
              <div className="row g-3">
                <div className="col-lg-6">
                  <ScenarioSelectorSection 
                    busy={props.busy}
                    isAdmin={props.isAdmin}
                    caseId={props.caseId}
                    setCaseId={props.setCaseId}
                    mysteryId={props.mysteryId}
                    cases={props.cases}
                    scenarios={props.scenarios}
                    scenarioId={props.scenarioId}
                    setScenarioId={props.setScenarioId}
                    scenario={props.scenario}
                    newScenario={props.newScenario}
                    setNewScenario={props.setNewScenario}
                    deleteScenarioArmed={props.deleteScenarioArmed}
                    setDeleteScenarioArmed={props.setDeleteScenarioArmed}
                    loadCases={props.loadCases}
                    createScenario={props.createScenario}
                    deleteScenario={props.deleteScenario}
                    ensureDefaultScenarioForCase={props.ensureDefaultScenarioForCase}
                    reassignScenarioCase={props.reassignScenarioCase}
                    loadCaseMgmtBriefingForScenarioId={props.loadCaseMgmtBriefingForScenarioId || (async () => {})}
                    setCaseMgmtExpandedEntityIds={props.setCaseMgmtExpandedEntityIds || (() => {})}
                  />
                </div>

                <div className="col-lg-6">
                  <CrimeDetailsSection 
                    busy={props.busy}
                    isAdmin={props.isAdmin}
                    scenarioId={props.scenarioId}
                    crimeSceneLocationIdDraft={props.crimeSceneLocationIdDraft}
                    setCrimeSceneLocationIdDraft={props.setCrimeSceneLocationIdDraft}
                    locations={props.locations}
                    saveCrimeSceneLocationId={props.saveCrimeSceneLocationId}
                    scenarioCrimeScene={props.scenarioCrimeScene}
                    entityNameById={props.entityNameById}
                    onOpenBackstories={props.onOpenBackstories}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
