import React from 'react';
import { IMysteryState, IMasterAssets, IMysterySettingsFull, IMysteryPageModals, IMysteryModals, IMysteryStateDarkroom } from '../../../../types/mysteryHooks';
import { AdvancedModal } from '../../modals/AdvancedModal';
import { GameMgmtModal } from '../../modals/GameMgmtModal';
import { StoriesModal } from '../../modals/StoriesModal';
import { ToolsModal } from '../../modals/ToolsModal';

interface AdminGameModalsProps {
  busy: boolean;
  isAdmin: boolean;
  mysteryState: IMysteryState;
  darkroom: IMysteryStateDarkroom;
  masterAssets: IMasterAssets;
  modalState: IMysteryPageModals['state'];
  modalRefs: IMysteryPageModals['refs'];
  modalActions: IMysteryPageModals['actions'];
  onOpenAiConfig: () => void;
  showModalNow: IMysteryModals['showModalNow'];
  transitionToModal: IMysteryModals['transitionToModal'];
}

export function AdminGameModals({
  busy, isAdmin, mysteryState, darkroom, masterAssets, modalState, modalRefs, modalActions, onOpenAiConfig, showModalNow, transitionToModal
}: AdminGameModalsProps) {
  return (
    <>
      <AdvancedModal
        modalRef={modalRefs.advancedModalRef}
        busy={busy}
        isAdmin={isAdmin}
        scenarioId={mysteryState.scenarioId}
        caseId={mysteryState.caseId}
        constraintsDraft={''}
        setConstraintsDraft={() => {}}
        jobSpecText={''}
        setJobSpecText={() => {}}
        onOpenScenarios={() => showModalNow(modalRefs.scenariosModalRef, modalRefs.scenariosModalApiRef, modalState.setScenariosModalOpen)}
        loadScenario={mysteryState.loadScenario}
        saveConstraints={async () => {}}
      />

      <GameMgmtModal
        modalRef={modalRefs.gameMgmtRef}
        busy={busy}
        isAdmin={isAdmin}
        mysteryId={mysteryState.mysteryId}
        backstoryId={mysteryState.backstoryId}
        setBackstoryId={mysteryState.setBackstoryId}
        backstories={mysteryState.backstories}
        backstoryDetails={mysteryState.backstoryDetails}
        caseId={mysteryState.caseId}
        setCaseId={mysteryState.setCaseId}
        cases={mysteryState.cases}
        scenarioId={mysteryState.scenarioId}
        backStoryCreateSource={mysteryState.backStoryCreateSource}
        setBackStoryCreateSource={mysteryState.setBackStoryCreateSource}
        backStoryCreateTitle={mysteryState.backStoryCreateTitle}
        setBackStoryCreateTitle={mysteryState.setBackStoryCreateTitle}
        backStoryCreateLocationMasterId={mysteryState.backStoryCreateLocationMasterId}
        setBackStoryCreateLocationMasterId={mysteryState.setBackStoryCreateLocationMasterId}
        backStoryCreateFromSeed={mysteryState.backStoryCreateFromSeed}
        masterLocations={masterAssets.masterLocations}
        seedStories={mysteryState.seedStories}
        loadBackstories={mysteryState.loadBackstories}
        loadBackstoryDetails={mysteryState.loadBackstoryDetails}
        loadStoryBookEntry={mysteryState.loadStoryBookEntry}
        createBackstory={mysteryState.createBackstory}
        spawnCaseFromBackstory={async () => { await mysteryState.spawnCaseFromBackstory(); }}
        loadCases={mysteryState.loadCases}
        onOpenBackstoryModal={() => showModalNow(modalRefs.backstoryModalRef, modalRefs.backstoryModalApiRef, modalState.setBackstoryModalOpen)}
        onOpenSeedStoryModal={() => showModalNow(modalRefs.storiesModalRef, modalRefs.storiesModalApiRef, modalState.setStoriesModalOpen)}
        onOpenAdvancedModal={() => showModalNow(modalRefs.advancedModalRef, modalRefs.advancedModalApiRef, modalState.setAdvancedModalOpen)}
        onOpenAiConfig={onOpenAiConfig}
        onOpenScenariosModal={() => showModalNow(modalRefs.scenariosModalRef, modalRefs.scenariosModalApiRef, modalState.setScenariosModalOpen)}
        onOpenCaseSetupModal={() => showModalNow(modalRefs.caseSetupModalRef, modalRefs.caseSetupModalApiRef, modalState.setCaseSetupModalOpen)}
        cogSvg={<i className="bi bi-gear" />}
        scenario={mysteryState.scenario}
        scenarioCrimeScene={mysteryState.scenarioCrimeScene}
        entityNameById={mysteryState.entityNameById}
        scenarioEntities={mysteryState.scenarioEntities}
        csiDetectiveEntityIdDraft={mysteryState.csiDetectiveEntityIdDraft}
        setCsiDetectiveEntityIdDraft={mysteryState.setCsiDetectiveEntityIdDraft}
        csiReportTextDraft={mysteryState.csiReportTextDraft}
        setCsiReportTextDraft={mysteryState.setCsiReportTextDraft}
        csiReportJsonDraft={mysteryState.csiReportJsonDraft}
        setCsiReportJsonDraft={mysteryState.setCsiReportJsonDraft}
        saveCsiReport={mysteryState.saveCsiReport}
        generateCsiReport={mysteryState.generateCsiReport}
        showMysteryToast={mysteryState.showMysteryToast}
        jobs={mysteryState.jobs}
      />

      <StoriesModal
        modalRef={modalRefs.storiesModalRef}
        mysteryId={mysteryState.mysteryId}
        isAdmin={isAdmin}
        busy={busy}
        
        // Seed Stories state
        seedStories={mysteryState.seedStories}
        storyBookBusy={mysteryState.storyBookBusy}
        storyBookIncludeArchived={mysteryState.storyBookIncludeArchived}
        setStoryBookIncludeArchived={mysteryState.setStoryBookIncludeArchived}
        storyBookSelectedId={mysteryState.storyBookSelectedId} 
        storyBookTitleDraft={mysteryState.storyBookTitleDraft} 
        setStoryBookTitleDraft={mysteryState.setStoryBookTitleDraft}
        storyBookSlugDraft={mysteryState.storyBookSlugDraft}
        setStoryBookSlugDraft={mysteryState.setStoryBookSlugDraft}
        storyBookSourceDraft={mysteryState.storyBookSourceDraft}
        setStoryBookSourceDraft={mysteryState.setStoryBookSourceDraft}
        storyBookMetaDraft={mysteryState.storyBookMetaDraft}
        setStoryBookMetaDraft={mysteryState.setStoryBookMetaDraft}
        storyBookSelectedIsArchived={mysteryState.storyBookSelectedIsArchived}
        
        // Seed Stories Actions
        loadStoryBookEntries={mysteryState.loadStoryBookEntries}
        loadStoryBookEntry={mysteryState.loadStoryBookEntry}
        createNewStoryBookEntry={() => {
          mysteryState.setStoryBookSelectedId('');
          mysteryState.setStoryBookTitleDraft('');
          mysteryState.setStoryBookSlugDraft('');
          mysteryState.setStoryBookSourceDraft('');
          mysteryState.setStoryBookMetaDraft('{}');
          mysteryState.setStoryBookSelectedIsArchived(false);
        }}
        saveStoryBookEntry={mysteryState.saveStoryBookEntry}
        archiveStoryBookEntry={async () => {
          if (!mysteryState.storyBookSelectedId) return;
          await mysteryState.archiveStoryBookEntry(mysteryState.storyBookSelectedId, !mysteryState.storyBookSelectedIsArchived);
        }}
        deleteStoryBookEntry={async () => {
          if (!mysteryState.storyBookSelectedId) return;
          await mysteryState.deleteStoryBookEntry(mysteryState.storyBookSelectedId);
        }}

        // Backstories state
        backStoryCreateSource={mysteryState.backStoryCreateSource}
        setBackStoryCreateSource={mysteryState.setBackStoryCreateSource}
        backStoryCreateTitle={mysteryState.backStoryCreateTitle}
        setBackStoryCreateTitle={mysteryState.setBackStoryCreateTitle}
        backStoryCreateLocationMasterId={mysteryState.backStoryCreateLocationMasterId}
        setBackStoryCreateLocationMasterId={mysteryState.setBackStoryCreateLocationMasterId}
        backStoryCreateFromSeed={mysteryState.backStoryCreateFromSeed}
        setBackStoryCreateFromSeed={mysteryState.setBackStoryCreateFromSeed}
        masterLocations={masterAssets.masterLocations}
        
        // Backstories Actions
        loadMasterLocations={masterAssets.loadMasterLocations}
        loadBackstories={mysteryState.loadBackstories}
        createBackstory={mysteryState.createBackstory}
      />

      <ToolsModal 
        modalRef={modalRefs.toolsRef}
        isAdmin={isAdmin}
        busy={busy}
        caseId={mysteryState.caseId}
        setCaseId={mysteryState.setCaseId}
        cases={mysteryState.cases}
        jobs={mysteryState.jobs}
        jobAction={darkroom.jobAction}
        setJobAction={darkroom.setJobAction}
        jobScopeCharacter={darkroom.jobScopeCharacter}
        setJobScopeCharacter={darkroom.setJobScopeCharacter}
        jobScopeLocation={darkroom.jobScopeLocation}
        setJobScopeLocation={darkroom.setJobScopeLocation}
        jobScopeWeapon={darkroom.jobScopeWeapon}
        setJobScopeWeapon={darkroom.setJobScopeWeapon}
        jobScopeMotive={darkroom.jobScopeMotive}
        setJobScopeMotive={darkroom.setJobScopeMotive}
        jobSpecText={darkroom.jobSpecText}
        setJobSpecText={darkroom.setJobSpecText}
        imageStyleMasterDraft={darkroom.imageStyleMasterDraft}
        setImageStyleMasterDraft={darkroom.setImageStyleMasterDraft}
        locationImageStyleDraft={darkroom.locationImageStyleDraft}
        setLocationImageStyleDraft={darkroom.setLocationImageStyleDraft}
        mugshotImageStyleDraft={darkroom.mugshotImageStyleDraft}
        setMugshotImageStyleDraft={darkroom.setMugshotImageStyleDraft}
        weaponImageStyleDraft={darkroom.weaponImageStyleDraft}
        setWeaponImageStyleDraft={darkroom.setWeaponImageStyleDraft}
        enqueueJob={darkroom.enqueueJob}
        previewEnqueueJobJson={darkroom.previewEnqueueJobJson}
        loadJobs={mysteryState.loadJobs}
        clearQueuedJobs={darkroom.clearQueuedJobs}
        clearCompletedJobs={darkroom.clearCompletedJobs}
        deleteQueuedJob={darkroom.deleteQueuedJob}
        saveImageStyleSetting={darkroom.saveImageStyleSetting}
      />
    </>
  );
}
