import React from 'react';
import { IMysteryState, IMasterAssets, IMysteryPageModals, IMysteryModals } from '../../../../types/mysteryHooks';
import { TakeCaseModal } from '../../modals/TakeCaseModal';
import { CaseMgmtModal } from '../../modals/CaseMgmtModal';
import { CaseSetupModal } from '../../modals/CaseSetupModal';
import { ScenariosModal } from '../../modals/ScenariosModal';
import { BackstoryModal } from '../../modals/BackstoryModal';

interface CaseModalsProps {
  isAdmin: boolean;
  busy: boolean;
  mysteryState: IMysteryState;
  masterAssets: IMasterAssets;
  modalState: IMysteryPageModals['state'];
  modalRefs: IMysteryPageModals['refs'];
  modalActions: IMysteryPageModals['actions'];
  onOpenAiConfig: () => void;
  showModalNow: IMysteryModals['showModalNow'];
  transitionToModal: IMysteryModals['transitionToModal'];
}

export function CaseModals({
  isAdmin,
  busy,
  mysteryState,
  masterAssets,
  modalState,
  modalRefs,
  modalActions,
  onOpenAiConfig,
  showModalNow,
  transitionToModal
}: CaseModalsProps) {
  return (
    <>
      <TakeCaseModal
        modalRef={modalRefs.takeCaseModalRef}
        cases={mysteryState.cases}
        busy={busy}
        onTakeCase={modalActions.takeCaseSelect}
      />

      <CaseMgmtModal
        modalRef={modalRefs.caseMgmtRef}
        busy={busy}
        isAdmin={isAdmin}
        mysteryId={mysteryState.caseMgmtMysteryId || mysteryState.mysteryId}
        mysteries={mysteryState.mysteries}
        onMysteryIdChange={mysteryState.setCaseMgmtMysteryId}
        cases={mysteryState.caseMgmtCases}
        caseMgmtCaseId={mysteryState.caseMgmtCaseId}
        setCaseMgmtCaseId={mysteryState.setCaseMgmtCaseId}
        caseMgmtScenarios={mysteryState.caseMgmtScenarios}
        caseMgmtScenarioId={mysteryState.caseMgmtScenarioId}
        setCaseMgmtScenarioId={mysteryState.setCaseMgmtScenarioId}
        caseMgmtBriefingDraft={mysteryState.caseMgmtBriefingDraft}
        setCaseMgmtBriefingDraft={mysteryState.setCaseMgmtBriefingDraft}
        caseMgmtCaseTitleDraft={mysteryState.caseMgmtCaseTitleDraft}
        setCaseMgmtCaseTitleDraft={mysteryState.setCaseMgmtCaseTitleDraft}
        caseMgmtCaseSlugDraft={mysteryState.caseMgmtCaseSlugDraft}
        setCaseMgmtCaseSlugDraft={mysteryState.setCaseMgmtCaseSlugDraft}
        caseMgmtCaseDescriptionDraft={mysteryState.caseMgmtCaseDescriptionDraft}
        setCaseMgmtCaseDescriptionDraft={mysteryState.setCaseMgmtCaseDescriptionDraft}
        caseMgmtCaseArchivedDraft={mysteryState.caseMgmtCaseArchivedDraft}
        setCaseMgmtCaseArchivedDraft={mysteryState.setCaseMgmtCaseArchivedDraft}
        caseMgmtCaseTemplateDraft={mysteryState.caseMgmtCaseTemplateDraft}
        setCaseMgmtCaseTemplateDraft={mysteryState.setCaseMgmtCaseTemplateDraft}
        caseMgmtScenarioSnapshot={mysteryState.caseMgmtScenarioSnapshot}
        caseMgmtInvolvedCharacters={mysteryState.caseMgmtInvolvedCharacters}
        caseMgmtExpandedEntityIds={mysteryState.caseMgmtExpandedEntityIds}
        setCaseMgmtExpandedEntityIds={mysteryState.setCaseMgmtExpandedEntityIds}
        caseMgmtDepositionBusyByEntityId={mysteryState.caseMgmtDepositionBusyByEntityId}
        caseMgmtDepositionErrorByEntityId={mysteryState.caseMgmtDepositionErrorByEntityId}
        caseMgmtDepositionByEntityId={mysteryState.caseMgmtDepositionByEntityId}
        loadCaseMgmtScenariosAndBriefing={mysteryState.loadCaseMgmtScenariosAndBriefing}
        saveCaseMgmtCaseDetails={mysteryState.saveCaseMgmtCaseDetails}
        saveCaseMgmtBriefing={mysteryState.saveCaseMgmtBriefing}
        loadCaseMgmtBriefingForScenarioId={mysteryState.loadCaseMgmtBriefingForScenarioId}
        loadCaseMgmtDepositionForEntity={mysteryState.loadCaseMgmtDepositionForEntity}
        enqueueCaseMgmtGenerateDeposition={mysteryState.enqueueCaseMgmtGenerateDeposition}
        removeCaseMgmtLawEnforcementCharacter={mysteryState.removeCaseMgmtLawEnforcementCharacter}
        recomputeCaseMgmtRoles={mysteryState.recomputeCaseMgmtRoles}
        enqueueSpecificJob={mysteryState.enqueueSpecificJob}
        openAiPromptPreview={() => {}}
      />

      <CaseSetupModal
        modalRef={modalRefs.caseSetupModalRef}
        busy={busy}
        isAdmin={isAdmin}
        scenarioId={mysteryState.scenarioId}
        masterCharacters={masterAssets.masterCharacters}
        masterLocations={masterAssets.masterLocations}
        masterWeapons={masterAssets.masterWeapons}
        masterMotives={masterAssets.masterMotives}
        caseAvailableMasterCharacterIds={mysteryState.caseAvailableMasterCharacterIds}
        setCaseAvailableMasterCharacterIds={mysteryState.setCaseAvailableMasterCharacterIds}
        caseAvailableMasterLocationIds={mysteryState.caseAvailableMasterLocationIds}
        setCaseAvailableMasterLocationIds={mysteryState.setCaseAvailableMasterLocationIds}
        caseAvailableMasterWeaponIds={mysteryState.caseAvailableMasterWeaponIds}
        setCaseAvailableMasterWeaponIds={mysteryState.setCaseAvailableMasterWeaponIds}
        caseAvailableMasterMotiveIds={mysteryState.caseAvailableMasterMotiveIds}
        setCaseAvailableMasterMotiveIds={mysteryState.setCaseAvailableMasterMotiveIds}
        loadMasterCharacters={masterAssets.loadMasterCharacters}
        loadMasterLocations={masterAssets.loadMasterLocations}
        loadMasterWeapons={masterAssets.loadMasterWeapons}
        loadMasterMotives={masterAssets.loadMasterMotives}
        saveCaseSetup={mysteryState.saveCaseSetup}
      />

      <ScenariosModal
        modalRef={modalRefs.scenariosModalRef}
        busy={busy}
        isAdmin={isAdmin}
        caseId={mysteryState.caseId}
        setCaseId={mysteryState.setCaseId}
        mysteryId={mysteryState.mysteryId}
        cases={mysteryState.cases}
        scenarios={mysteryState.scenarios}
        scenarioId={mysteryState.scenarioId}
        setScenarioId={mysteryState.setScenarioId}
        scenario={mysteryState.scenario}
        scenarioCrimeScene={mysteryState.scenarioCrimeScene}
        newScenario={mysteryState.newScenario}
        setNewScenario={mysteryState.setNewScenario}
        deleteScenarioArmed={mysteryState.deleteScenarioArmed}
        setDeleteScenarioArmed={mysteryState.setDeleteScenarioArmed}
        crimeSceneLocationIdDraft={mysteryState.crimeSceneLocationIdDraft}
        setCrimeSceneLocationIdDraft={mysteryState.setCrimeSceneLocationIdDraft}
        locations={masterAssets.masterLocations}
        entityNameById={mysteryState.entityNameById}
        loadCases={mysteryState.loadCases}
        createScenario={mysteryState.createScenario}
        deleteScenario={async () => { await mysteryState.deleteScenario(mysteryState.scenarioId); }}
        ensureDefaultScenarioForCase={async () => { await mysteryState.ensureDefaultScenarioForCase(mysteryState.caseId); }}
        reassignScenarioCase={async (cid) => { await mysteryState.reassignScenarioCase(mysteryState.scenarioId, cid); }}
        saveCrimeSceneLocationId={mysteryState.saveCrimeSceneLocationId}
        onOpenBackstories={() => showModalNow(modalRefs.storiesModalRef, modalRefs.storiesModalApiRef, modalState.setStoriesModalOpen)}
        onOpenDossier={() => showModalNow(modalRefs.gameMgmtRef, modalRefs.gameMgmtApiRef, modalState.setGameMgmtOpen)}
        onOpenAiConfig={onOpenAiConfig}
        cogSvg={<i className="bi bi-gear" />}
      />

      <BackstoryModal
        modalRef={modalRefs.backstoryModalRef}
        busy={busy}
        isAdmin={isAdmin}
        backstoryId={mysteryState.backstoryId}
        backstoryDetails={mysteryState.backstoryDetails}
        backstoryTitleDraft={mysteryState.backStoryCreateTitle}
        setBackstoryTitleDraft={mysteryState.setBackStoryCreateTitle}
        backstorySlugDraft={mysteryState.backStoryCreateSlug}
        setBackstorySlugDraft={mysteryState.setBackStoryCreateSlug}
        backstoryLocationMasterIdDraft={mysteryState.backStoryCreateLocationMasterId}
        setBackstoryLocationMasterIdDraft={mysteryState.setBackStoryCreateLocationMasterId}
        backstoryFullTextDraft={mysteryState.storyLongDraft}
        setBackstoryFullTextDraft={mysteryState.setStoryLongDraft}
        backstoryFullUpdatedAt={mysteryState.coldHardFactsUpdatedAt}
        backstoryTextDraft={mysteryState.backStoryCreateSource}
        setBackstoryTextDraft={mysteryState.setBackStoryCreateSource}
        backstoryMetaDraft={mysteryState.backStoryCreateMeta}
        setBackstoryMetaDraft={mysteryState.setBackStoryCreateMeta}
        masterLocations={masterAssets.masterLocations}
        mysteryId={mysteryState.mysteryId}
        loadBackstoryDetails={mysteryState.loadBackstoryDetails}
        loadBackstoryFullStory={mysteryState.loadBackstoryFullStory}
        saveBackstoryDetails={mysteryState.saveBackstoryDetails}
        saveBackstoryFullStory={mysteryState.saveBackstoryFullStory}
        toggleBackstoryArchived={mysteryState.toggleBackstoryArchived}
        generateBackstoryWithAi={async () => { await mysteryState.createBackstory(); }}
      />
    </>
  );
}
